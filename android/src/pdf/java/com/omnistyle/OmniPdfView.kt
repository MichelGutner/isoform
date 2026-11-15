package com.omnistyle

import android.content.Intent
import android.view.MotionEvent
import android.net.Uri
import android.widget.FrameLayout
import androidx.compose.ui.platform.ComposeView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File

/**
 * Native view of `Pdf` on Android.
 *  · document: the system `PdfRenderer` (`OmniPdfDocument`), downloaded to the cache first;
 *  · interface: Jetpack Compose (`OmniPdfViewer.kt`);
 *  · read aloud: `TextToSpeech` (`OmniPdfReader.kt`).
 * This class only holds the props, commands and events to JS.
 */
class OmniPdfView(private val reactContext: ThemedReactContext) : FrameLayout(reactContext) {

  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
  private val ui = OmniPdfUiState()
  private val reader = OmniPdfReader(reactContext, scope).apply {
    onPage = { page ->
      ui.readingPage = page
      ui.scroll = PdfScroll(page)
    }
    onChange = { reading ->
      ui.reading = reading
      if (!reading) ui.readingPage = null
      emit(READ_ALOUD, Arguments.createMap().apply { putBoolean("reading", reading) })
    }
  }

  private var source: String? = null
  private var password: String? = null
  private var initialPage = 1
  private var file: File? = null
  private var loadJob: Job? = null
  private var searchJob: Job? = null
  private var lastPage = -1

  private val actions = OmniPdfActions(
    pageChanged = ::pageChanged,
    search = ::search,
    next = { select(ui.current + 1) },
    previous = { select(ui.current - 1) },
    closeSearch = ::clearSearch,
    link = ::openLink,
    password = { typed -> file?.let { open(it, typed) } },
    toggleRead = { if (reader.isReading) stopReadAloud() else startReadAloud() },
    setFullscreen = ::setFullscreen,
    selectVoice = { name -> setSpeechVoice(name) },
    // the carousel opens in the React Native view: fullscreen closes first
    openPlaylist = {
      setFullscreen(false)
      emit(PLAYLIST)
    },
  )

  private val composeView = ComposeView(reactContext).apply {
    setContent { OmniPdfViewer(ui, actions) }
  }

  init {
    addView(composeView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }

  // ── props ──

  fun setSource(value: String?) {
    if (value == source) return
    source = value
    load()
  }

  fun setPassword(value: String?) {
    if (value == password) return
    password = value
    if (ui.status is PdfStatus.Locked) file?.let { open(it, value) }
  }

  fun setInitialPage(value: Int) {
    initialPage = value.coerceAtLeast(1)
  }

  fun setControls(value: Boolean) {
    ui.controls = value
  }

  fun setNightMode(value: Boolean) {
    ui.nightMode = value
  }

  fun setFit(value: String?) {
    ui.fit = value ?: "width"
    ui.zoom = 1f
  }

  /** `"vertical"` (pages one under the other) or `"horizontal"` (side by side, one per screen). */
  fun setDirection(value: String?) {
    ui.direction = value ?: "vertical"
    ui.zoom = 1f
  }

  fun setMaxZoom(value: Float) {
    ui.maxZoom = value.coerceAtLeast(1f)
    ui.zoom = ui.zoom.coerceAtMost(ui.maxZoom)
  }

  val playlistIndex: Int get() = ui.playlistIndex
  val playlistCount: Int get() = ui.playlistCount

  /** List (`items`): shows the playlist button with the position (`count` 0 hides it). */
  fun setPlaylist(index: Int, count: Int) {
    ui.playlistIndex = index
    ui.playlistCount = count
  }

  fun setSpeechLanguage(value: String?) {
    reader.language = value?.ifEmpty { null }
    if (ui.document?.hasText == true) reader.voices { ui.voices = it }
  }

  fun setSpeechVoice(value: String?) {
    reader.voiceName = value?.ifEmpty { null }
    ui.voice = reader.voiceName
    // a new voice takes effect from the next page; restarting makes it immediate
    if (reader.isReading) startReadAloud()
  }

  // ── commands ──

  fun goToPage(page: Int) {
    val doc = ui.document ?: return
    ui.scroll = PdfScroll((page - 1).coerceIn(0, doc.pageCount - 1))
  }

  fun search(query: String) {
    ui.searchOpen = true
    ui.query = query
    searchJob?.cancel()
    val doc = ui.document ?: return
    ui.matches = emptyList()
    ui.current = 0
    if (query.isBlank() || !doc.hasText) {
      ui.searching = false
      return emitSearch()
    }
    ui.searching = true
    searchJob = scope.launch {
      // wait for the user to stop typing
      delay(250)
      val found = doc.search(query.trim()) { partial -> ui.matches = partial }
      ui.matches = found
      ui.searching = false
      select(0)
    }
  }

  fun searchNext() = select(ui.current + 1)

  fun searchPrevious() = select(ui.current - 1)

  fun clearSearch() {
    searchJob?.cancel()
    ui.searchOpen = false
    ui.query = ""
    ui.matches = emptyList()
    ui.current = 0
    ui.searching = false
    emitSearch()
  }

  fun setZoom(scale: Float) {
    ui.zoom = scale.coerceIn(1f, ui.maxZoom)
  }

  fun setFullscreen(on: Boolean) {
    if (on == ui.fullscreen) return
    ui.fullscreen = on
    emit(FULLSCREEN, Arguments.createMap().apply { putBoolean("fullscreen", on) })
  }

  fun startReadAloud() {
    val doc = ui.document ?: return
    if (doc.hasText) reader.start(doc, ui.page)
  }

  fun stopReadAloud() = reader.stop()

  fun release() {
    reader.release()
    scope.cancel()
    ui.document?.close()
    ui.document = null
    composeView.disposeComposition()
  }

  // ── loading ──

  private fun load() {
    loadJob?.cancel()
    reader.stop()
    clearSearch()
    ui.document?.close()
    ui.document = null
    file = null
    lastPage = -1
    val src = source?.takeIf { it.isNotBlank() } ?: return run { ui.status = PdfStatus.Ready }
    ui.status = PdfStatus.Loading
    loadJob = scope.launch {
      val local = runCatching { OmniPdfDocument.fetch(reactContext, src) }.getOrElse { return@launch fail(it) }
      file = local
      open(local, password)
    }
  }

  private fun open(local: File, typed: String?) {
    scope.launch {
      runCatching { OmniPdfDocument.open(local, typed) }
        .onSuccess(::present)
        .onFailure { error -> if (error is OmniPdfLockedException) askPassword(wrong = !typed.isNullOrEmpty()) else fail(error) }
    }
  }

  private fun present(doc: OmniPdfDocument) {
    ui.document?.close()
    ui.document = doc
    ui.status = PdfStatus.Ready
    ui.zoom = 1f
    ui.scroll = PdfScroll((initialPage - 1).coerceIn(0, doc.pageCount - 1))
    if (doc.hasText) reader.voices { ui.voices = it }
    emit(LOAD, Arguments.createMap().apply { putInt("pageCount", doc.pageCount) })
  }

  private fun askPassword(wrong: Boolean) {
    ui.status = PdfStatus.Locked(wrong)
    emit(PASSWORD)
  }

  private fun fail(error: Throwable) {
    val message = error.message ?: "This file could not be opened as a PDF."
    ui.status = PdfStatus.Error(message)
    emit(ERROR, Arguments.createMap().apply { putString("message", message) })
  }

  // ── viewer callbacks ──

  private fun pageChanged(page: Int) {
    ui.page = page
    val doc = ui.document ?: return
    if (page == lastPage) return
    lastPage = page
    emit(PAGE, Arguments.createMap().apply {
      putInt("page", page + 1)
      putInt("pageCount", doc.pageCount)
    })
  }

  private fun select(index: Int) {
    val matches = ui.matches
    if (matches.isEmpty()) return emitSearch()
    ui.current = Math.floorMod(index, matches.size)
    val match = matches[ui.current]
    val (_, pageHeight) = ui.document?.sizes?.get(match.page) ?: return
    val top = match.bounds.minOf { it.top }
    ui.scroll = PdfScroll(match.page, top / pageHeight)
    emitSearch()
  }

  private fun openLink(link: OmniPdfLink) {
    link.page?.let { ui.scroll = PdfScroll(it) }
    val url = link.url ?: return
    emit(LINK, Arguments.createMap().apply { putString("url", url) })
    runCatching {
      reactContext.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }

  // ── layout ──

  /**
   * React Native controls the layout of its views and does not forward
   * `requestLayout` from native children. Without this, the `ComposeView`
   * would not be measured when the size changes.
   */
  private val measureAndLayout = Runnable {
    measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
    )
    layout(left, top, right, bottom)
  }

  override fun requestLayout() {
    super.requestLayout()
    post(measureAndLayout)
  }

  /** `ComposeView` crashes if measured before it is in a window: until then only keep the requested size. */
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    if (!isAttachedToWindow) {
      return setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
    }
    super.onMeasure(widthMeasureSpec, heightMeasureSpec)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    requestLayout()
  }

  /**
   * Inside a `ScrollView`/`FlatList`, the list would take every vertical drag before
   * the pages see it (and the PDF could not scroll). A touch that starts on the
   * viewer asks the parents to leave it to the viewer until the finger lifts.
   */
  override fun dispatchTouchEvent(event: MotionEvent): Boolean {
    if (event.actionMasked == MotionEvent.ACTION_DOWN) parent?.requestDisallowInterceptTouchEvent(true)
    return super.dispatchTouchEvent(event)
  }

  // ── events → JS ──

  private fun emitSearch() {
    emit(SEARCH, Arguments.createMap().apply {
      putString("query", ui.query)
      putInt("total", ui.matches.size)
      putInt("current", if (ui.matches.isEmpty()) 0 else ui.current + 1)
    })
  }

  private fun emit(name: String, payload: WritableMap = Arguments.createMap()) {
    val surfaceId = UIManagerHelper.getSurfaceId(reactContext)
    UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)
      ?.dispatchEvent(PdfEvent(surfaceId, id, name, payload))
  }

  private class PdfEvent(
    surfaceId: Int,
    viewId: Int,
    private val name: String,
    private val payload: WritableMap,
  ) : Event<PdfEvent>(surfaceId, viewId) {
    override fun getEventName(): String = name
    override fun getEventData(): WritableMap = payload
  }

  companion object {
    const val LOAD = "topPdfLoad"
    const val PAGE = "topPdfPage"
    const val SEARCH = "topPdfSearch"
    const val ERROR = "topPdfError"
    const val PASSWORD = "topPdfPassword"
    const val LINK = "topPdfLink"
    const val FULLSCREEN = "topPdfFullscreen"
    const val READ_ALOUD = "topPdfReadAloud"
    const val PLAYLIST = "topPdfPlaylist"
    val EVENTS = listOf(LOAD, PAGE, SEARCH, ERROR, PASSWORD, LINK, FULLSCREEN, READ_ALOUD, PLAYLIST)
  }
}
