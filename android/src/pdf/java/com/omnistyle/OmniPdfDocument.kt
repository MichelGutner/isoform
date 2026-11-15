package com.omnistyle

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.RectF
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.util.LruCache
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors

/** A search match: its page and rectangles (in points). */
internal data class OmniPdfMatch(
  /** Page of the match, from `0`. */
  val page: Int,
  /** Rectangles covered by the match, in points (more than one when it spans lines). */
  val bounds: List<RectF>,
)

/**
 * An open PDF on Android: the renderer (`OmniPdfEngine`) plus the work around it.
 * Everything that touches the renderer runs on one background thread (it can only
 * open one page at a time); drawn pages are kept in a small memory cache.
 */
internal class OmniPdfDocument private constructor(
  private val engine: OmniPdfEngine,
  private val file: ParcelFileDescriptor,
  private val thread: CoroutineDispatcher,
  private val closeThread: () -> Unit,
  /** Size of every page, in points. */
  val sizes: List<Pair<Int, Int>>,
) {
  /** Number of pages. */
  val pageCount: Int get() = sizes.size

  /** Whether search, links and read aloud work on this device (Android 12+ with updates, or 15+). */
  val hasText: Boolean get() = engine.hasText

  /** Drawn pages by "page@width", limited by memory (1/8 of the app's heap). */
  private val bitmaps =
    object : LruCache<String, Bitmap>((Runtime.getRuntime().maxMemory() / 8).toInt()) {
      override fun sizeOf(key: String, value: Bitmap) = value.byteCount
    }

  private val links = HashMap<Int, List<OmniPdfLink>>()

  /** The page drawn `width` pixels wide (from the cache when it was drawn at that width before). */
  suspend fun render(index: Int, width: Int): Bitmap? {
    val key = "$index@$width"
    bitmaps.get(key)?.let { return it }
    return withContext(thread) {
      bitmaps.get(key) ?: draw(index, width)?.also { bitmaps.put(key, it) }
    }
  }

  private fun draw(index: Int, width: Int): Bitmap? = runCatching {
    val (pageWidth, pageHeight) = sizes[index]
    val scale = width.toFloat() / pageWidth
    val bitmap = Bitmap.createBitmap(width, (pageHeight * scale).toInt().coerceAtLeast(1), Bitmap.Config.ARGB_8888)
    // the renderer draws only the content: the paper is white
    bitmap.eraseColor(Color.WHITE)
    engine.render(index, bitmap, Matrix().apply { setScale(scale, scale) })
    bitmap
  }.getOrNull()

  /** Every match of `query` in the document, page by page (`onPage` reports progress). */
  suspend fun search(query: String, onPage: (List<OmniPdfMatch>) -> Unit): List<OmniPdfMatch> {
    val found = ArrayList<OmniPdfMatch>()
    for (index in 0 until pageCount) {
      val page = withContext(thread) { runCatching { engine.search(index, query) }.getOrDefault(emptyList()) }
      page.forEach { bounds -> found += OmniPdfMatch(index, bounds) }
      onPage(found.toList())
    }
    return found
  }

  /** The page's links (read once). */
  suspend fun links(index: Int): List<OmniPdfLink> =
    links[index] ?: withContext(thread) { runCatching { engine.links(index) }.getOrDefault(emptyList()) }.also { links[index] = it }

  /** The page's text (for read aloud). */
  suspend fun text(index: Int): String = withContext(thread) { runCatching { engine.text(index) }.getOrDefault("") }

  fun close() {
    bitmaps.evictAll()
    runCatching { engine.close() }
    runCatching { file.close() }
    closeThread()
  }

  companion object {
    /** Downloads (`https://`) or reads (`file://`, `content://`) `src` into a local file. */
    suspend fun fetch(context: Context, src: String): File = withContext(Dispatchers.IO) {
      val uri = Uri.parse(src)
      val fetchers = mapOf<String, () -> File>(
        "file" to { File(requireNotNull(uri.path)) },
        "content" to { copy(context, src) { requireNotNull(context.contentResolver.openInputStream(uri)) } },
        "http" to { copy(context, src) { download(src) } },
        "https" to { copy(context, src) { download(src) } },
      )
      val fetcher = fetchers[uri.scheme?.lowercase()] ?: error("Unsupported address: $src")
      fetcher()
    }

    private fun download(src: String) =
      (URL(src).openConnection() as HttpURLConnection).run {
        connectTimeout = 15_000
        readTimeout = 30_000
        instanceFollowRedirects = true
        if (responseCode >= 400) error("The server answered $responseCode.")
        inputStream
      }

    /** Copies a stream to the cache folder (named by the address, so it is downloaded once). */
    private fun copy(context: Context, src: String, open: () -> java.io.InputStream): File {
      val name = MessageDigest.getInstance("SHA-1").digest(src.toByteArray()).joinToString("") { "%02x".format(it) }
      val target = File(File(context.cacheDir, "omnistyle-pdf").apply { mkdirs() }, "$name.pdf")
      if (target.length() > 0) return target
      val partial = File(target.path + ".part")
      open().use { input -> partial.outputStream().use { input.copyTo(it) } }
      partial.renameTo(target)
      return target
    }

    /** Opens a local file; throws `OmniPdfLockedException` when it needs a (different) password. */
    suspend fun open(file: File, password: String?): OmniPdfDocument {
      val executor = Executors.newSingleThreadExecutor { Thread(it, "omnistyle-pdf") }
      val thread = executor.asCoroutineDispatcher()
      return try {
        withContext(thread) {
          val descriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
          val engine =
            try {
              openPdfEngine(descriptor, password)
            } catch (error: Throwable) {
              descriptor.close()
              throw error
            }
          val sizes = (0 until engine.pageCount).map(engine::pageSize)
          OmniPdfDocument(engine, descriptor, thread, executor::shutdown, sizes)
        }
      } catch (error: Throwable) {
        executor.shutdown()
        throw error
      }
    }
  }
}
