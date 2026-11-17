package com.isoform

import android.content.ContentResolver
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.graphics.Matrix
import android.graphics.drawable.AnimatedImageDrawable
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.LruCache
import com.facebook.react.modules.network.OkHttpClientProvider
import okhttp3.Call
import okhttp3.Callback
import okhttp3.Request
import okhttp3.Response
import java.io.File
import java.io.IOException
import java.nio.ByteBuffer
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.PriorityBlockingQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong
import kotlin.math.max
import kotlin.math.min

/**
 * A decoded picture: a bitmap, or the file of an animation (each view decodes its own
 * `AnimatedImageDrawable` from it, since a playing drawable cannot be shared).
 */
internal class IsoDecodedImage(
  val bitmap: Bitmap?,
  val animated: ByteArray?,
  /** Size of the file's picture, in pixels (after the EXIF orientation). */
  val pixelWidth: Int,
  val pixelHeight: Int,
  /** Long side of the decoded bitmap (or of the animation's target), in pixels. */
  val decodedLongSide: Float,
  /** Decoded at the file's own size. */
  val full: Boolean,
) {
  val bytes: Int get() = bitmap?.allocationByteCount ?: animated?.size ?: 0
  fun covers(need: Float): Boolean = full || decodedLongSide >= need - 1f
}

/** Where a loaded picture came from (`onLoad`'s `cacheType`). */
internal enum class IsoCacheType(val value: String) { MEMORY("memory"), DISK("disk"), NONE("none") }

/** One picture to load. */
internal data class IsoImageRequest(
  val uri: String,
  val cacheKey: String = "",
  val headers: Map<String, String> = emptyMap(),
  /** Keep it in (and read it from) the memory cache. */
  val memory: Boolean = true,
  /** Keep the file in (and read it from) the disk cache. */
  val disk: Boolean = true,
  /** 0 low, 1 normal, 2 high. */
  val priority: Int = 1,
  /** Size of the view, in pixels (0 = decode at full size). */
  val viewWidth: Int = 0,
  val viewHeight: Int = 0,
  /** `contentFit` (`cover`, `contain`, `fill`, `none`, `scaleDown`). */
  val fit: String = "cover",
  /** Largest zoom the view allows. */
  val zoom: Float = 1f,
  /** Gaussian blur radius, in pixels (applied to the bitmap only before Android 12; newer ones blur on the GPU). */
  val blurRadius: Float = 0f,
  /** Skip the caches. */
  val reload: Boolean = false,
) {
  val key: String get() = cacheKey.ifEmpty { uri }
  val memoryKey: String get() = if (blurRadius > 0f && Build.VERSION.SDK_INT < Build.VERSION_CODES.S) "$key#blur$blurRadius" else key
}

/** Handle of a load: cancel it when the view shows something else. */
internal class IsoImageTicket {
  val id: UUID = UUID.randomUUID()
  private val done = AtomicBoolean(false)
  @Volatile internal var onCancel: (() -> Unit)? = null
  val cancelled: Boolean get() = done.get()

  fun cancel() {
    if (done.compareAndSet(false, true)) {
      onCancel?.invoke()
      onCancel = null
    }
  }
}

/** A task of the pipeline's pool, run by priority (then in order). */
private class PriorityTask(val priority: Int, val run: () -> Unit) : Runnable, Comparable<PriorityTask> {
  private val order = sequence.incrementAndGet()
  override fun run() = run.invoke()
  override fun compareTo(other: PriorityTask): Int =
    if (priority != other.priority) other.priority.compareTo(priority) else order.compareTo(other.order)

  companion object {
    private val sequence = AtomicLong()
  }
}

/**
 * The lib's image pipeline, shared by every `IsoImageView` (the same design as iOS):
 *  · memory cache of decoded pictures (`LruCache`, an eighth of the app's memory);
 *  · disk cache of the files (cacheDir/isoform-images, trimmed to 300 MB, oldest first);
 *  · one download per picture however many views wait for it, through React Native's own
 *    OkHttp client (its cookies and interceptors), with progress, cancelled when nobody waits;
 *  · decoding off the main thread, at the size the view needs (`ImageDecoder`, EXIF
 *    orientation applied), animated GIF/WebP as `AnimatedImageDrawable` (Android 9+).
 */
internal object IsoImagePipeline {
  private const val DISK_LIMIT = 300L * 1024 * 1024
  private const val ZOOM_LIMIT = 4096f

  private lateinit var context: Context
  private val main = Handler(Looper.getMainLooper())
  private val pool = ThreadPoolExecutor(4, 4, 30, TimeUnit.SECONDS, PriorityBlockingQueue<Runnable>()).apply { allowCoreThreadTimeOut(true) }
  private val memory = object : LruCache<String, IsoDecodedImage>((Runtime.getRuntime().maxMemory() / 8).toInt()) {
    override fun sizeOf(key: String, value: IsoDecodedImage): Int = max(1, value.bytes)
  }
  private val downloads = HashMap<String, Download>()
  private val writes = AtomicInteger()
  private val directory: File by lazy { File(context.cacheDir, "isoform-images").apply { mkdirs() } }

  private class Download(val key: String, val call: Call) {
    val waiters = HashMap<UUID, Waiter>()
  }

  private class Waiter(val progress: (Long, Long) -> Unit, val completion: (Result<ByteArray>) -> Unit)

  fun init(context: Context) {
    if (!::context.isInitialized) {
      this.context = context.applicationContext
      pool.execute(PriorityTask(-1) { trimDisk() })
    }
  }

  // ── loading ──

  /** Decoded picture for [request], from the memory cache when it is sharp enough. */
  fun cached(request: IsoImageRequest): IsoDecodedImage? {
    if (!request.memory || request.reload) return null
    val hit = memory.get(request.memoryKey) ?: return null
    return if (hit.covers(neededLongSide(hit.pixelWidth, hit.pixelHeight, request))) hit else null
  }

  /** Loads, decodes and caches a picture. Callbacks run on the main thread, never after a cancel. */
  fun load(
    request: IsoImageRequest,
    progress: (Long, Long) -> Unit = { _, _ -> },
    completion: (Result<Pair<IsoDecodedImage, IsoCacheType>>) -> Unit,
  ): IsoImageTicket {
    val ticket = IsoImageTicket()
    cached(request)?.let {
      completion(Result.success(it to IsoCacheType.MEMORY))
      return ticket
    }
    val deliver = { result: Result<Pair<IsoDecodedImage, IsoCacheType>> -> main.post { if (!ticket.cancelled) completion(result) } }
    fetchData(request, ticket, { loaded, total -> main.post { if (!ticket.cancelled) progress(loaded, total) } }) { result ->
      if (ticket.cancelled) return@fetchData
      pool.execute(PriorityTask(request.priority) {
        val decoded = result.mapCatching { (bytes, type) ->
          val image = decode(bytes, request) ?: throw IOException("The file is not a picture this device can decode")
          if (request.memory) memory.put(request.memoryKey, image)
          image to type
        }
        deliver(decoded)
      })
    }
    return ticket
  }

  /** The file's bytes: a local source, the disk cache or the network (then written to the disk cache). */
  private fun fetchData(
    request: IsoImageRequest,
    ticket: IsoImageTicket,
    progress: (Long, Long) -> Unit,
    completion: (Result<Pair<ByteArray, IsoCacheType>>) -> Unit,
  ) {
    pool.execute(PriorityTask(request.priority) {
      if (ticket.cancelled) return@PriorityTask
      val uri = request.uri
      val remote = uri.startsWith("http://", ignoreCase = true) || uri.startsWith("https://", ignoreCase = true)
      if (!remote) {
        completion(runCatching { readLocal(uri) ?: throw IOException("Unsupported image source: $uri") }.map { it to IsoCacheType.DISK })
        return@PriorityTask
      }
      if (request.disk && !request.reload) {
        readDisk(request.key)?.let { return@PriorityTask completion(Result.success(it to IsoCacheType.DISK)) }
      }
      download(request, ticket, progress) { result ->
        result.onSuccess { bytes -> if (request.disk) pool.execute(PriorityTask(-1) { writeDisk(bytes, request.key) }) }
        completion(result.map { it to IsoCacheType.NONE })
      }
    })
  }

  /** `file://`, `content://`, `android.resource://`, `asset:/`, `data:` and resource names (release `require`). */
  private fun readLocal(uri: String): ByteArray? {
    val resolver = context.contentResolver
    return when {
      uri.startsWith("data:") -> {
        val comma = uri.indexOf(',')
        if (comma < 0) null else if (uri.substring(0, comma).endsWith(";base64")) Base64.decode(uri.substring(comma + 1), Base64.DEFAULT) else Uri.decode(uri.substring(comma + 1)).toByteArray()
      }
      uri.startsWith("asset:/") -> context.assets.open(uri.removePrefix("asset:/").trimStart('/')).use { it.readBytes() }
      uri.startsWith("file://") || uri.startsWith(ContentResolver.SCHEME_CONTENT) || uri.startsWith(ContentResolver.SCHEME_ANDROID_RESOURCE) ->
        resolver.openInputStream(Uri.parse(uri))?.use { it.readBytes() }
      uri.startsWith("/") -> File(uri).takeIf { it.exists() }?.readBytes()
      else -> {
        val name = uri.substringBeforeLast('.').lowercase().replace(Regex("[^a-z0-9_]"), "_")
        val id = context.resources.getIdentifier(name, "drawable", context.packageName)
          .takeIf { it != 0 } ?: context.resources.getIdentifier(name, "raw", context.packageName)
        if (id == 0) null else context.resources.openRawResource(id).use { it.readBytes() }
      }
    }
  }

  private fun download(request: IsoImageRequest, ticket: IsoImageTicket, progress: (Long, Long) -> Unit, completion: (Result<ByteArray>) -> Unit) {
    val key = if (request.reload) "${request.key}#${ticket.id}" else request.key
    val waiter = Waiter(progress, completion)
    val shared: Download
    val start: Boolean
    synchronized(downloads) {
      val existing = downloads[key]
      start = existing == null
      shared = existing ?: run {
        val builder = Request.Builder().url(request.uri)
        request.headers.forEach { (name, value) -> builder.header(name, value) }
        Download(key, OkHttpClientProvider.getOkHttpClient().newCall(builder.build())).also { downloads[key] = it }
      }
      shared.waiters[ticket.id] = waiter
    }
    ticket.onCancel = {
      val idle = synchronized(downloads) {
        shared.waiters.remove(ticket.id)
        shared.waiters.isEmpty().also { if (it) downloads.remove(shared.key) }
      }
      if (idle) shared.call.cancel()
    }
    if (ticket.cancelled) ticket.onCancel?.invoke()
    if (start) shared.call.enqueue(DownloadCallback(shared))
  }

  private class DownloadCallback(private val download: Download) : Callback {
    private fun waiters(remove: Boolean): List<Waiter> = synchronized(downloads) {
      if (remove && downloads[download.key] === download) downloads.remove(download.key)
      download.waiters.values.toList()
    }

    override fun onFailure(call: Call, e: IOException) {
      waiters(remove = true).forEach { it.completion(Result.failure(e)) }
    }

    override fun onResponse(call: Call, response: Response) {
      val result = runCatching {
        response.use {
          if (!it.isSuccessful) throw IOException("HTTP ${it.code}")
          val body = it.body ?: throw IOException("Empty response")
          val total = body.contentLength().coerceAtLeast(0)
          val out = java.io.ByteArrayOutputStream(if (total > 0) total.toInt() else 64 * 1024)
          val buffer = ByteArray(16 * 1024)
          var loaded = 0L
          body.byteStream().use { input ->
            while (true) {
              val read = input.read(buffer)
              if (read < 0) break
              out.write(buffer, 0, read)
              loaded += read
              waiters(remove = false).forEach { waiter -> waiter.progress(loaded, total) }
            }
          }
          out.toByteArray()
        }
      }
      waiters(remove = true).forEach { it.completion(result) }
    }
  }

  // ── decoding ──

  /** Pixels the long side needs to look sharp in the view (the file's long side = full size). */
  fun neededLongSide(width: Int, height: Int, request: IsoImageRequest): Float {
    val long = max(width, height).toFloat()
    if (request.viewWidth <= 0 || request.viewHeight <= 0 || width <= 0 || height <= 0) return long
    val scaleX = request.viewWidth.toFloat() / width
    val scaleY = request.viewHeight.toFloat() / height
    val scale = when (request.fit) {
      "contain" -> min(scaleX, scaleY)
      "scaleDown" -> min(1f, min(scaleX, scaleY))
      "none" -> 1f
      else -> max(scaleX, scaleY)
    }
    val need = long * min(1f, scale * request.zoom)
    return if (request.zoom > 1f) min(max(need, min(long, ZOOM_LIMIT)), long) else need
  }

  /** EXIF orientation → the rotation it needs (mirrored ones are drawn rotated only). */
  private val EXIF_DEGREES = mapOf(
    ExifInterface.ORIENTATION_ROTATE_90 to 90,
    ExifInterface.ORIENTATION_TRANSPOSE to 90,
    ExifInterface.ORIENTATION_ROTATE_180 to 180,
    ExifInterface.ORIENTATION_FLIP_VERTICAL to 180,
    ExifInterface.ORIENTATION_ROTATE_270 to 270,
    ExifInterface.ORIENTATION_TRANSVERSE to 270,
  )

  /** Size of the file's picture with its EXIF orientation, and the rotation that orientation needs. */
  private fun bounds(bytes: ByteArray): Triple<Int, Int, Int> {
    val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
    val orientation = runCatching {
      ExifInterface(bytes.inputStream()).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
    }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)
    val degrees = EXIF_DEGREES[orientation] ?: 0
    return if (degrees == 90 || degrees == 270) Triple(options.outHeight, options.outWidth, degrees) else Triple(options.outWidth, options.outHeight, degrees)
  }

  fun decode(bytes: ByteArray, request: IsoImageRequest): IsoDecodedImage? {
    val (width, height, degrees) = bounds(bytes)
    val long = max(width, height).toFloat()
    val need = neededLongSide(width, height, request)
    val full = long <= 0f || need >= long
    val ratio = if (full || long <= 0f) 1f else need / long
    // the blur of older Android versions runs on the bitmap, which must then be in normal memory
    val softBlur = request.blurRadius > 0f && Build.VERSION.SDK_INT < Build.VERSION_CODES.S

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      val drawable = runCatching {
        ImageDecoder.decodeDrawable(ImageDecoder.createSource(ByteBuffer.wrap(bytes))) { decoder, info, _ ->
          if (ratio < 1f) decoder.setTargetSize(max(1, (info.size.width * ratio).toInt()), max(1, (info.size.height * ratio).toInt()))
          if (softBlur) decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
        }
      }.getOrNull() ?: return null
      if (drawable is AnimatedImageDrawable) {
        return IsoDecodedImage(null, bytes, width, height, if (full) long else need, full)
      }
      val bitmap = (drawable as? android.graphics.drawable.BitmapDrawable)?.bitmap ?: return null
      return IsoDecodedImage(blurIfNeeded(bitmap, request), null, max(width, bitmap.width), max(height, bitmap.height), max(bitmap.width, bitmap.height).toFloat(), full)
    }

    var sample = 1
    while (!full && long / (sample * 2) >= need) sample *= 2
    val decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample }) ?: return null
    val turned = if (degrees == 0) decoded else Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, Matrix().apply { postRotate(degrees.toFloat()) }, true)
    return IsoDecodedImage(blurIfNeeded(turned, request), null, width, height, max(turned.width, turned.height).toFloat(), sample == 1)
  }

  /**
   * Blur before Android 12 (newer versions blur on the GPU, in the view): the bitmap is
   * shrunk by the radius and drawn back stretched, which a smooth filter turns into a blur.
   */
  private fun blurIfNeeded(bitmap: Bitmap, request: IsoImageRequest): Bitmap {
    if (request.blurRadius <= 0f || Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) return bitmap
    val factor = (request.blurRadius / 2f).coerceAtLeast(1f)
    val small = Bitmap.createScaledBitmap(bitmap, max(1, (bitmap.width / factor).toInt()), max(1, (bitmap.height / factor).toInt()), true)
    return Bitmap.createScaledBitmap(small, bitmap.width, bitmap.height, true)
  }

  /** A drawable of an animation for one view, [targetWidth] pixels wide at most (decoded on the pool; [done] runs on the main thread). */
  fun animation(bytes: ByteArray, targetWidth: Int, done: (AnimatedImageDrawable?) -> Unit) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return done(null)
    pool.execute(PriorityTask(1) {
      val drawable = runCatching {
        ImageDecoder.decodeDrawable(ImageDecoder.createSource(ByteBuffer.wrap(bytes))) { decoder, info, _ ->
          if (targetWidth in 1 until info.size.width) decoder.setTargetSize(targetWidth, max(1, info.size.height * targetWidth / info.size.width))
        } as? AnimatedImageDrawable
      }.getOrNull()
      main.post { done(drawable) }
    })
  }

  /** First frame of an animation (Android 8 and older show it still). */
  fun firstFrame(bytes: ByteArray): Bitmap? = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)

  // ── disk cache ──

  private fun file(key: String): File {
    val digest = MessageDigest.getInstance("SHA-256").digest(key.toByteArray())
    return File(directory, digest.joinToString("") { "%02x".format(it) })
  }

  private fun readDisk(key: String): ByteArray? {
    val file = file(key)
    if (!file.exists()) return null
    // most recently used: trimmed last
    file.setLastModified(System.currentTimeMillis())
    return runCatching { file.readBytes() }.getOrNull()
  }

  private fun writeDisk(bytes: ByteArray, key: String) {
    val target = file(key)
    val temp = File(directory, "${target.name}.tmp")
    runCatching {
      temp.writeBytes(bytes)
      temp.renameTo(target)
    }
    if (writes.incrementAndGet() % 50 == 0) trimDisk()
  }

  /** Deletes the least recently used files until the cache is under its limit. */
  private fun trimDisk() {
    val files = directory.listFiles()?.sortedBy { it.lastModified() } ?: return
    var total = files.sumOf { it.length() }
    for (file in files) {
      if (total <= DISK_LIMIT) break
      total -= file.length()
      file.delete()
    }
  }

  // ── prefetch / clear ──

  /** Downloads the pictures (and decodes them when [memory]). [done] runs on the main thread. */
  fun prefetch(uris: List<String>, headers: Map<String, String>, memory: Boolean, disk: Boolean, done: (Boolean) -> Unit) {
    if (uris.isEmpty()) return done(true)
    val left = AtomicInteger(uris.size)
    val ok = AtomicBoolean(true)
    val finish = { success: Boolean ->
      if (!success) ok.set(false)
      if (left.decrementAndGet() == 0) main.post { done(ok.get()) }
    }
    uris.forEach { uri ->
      val request = IsoImageRequest(uri, headers = headers, memory = memory, disk = disk, priority = 0)
      if (memory) {
        load(request) { finish(it.isSuccess) }
      } else {
        fetchData(request, IsoImageTicket(), { _, _ -> }) { finish(it.isSuccess) }
      }
    }
  }

  fun clear(memory: Boolean, disk: Boolean, done: () -> Unit) {
    if (memory) this.memory.evictAll()
    if (!disk) return done()
    pool.execute(PriorityTask(2) {
      directory.listFiles()?.forEach { it.delete() }
      main.post(done)
    })
  }
}

/** `[name, value, name, value…]` → a map. */
internal fun headerMap(flat: List<String>): Map<String, String> =
  (0 until flat.size / 2).associate { flat[it * 2] to flat[it * 2 + 1] }

/** Decodes [blurhash](https://blurha.sh) strings (the same algorithm as the JS and iOS versions). */
internal object IsoBlurhash {
  private const val DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#\$%*+,-.:;=?@[]^_{|}~"

  private fun decode83(text: String): Int? = text.fold(0 as Int?) { value, char -> value?.let { total -> DIGITS.indexOf(char).takeIf { it >= 0 }?.let { total * 83 + it } } }

  private fun linear(value: Int): Double {
    val v = value / 255.0
    return if (v <= 0.04045) v / 12.92 else Math.pow((v + 0.055) / 1.055, 2.4)
  }

  private fun srgb(value: Double): Int {
    val v = value.coerceIn(0.0, 1.0)
    return (if (v <= 0.0031308) v * 12.92 * 255 + 0.5 else (1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255 + 0.5).toInt()
  }

  private fun signPow(value: Double, exponent: Double): Double = Math.copySign(Math.pow(Math.abs(value), exponent), value)

  /** The blurred picture, [width]×[height] pixels, or `null` for an invalid hash. */
  fun bitmap(hash: String, width: Int = 32, height: Int = 32, punch: Double = 1.0): Bitmap? {
    if (hash.length < 6) return null
    val size = decode83(hash.substring(0, 1)) ?: return null
    val countY = size / 9 + 1
    val countX = size % 9 + 1
    if (hash.length != 4 + 2 * countX * countY) return null
    val maximum = ((decode83(hash.substring(1, 2)) ?: return null) + 1) / 166.0 * punch
    val dc = decode83(hash.substring(2, 6)) ?: return null
    val colors = ArrayList<DoubleArray>(countX * countY)
    colors.add(doubleArrayOf(linear(dc shr 16), linear((dc shr 8) and 255), linear(dc and 255)))
    for (index in 1 until countX * countY) {
      val value = decode83(hash.substring(4 + index * 2, 6 + index * 2)) ?: return null
      colors.add(
        doubleArrayOf(
          signPow((value / (19 * 19) - 9) / 9.0, 2.0) * maximum,
          signPow(((value / 19) % 19 - 9) / 9.0, 2.0) * maximum,
          signPow((value % 19 - 9) / 9.0, 2.0) * maximum,
        ),
      )
    }
    val pixels = IntArray(width * height)
    for (y in 0 until height) {
      for (x in 0 until width) {
        var r = 0.0
        var g = 0.0
        var b = 0.0
        for (j in 0 until countY) {
          for (i in 0 until countX) {
            val basis = Math.cos(Math.PI * x * i / width) * Math.cos(Math.PI * y * j / height)
            val color = colors[i + j * countX]
            r += color[0] * basis
            g += color[1] * basis
            b += color[2] * basis
          }
        }
        pixels[x + y * width] = (0xFF shl 24) or (srgb(r) shl 16) or (srgb(g) shl 8) or srgb(b)
      }
    }
    return Bitmap.createBitmap(pixels, width, height, Bitmap.Config.ARGB_8888)
  }
}
