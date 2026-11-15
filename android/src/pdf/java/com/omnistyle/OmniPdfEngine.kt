package com.omnistyle

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.graphics.Matrix
import android.graphics.RectF
import android.graphics.pdf.LoadParams
import android.graphics.pdf.PdfRenderer
import android.graphics.pdf.PdfRendererPreV
import android.graphics.pdf.RenderParams
import android.os.Build
import android.os.ParcelFileDescriptor
import android.os.ext.SdkExtensions
import androidx.annotation.RequiresApi
import androidx.annotation.RequiresExtension

/**
 * The system PDF renderer behind the Android `Pdf`, in one of three flavors:
 *  · Android 15+: `PdfRenderer` with text, search, links and passwords;
 *  · Android 12–14 with SDK extension 13 (Google Play system updates): `PdfRendererPreV`, same features;
 *  · older devices: the basic `PdfRenderer` (pages only: no text, search, links or passwords).
 *
 * Not thread-safe (only one page may be open at a time): `OmniPdfDocument` calls it
 * from a single thread. Sizes and coordinates are in PDF points (1/72 inch).
 */
internal interface OmniPdfEngine : AutoCloseable {
  /** Number of pages. */
  val pageCount: Int

  /** Whether text, search and links work (the premium flavors). */
  val hasText: Boolean

  /** Width and height of a page, in points. */
  fun pageSize(index: Int): Pair<Int, Int>

  /** Draws the page into `bitmap`, scaled by `transform` (points → bitmap pixels). */
  fun render(index: Int, bitmap: Bitmap, transform: Matrix)

  /** Every match of `query` on the page, each as its rectangles (a match may span lines). */
  fun search(index: Int, query: String): List<List<RectF>>

  /** The page's text, in reading order. */
  fun text(index: Int): String

  /** The page's links: website links (`url`) and links to another page (`page`). */
  fun links(index: Int): List<OmniPdfLink>
}

/** A link area of a page. */
internal data class OmniPdfLink(
  /** Where the link is, in points. */
  val bounds: List<RectF>,
  /** Website address (external links). */
  val url: String? = null,
  /** Destination page, from `0` (internal links). */
  val page: Int? = null,
)

/** Thrown when the document needs a password that was not given (or is wrong). */
internal class OmniPdfLockedException : Exception("This document is protected by a password.")

/** Thrown when a password-protected file is opened on a device that cannot decrypt it. */
internal class OmniPdfUnsupportedException : Exception("Password-protected PDFs need Android 12 or newer with system updates.")

/** Whether `PdfRendererPreV` (text, search, links, passwords) exists on this Android 12–14 device. */
private fun hasPreV(): Boolean =
  Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && SdkExtensions.getExtensionVersion(Build.VERSION_CODES.S) >= 13

/** Opens `file` with the best renderer of this device. */
internal fun openPdfEngine(file: ParcelFileDescriptor, password: String?): OmniPdfEngine =
  when {
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM -> ModernPdfEngine(file, password)
    hasPreV() -> PreVPdfEngine(file, password)
    else -> BasicPdfEngine(file)
  }

/** The renderer's `SecurityException` (missing or wrong password) as our own error. */
private inline fun <T> unlocking(open: () -> T): T =
  try {
    open()
  } catch (_: SecurityException) {
    throw OmniPdfLockedException()
  }

private fun loadParams(password: String?): LoadParams =
  LoadParams.Builder().apply { if (!password.isNullOrEmpty()) setPassword(password) }.build()

private fun gotoLinks(links: List<android.graphics.pdf.content.PdfPageGotoLinkContent>) =
  links.map { OmniPdfLink(bounds = it.bounds, page = it.destination.pageNumber) }

private fun webLinks(links: List<android.graphics.pdf.content.PdfPageLinkContent>) =
  links.map { OmniPdfLink(bounds = it.bounds, url = it.uri.toString()) }

/** Android 15+: the full `PdfRenderer`. */
@RequiresApi(Build.VERSION_CODES.VANILLA_ICE_CREAM)
private class ModernPdfEngine(file: ParcelFileDescriptor, password: String?) : OmniPdfEngine {
  private val renderer = unlocking { PdfRenderer(file, loadParams(password)) }
  override val pageCount = renderer.pageCount
  override val hasText = true

  override fun pageSize(index: Int) = renderer.openPage(index).use { it.width to it.height }

  override fun render(index: Int, bitmap: Bitmap, transform: Matrix) =
    renderer.openPage(index).use { it.render(bitmap, null, transform, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY) }

  override fun search(index: Int, query: String) = renderer.openPage(index).use { page -> page.searchText(query).map { it.bounds } }

  override fun text(index: Int) = renderer.openPage(index).use { page -> page.textContents.joinToString(" ") { it.text } }

  override fun links(index: Int) = renderer.openPage(index).use { webLinks(it.linkContents) + gotoLinks(it.gotoLinks) }

  override fun close() = renderer.close()
}

/** Android 12–14 with SDK extension 13: `PdfRendererPreV`, the same features through Google Play system updates. */
@SuppressLint("NewApi")
@RequiresExtension(extension = Build.VERSION_CODES.S, version = 13)
private class PreVPdfEngine(file: ParcelFileDescriptor, password: String?) : OmniPdfEngine {
  private val renderer = unlocking { PdfRendererPreV(file, loadParams(password)) }
  private val display = RenderParams.Builder(RenderParams.RENDER_MODE_FOR_DISPLAY).build()
  override val pageCount = renderer.pageCount
  override val hasText = true

  override fun pageSize(index: Int) = renderer.openPage(index).use { it.width to it.height }

  override fun render(index: Int, bitmap: Bitmap, transform: Matrix) =
    renderer.openPage(index).use { it.render(bitmap, null, transform, display) }

  override fun search(index: Int, query: String) = renderer.openPage(index).use { page -> page.searchText(query).map { it.bounds } }

  override fun text(index: Int) = renderer.openPage(index).use { page -> page.textContents.joinToString(" ") { it.text } }

  override fun links(index: Int) = renderer.openPage(index).use { webLinks(it.linkContents) + gotoLinks(it.gotoLinks) }

  override fun close() = renderer.close()
}

/** Older devices: pages only. A protected file cannot be opened here. */
private class BasicPdfEngine(file: ParcelFileDescriptor) : OmniPdfEngine {
  private val renderer =
    try {
      PdfRenderer(file)
    } catch (_: SecurityException) {
      throw OmniPdfUnsupportedException()
    }
  override val pageCount = renderer.pageCount
  override val hasText = false

  override fun pageSize(index: Int) = renderer.openPage(index).use { it.width to it.height }

  override fun render(index: Int, bitmap: Bitmap, transform: Matrix) =
    renderer.openPage(index).use { it.render(bitmap, null, transform, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY) }

  override fun search(index: Int, query: String): List<List<RectF>> = emptyList()

  override fun text(index: Int) = ""

  override fun links(index: Int): List<OmniPdfLink> = emptyList()

  override fun close() = renderer.close()
}
