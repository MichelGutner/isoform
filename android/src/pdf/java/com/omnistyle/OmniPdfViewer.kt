package com.omnistyle

import android.graphics.Bitmap
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.calculateCentroid
import androidx.compose.foundation.gestures.calculateZoom
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import kotlinx.coroutines.delay
import kotlin.math.sqrt

/**
 * Jetpack Compose viewer of the Android `Pdf`, colorless like the media players:
 *  · toolbar: thumbnails · page ("3 / 14", tap to go to a page) · read aloud · search · fullscreen · more;
 *  · pages: vertical scroll, pinch and double-tap zoom, links, night mode;
 *  · search bar: every match highlighted, "3 of 17", previous/next;
 *  · thumbnails strip, password prompt, loading and error states.
 * Search, links and read aloud only appear when the device can read the text
 * (`OmniPdfDocument.hasText`: Android 15+, or 12–14 with system updates).
 */

/** What the viewer shows instead of (or over) the pages. */
internal sealed interface PdfStatus {
  data object Ready : PdfStatus
  data object Loading : PdfStatus
  data class Error(val message: String) : PdfStatus
  data class Locked(val wrong: Boolean) : PdfStatus
}

/** A request to scroll to a place: a page and a vertical position inside it (fraction from `0` to `1`). */
internal data class PdfScroll(val page: Int, val fraction: Float = 0f, val id: Long = System.nanoTime())

/** State read by the viewer (written by `OmniPdfView` and by the viewer itself). */
internal class OmniPdfUiState {
  var document by mutableStateOf<OmniPdfDocument?>(null)
  var status by mutableStateOf<PdfStatus>(PdfStatus.Loading)
  var controls by mutableStateOf(true)
  var nightMode by mutableStateOf(false)
  var fit by mutableStateOf("width")
  /** `"vertical"` (one under the other) or `"horizontal"` (side by side, one page per screen). */
  var direction by mutableStateOf("vertical")
  var maxZoom by mutableFloatStateOf(5f)
  var zoom by mutableFloatStateOf(1f)
  var page by mutableIntStateOf(0)
  var thumbnails by mutableStateOf(false)
  var searchOpen by mutableStateOf(false)
  var query by mutableStateOf("")
  var matches by mutableStateOf<List<OmniPdfMatch>>(emptyList())
  var current by mutableIntStateOf(0)
  var searching by mutableStateOf(false)
  var reading by mutableStateOf(false)
  var readingPage by mutableStateOf<Int?>(null)
  var fullscreen by mutableStateOf(false)
  var scroll by mutableStateOf<PdfScroll?>(null)
  /** Voices of the read-aloud language, most natural first. */
  var voices by mutableStateOf<List<PdfVoice>>(emptyList())
  /** The chosen voice (`null` = the most natural one). */
  var voice by mutableStateOf<String?>(null)
  /** List (`items`): current position and size; the playlist button only shows with `playlistCount > 0`. */
  var playlistIndex by mutableIntStateOf(-1)
  var playlistCount by mutableIntStateOf(0)
}

/** What the viewer asks `OmniPdfView` to do. */
internal class OmniPdfActions(
  val pageChanged: (Int) -> Unit,
  val search: (String) -> Unit,
  val next: () -> Unit,
  val previous: () -> Unit,
  val closeSearch: () -> Unit,
  val link: (OmniPdfLink) -> Unit,
  val password: (String) -> Unit,
  val toggleRead: () -> Unit,
  val setFullscreen: (Boolean) -> Unit,
  val selectVoice: (String?) -> Unit,
  val openPlaylist: () -> Unit,
)

private class PdfColors(
  val bar: Color,
  val text: Color,
  val muted: Color,
  val canvas: Color,
  val field: Color,
  val divider: Color,
  val menu: Color,
) {
  companion object {
    val Light = PdfColors(Color.White, Color(0xFF1C1C1E), Color(0xFF6E6E73), Color(0xFFECECF0), Color(0x1F787880), Color(0x1A000000), Color.White)
    val Dark = PdfColors(Color(0xFF1C1C1E), Color.White, Color(0xFF98989F), Color(0xFF0F0F10), Color(0x3D767680), Color(0x1FFFFFFF), Color(0xFF2C2C2E))
  }
}

private val MATCH = Color(0x73FFCC00)
private val CURRENT = Color(0xBFFF9500)
private val READING = Color(0x332E7DFF)
private const val PAD_DP = 12
private const val GAP_DP = 10

/** Inverted colors (night mode): `255 − value` for red, green and blue. */
private val INVERT = ColorFilter.colorMatrix(
  ColorMatrix(floatArrayOf(-1f, 0f, 0f, 0f, 255f, 0f, -1f, 0f, 0f, 255f, 0f, 0f, -1f, 0f, 255f, 0f, 0f, 0f, 1f, 0f)),
)

/** Largest page bitmap, in pixels (8 MP keeps memory sane on old devices). */
private const val MAX_PIXELS = 8_000_000f

@Composable
internal fun OmniPdfViewer(state: OmniPdfUiState, actions: OmniPdfActions) {
  val colors = if (isSystemInDarkTheme()) PdfColors.Dark else PdfColors.Light
  if (state.fullscreen) {
    Box(Modifier.fillMaxSize().background(colors.canvas))
    Dialog(
      onDismissRequest = { actions.setFullscreen(false) },
      properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
      // the dialog is edge to edge: the toolbar color goes behind the status bar, the
      // content stays inside the safe area (status bar, navigation bar, notch)
      Box(Modifier.fillMaxSize().background(colors.bar).windowInsetsPadding(WindowInsets.safeDrawing)) {
        ViewerBody(state, actions, colors)
      }
    }
    return
  }
  ViewerBody(state, actions, colors)
}

@Composable
private fun ViewerBody(state: OmniPdfUiState, actions: OmniPdfActions, colors: PdfColors) {
  val doc = state.document
  Column(Modifier.fillMaxSize().background(colors.canvas)) {
    if (state.controls && doc != null) {
      if (state.searchOpen) SearchBar(state, actions, colors) else Toolbar(state, doc, actions, colors)
    }
    Box(Modifier.weight(1f).fillMaxWidth()) {
      if (doc != null) PagesFor(state, doc, actions)
      StatusOverlay(state.status, actions, colors)
    }
    if (state.thumbnails && doc != null) Thumbnails(state, doc, colors)
  }
}

// ── toolbar ──

@Composable
private fun IconButton(icon: PdfIcon, description: String, color: Color, enabled: Boolean = true, selected: Boolean = false, onClick: () -> Unit) {
  Box(
    modifier = Modifier
      .size(40.dp)
      .clip(CircleShape)
      .background(if (selected) color.copy(alpha = 0.1f) else Color.Transparent)
      .clickable(enabled = enabled, onClick = onClick)
      .semantics { contentDescription = description },
    contentAlignment = Alignment.Center,
  ) { PdfIconImage(icon, if (enabled) color else color.copy(alpha = 0.35f)) }
}

@Composable
private fun Toolbar(state: OmniPdfUiState, doc: OmniPdfDocument, actions: OmniPdfActions, colors: PdfColors) {
  var askPage by remember { mutableStateOf(false) }
  var menu by remember { mutableStateOf(false) }
  Row(
    modifier = Modifier.fillMaxWidth().height(50.dp).background(colors.bar).padding(horizontal = 6.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    IconButton(PdfIcon.Pages, "Pages", colors.text, selected = state.thumbnails) { state.thumbnails = !state.thumbnails }
    Spacer(Modifier.width(4.dp))
    BasicText(
      text = "${state.page + 1} / ${doc.pageCount}",
      style = TextStyle(color = colors.text, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, fontFeatureSettings = "tnum"),
      modifier = Modifier
        .clip(RoundedCornerShape(50))
        .background(colors.field)
        .clickable { askPage = true }
        .padding(horizontal = 12.dp, vertical = 6.dp),
    )
    Spacer(Modifier.weight(1f))
    if (doc.hasText) {
      IconButton(if (state.reading) PdfIcon.Stop else PdfIcon.Speaker, if (state.reading) "Stop reading" else "Read aloud", colors.text, onClick = actions.toggleRead)
      IconButton(PdfIcon.Search, "Search", colors.text) { state.searchOpen = true }
    }
    if (state.playlistCount > 0) {
      BasicText(
        text = "☰ ${state.playlistIndex + 1}/${state.playlistCount}",
        style = TextStyle(color = colors.text, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, fontFeatureSettings = "tnum"),
        modifier = Modifier
          .clip(RoundedCornerShape(50))
          .clickable(onClick = actions.openPlaylist)
          .padding(horizontal = 10.dp, vertical = 8.dp)
          .semantics { contentDescription = "Playlist, item ${state.playlistIndex + 1} of ${state.playlistCount}" },
      )
    }
    IconButton(if (state.fullscreen) PdfIcon.ExitFullscreen else PdfIcon.Fullscreen, if (state.fullscreen) "Exit fullscreen" else "Fullscreen", colors.text) {
      actions.setFullscreen(!state.fullscreen)
    }
    Box {
      IconButton(PdfIcon.More, "More", colors.text) { menu = true }
      if (menu) MoreMenu(state, actions, colors) { menu = false }
    }
  }
  Box(Modifier.fillMaxWidth().height(1.dp).background(colors.divider))
  if (askPage) GoToPageDialog(doc.pageCount, colors, onGo = { state.scroll = PdfScroll(it - 1) }) { askPage = false }
}

@Composable
private fun MoreMenu(state: OmniPdfUiState, actions: OmniPdfActions, colors: PdfColors, close: () -> Unit) {
  val offset = with(LocalDensity.current) { IntOffset(0, 44.dp.roundToPx()) }
  var voices by remember { mutableStateOf(false) }
  Popup(alignment = Alignment.TopEnd, offset = offset, onDismissRequest = close, properties = PopupProperties(focusable = true)) {
    if (voices) return@Popup VoiceMenu(state, actions, colors, close)
    Column(
      Modifier.width(220.dp).shadow(16.dp, RoundedCornerShape(14.dp)).clip(RoundedCornerShape(14.dp)).background(colors.menu).padding(6.dp),
    ) {
      if (state.voices.isNotEmpty()) {
        MenuRow(PdfIcon.Speaker, "Voice", false, colors) { voices = true }
        Box(Modifier.fillMaxWidth().padding(vertical = 4.dp).height(1.dp).background(colors.divider))
      }
      MenuRow(PdfIcon.Moon, "Night mode", state.nightMode, colors) { state.nightMode = !state.nightMode; close() }
      MenuRow(PdfIcon.Pages, "Horizontal pages", state.direction == "horizontal", colors) {
        state.direction = if (state.direction == "horizontal") "vertical" else "horizontal"
        state.zoom = 1f
        // stay on the same page after the switch
        state.scroll = PdfScroll(state.page)
        close()
      }
      Box(Modifier.fillMaxWidth().padding(vertical = 4.dp).height(1.dp).background(colors.divider))
      MenuRow(PdfIcon.FitWidth, "Fit width", state.fit == "width", colors) { state.fit = "width"; state.zoom = 1f; close() }
      MenuRow(PdfIcon.FitPage, "Fit page", state.fit == "page", colors) { state.fit = "page"; state.zoom = 1f; close() }
    }
  }
}

/** The voices of the read-aloud language, most natural first; "Automatic" picks the best one. */
@Composable
private fun VoiceMenu(state: OmniPdfUiState, actions: OmniPdfActions, colors: PdfColors, close: () -> Unit) {
  val pick = { name: String? ->
    actions.selectVoice(name)
    close()
  }
  LazyColumn(
    Modifier.width(260.dp).height(320.dp).shadow(16.dp, RoundedCornerShape(14.dp)).clip(RoundedCornerShape(14.dp)).background(colors.menu).padding(6.dp),
  ) {
    item {
      BasicText("VOICE", Modifier.padding(horizontal = 10.dp, vertical = 6.dp), style = TextStyle(color = colors.muted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold))
      MenuRow(PdfIcon.Speaker, "Automatic (most natural)", state.voice == null, colors) { pick(null) }
    }
    itemsIndexed(state.voices, key = { _, voice -> voice.name }) { _, voice ->
      MenuRow(PdfIcon.Speaker, voice.label, state.voice == voice.name, colors) { pick(voice.name) }
    }
  }
}

@Composable
private fun MenuRow(icon: PdfIcon, label: String, checked: Boolean, colors: PdfColors, onClick: () -> Unit) {
  Row(
    Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).clickable(onClick = onClick).padding(horizontal = 10.dp, vertical = 9.dp),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(10.dp),
  ) {
    PdfIconImage(icon, colors.text, 18)
    BasicText(label, Modifier.weight(1f), style = TextStyle(color = colors.text, fontSize = 14.sp))
    if (checked) PdfIconImage(PdfIcon.Check, colors.text, 16)
  }
}

@Composable
private fun GoToPageDialog(pageCount: Int, colors: PdfColors, onGo: (Int) -> Unit, close: () -> Unit) {
  var text by remember { mutableStateOf("") }
  val focus = remember { FocusRequester() }
  val go = {
    text.toIntOrNull()?.let { onGo(it.coerceIn(1, pageCount)) }
    close()
  }
  Dialog(onDismissRequest = close) {
    Column(
      Modifier.width(260.dp).clip(RoundedCornerShape(16.dp)).background(colors.menu).padding(18.dp),
      verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
      BasicText("Go to page", style = TextStyle(color = colors.text, fontSize = 16.sp, fontWeight = FontWeight.SemiBold))
      Field(text, "1–$pageCount", colors, Modifier.focusRequester(focus), KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Go), KeyboardActions(onGo = { go() })) {
        text = it.filter(Char::isDigit)
      }
      Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
        TextButton("Cancel", colors.muted, close)
        TextButton("Go", colors.text) { go() }
      }
    }
  }
  LaunchedEffect(Unit) { focus.requestFocus() }
}

@Composable
private fun TextButton(label: String, color: Color, onClick: () -> Unit) {
  BasicText(
    label,
    Modifier.clip(RoundedCornerShape(8.dp)).clickable(onClick = onClick).padding(horizontal = 12.dp, vertical = 8.dp),
    style = TextStyle(color = color, fontSize = 14.sp, fontWeight = FontWeight.SemiBold),
  )
}

/** A rounded text field with a placeholder. */
@Composable
private fun Field(
  value: String,
  placeholder: String,
  colors: PdfColors,
  modifier: Modifier = Modifier,
  keyboard: KeyboardOptions = KeyboardOptions.Default,
  keyboardActions: KeyboardActions = KeyboardActions.Default,
  secret: Boolean = false,
  onChange: (String) -> Unit,
) {
  BasicTextField(
    value = value,
    onValueChange = onChange,
    singleLine = true,
    textStyle = TextStyle(color = colors.text, fontSize = 15.sp),
    cursorBrush = SolidColor(colors.text),
    keyboardOptions = keyboard,
    keyboardActions = keyboardActions,
    visualTransformation = if (secret) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
    modifier = modifier,
    decorationBox = { inner ->
      Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(colors.field).padding(horizontal = 12.dp, vertical = 10.dp)) {
        if (value.isEmpty()) BasicText(placeholder, style = TextStyle(color = colors.muted, fontSize = 15.sp))
        inner()
      }
    },
  )
}

// ── search bar ──

/** "3 of 17", "No results" or "…" while searching. */
private fun countLabel(state: OmniPdfUiState): String = when {
  state.query.isBlank() -> ""
  state.matches.isNotEmpty() -> "${state.current + 1} of ${state.matches.size}" + if (state.searching) "…" else ""
  state.searching -> "…"
  else -> "No results"
}

@Composable
private fun SearchBar(state: OmniPdfUiState, actions: OmniPdfActions, colors: PdfColors) {
  val focus = remember { FocusRequester() }
  Row(
    modifier = Modifier.fillMaxWidth().height(50.dp).background(colors.bar).padding(start = 10.dp, end = 6.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Row(
      Modifier.weight(1f).clip(RoundedCornerShape(10.dp)).background(colors.field).padding(horizontal = 10.dp, vertical = 8.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
      PdfIconImage(PdfIcon.Search, colors.muted, 18)
      BasicTextField(
        value = state.query,
        onValueChange = actions.search,
        singleLine = true,
        textStyle = TextStyle(color = colors.text, fontSize = 15.sp),
        cursorBrush = SolidColor(colors.text),
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        keyboardActions = KeyboardActions(onSearch = { actions.next() }),
        modifier = Modifier.weight(1f).focusRequester(focus),
        decorationBox = { inner ->
          Box {
            if (state.query.isEmpty()) BasicText("Search", style = TextStyle(color = colors.muted, fontSize = 15.sp))
            inner()
          }
        },
      )
      BasicText(countLabel(state), style = TextStyle(color = colors.muted, fontSize = 12.sp, fontFeatureSettings = "tnum"))
    }
    IconButton(PdfIcon.Up, "Previous match", colors.text, enabled = state.matches.isNotEmpty(), onClick = actions.previous)
    IconButton(PdfIcon.Down, "Next match", colors.text, enabled = state.matches.isNotEmpty(), onClick = actions.next)
    IconButton(PdfIcon.Close, "Close search", colors.text, onClick = actions.closeSearch)
  }
  Box(Modifier.fillMaxWidth().height(1.dp).background(colors.divider))
  LaunchedEffect(Unit) { focus.requestFocus() }
}

// ── pages ──

/** Zoom kept around a point: applied after the next layout, when the pages have their new size. */
private data class ZoomAnchor(val ratio: Float, val x: Float, val y: Float)

/** One under the other, or side by side. */
@Composable
private fun PagesFor(state: OmniPdfUiState, doc: OmniPdfDocument, actions: OmniPdfActions) {
  val layouts = mapOf<String, @Composable () -> Unit>(
    "horizontal" to { HorizontalPages(state, doc, actions) },
    "vertical" to { Pages(state, doc, actions) },
  )
  (layouts[state.direction] ?: layouts.getValue("vertical"))()
}

/**
 * Side by side, like a book: every page fits the screen (zoom 1) and the scroll stops
 * on each one. Pinch and double tap zoom; zoomed in, the page can be moved around.
 */
@Composable
private fun HorizontalPages(state: OmniPdfUiState, doc: OmniPdfDocument, actions: OmniPdfActions) {
  BoxWithConstraints(Modifier.fillMaxSize()) {
    val density = LocalDensity.current
    val viewportW = constraints.maxWidth.toFloat()
    val viewportH = constraints.maxHeight.toFloat()
    val pad = with(density) { PAD_DP.dp.toPx() }
    val widest = doc.sizes.maxOf { it.first }.toFloat().coerceAtLeast(1f)
    val tallest = doc.sizes.maxOf { it.second }.toFloat().coerceAtLeast(1f)
    val base = minOf((viewportW - pad * 2) / widest, (viewportH - pad * 2) / tallest)
    val scale = base * state.zoom
    val contentH = tallest * scale + pad * 2

    val row = rememberLazyListState()
    val vertical = rememberScrollState()
    var anchor by remember { mutableStateOf<ZoomAnchor?>(null) }
    var renderZoom by remember { mutableFloatStateOf(state.zoom) }
    LaunchedEffect(state.zoom) {
      delay(180)
      renderZoom = state.zoom
    }

    fun zoomBy(change: Float, focal: Offset) {
      val next = (state.zoom * change).coerceIn(1f, state.maxZoom)
      if (next == state.zoom) return
      anchor = ZoomAnchor((anchor?.ratio ?: 1f) * next / state.zoom, focal.x, focal.y)
      state.zoom = next
    }

    LaunchedEffect(scale) {
      val pending = anchor ?: return@LaunchedEffect
      anchor = null
      vertical.scrollTo(((vertical.value + pending.y) * pending.ratio - pending.y).toInt().coerceAtLeast(0))
      row.scrollBy((row.firstVisibleItemScrollOffset + pending.x) * (pending.ratio - 1f))
    }

    LaunchedEffect(state.scroll) {
      val request = state.scroll ?: return@LaunchedEffect
      row.scrollToItem(request.page.coerceIn(0, doc.pageCount - 1))
      if (request.fraction > 0f) vertical.scrollTo((doc.sizes[request.page].second * scale * request.fraction - viewportH / 3f).toInt().coerceAtLeast(0))
    }

    // the page crossing the middle of the screen is the current one
    LaunchedEffect(row, doc) {
      snapshotFlow {
        val middle = viewportW / 2f
        row.layoutInfo.visibleItemsInfo.lastOrNull { it.offset <= middle }?.index ?: row.firstVisibleItemIndex
      }.collect(actions.pageChanged)
    }

    // one page at a time at zoom 1; free movement when zoomed in
    val snap = rememberSnapFlingBehavior(lazyListState = row)
    val zoomed = state.zoom > 1.01f

    Box(
      Modifier
        .fillMaxSize()
        .pointerInput(Unit) {
          awaitEachGesture {
            awaitFirstDown(requireUnconsumed = false)
            do {
              val event = awaitPointerEvent(PointerEventPass.Initial)
              if (event.changes.count { it.pressed } >= 2) {
                zoomBy(event.calculateZoom(), event.calculateCentroid(useCurrent = true))
                event.changes.forEach { it.consume() }
              }
            } while (event.changes.any { it.pressed })
          }
        }
        .verticalScroll(vertical, enabled = contentH > viewportH),
    ) {
      LazyRow(
        state = row,
        flingBehavior = if (zoomed) androidx.compose.foundation.gestures.ScrollableDefaults.flingBehavior() else snap,
        modifier = Modifier.height(with(density) { maxOf(contentH, viewportH).toDp() }).fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        itemsIndexed(doc.sizes, key = { index, _ -> index }) { index, size ->
          val pageW = size.first * scale
          // each page gets at least a screen of room, so it sits alone in the middle
          Box(Modifier.width(with(density) { maxOf(pageW + pad * 2, viewportW).toDp() }), contentAlignment = Alignment.Center) {
            PageItem(
              doc = doc,
              index = index,
              widthPx = pageW,
              heightPx = size.second * scale,
              renderScale = base * renderZoom,
              night = state.nightMode,
              matches = state.matches,
              current = state.matches.getOrNull(state.current),
              reading = state.readingPage == index,
              onDoubleTap = { focal -> zoomBy(if (state.zoom > 1.01f) 1f / state.zoom else 2.5f, focal) },
              onLink = actions.link,
            )
          }
        }
      }
    }
  }
}

@Composable
private fun Pages(state: OmniPdfUiState, doc: OmniPdfDocument, actions: OmniPdfActions) {
  BoxWithConstraints(Modifier.fillMaxSize()) {
    val density = LocalDensity.current
    val viewportW = constraints.maxWidth.toFloat()
    val viewportH = constraints.maxHeight.toFloat()
    val pad = with(density) { PAD_DP.dp.toPx() }
    val widest = doc.sizes.maxOf { it.first }.toFloat().coerceAtLeast(1f)
    val tallest = doc.sizes.maxOf { it.second }.toFloat().coerceAtLeast(1f)
    val byWidth = (viewportW - pad * 2) / widest
    val base = if (state.fit == "page") minOf(byWidth, (viewportH - pad * 2) / tallest) else byWidth
    // pixels per point
    val scale = base * state.zoom
    val contentW = widest * scale + pad * 2

    val list = rememberLazyListState()
    val horizontal = rememberScrollState()
    val scope = rememberCoroutineScope()
    var anchor by remember { mutableStateOf<ZoomAnchor?>(null) }
    // pages are drawn again at the new size once the zoom settles (meanwhile the old bitmap is stretched)
    var renderZoom by remember { mutableFloatStateOf(state.zoom) }
    LaunchedEffect(state.zoom) {
      delay(180)
      renderZoom = state.zoom
    }

    fun zoomBy(change: Float, focal: Offset) {
      val next = (state.zoom * change).coerceIn(1f, state.maxZoom)
      if (next == state.zoom) return
      val previous = anchor?.ratio ?: 1f
      anchor = ZoomAnchor(previous * next / state.zoom, focal.x, focal.y)
      state.zoom = next
    }

    LaunchedEffect(scale) {
      val pending = anchor ?: return@LaunchedEffect
      anchor = null
      horizontal.scrollTo(((horizontal.value + pending.x) * pending.ratio - pending.x).toInt().coerceAtLeast(0))
      list.scrollBy((list.firstVisibleItemScrollOffset + pending.y) * (pending.ratio - 1f))
    }

    // scroll requests (go to page, search matches, links, read aloud)
    LaunchedEffect(state.scroll) {
      val request = state.scroll ?: return@LaunchedEffect
      val target = request.page.coerceIn(0, doc.pageCount - 1)
      list.scrollToItem(target)
      val height = doc.sizes[target].second * scale
      if (request.fraction > 0f) list.scrollBy(height * request.fraction - viewportH / 3f)
    }

    // the page crossing 40% of the screen is the current one
    LaunchedEffect(list, doc) {
      snapshotFlow {
        val line = viewportH * 0.4f
        list.layoutInfo.visibleItemsInfo.lastOrNull { it.offset <= line }?.index ?: list.firstVisibleItemIndex
      }.collect(actions.pageChanged)
    }

    Box(
      Modifier
        .fillMaxSize()
        .pointerInput(Unit) {
          // two fingers zoom (and are consumed before the list sees them); one finger scrolls
          awaitEachGesture {
            awaitFirstDown(requireUnconsumed = false)
            do {
              val event = awaitPointerEvent(PointerEventPass.Initial)
              val fingers = event.changes.count { it.pressed }
              if (fingers >= 2) {
                zoomBy(event.calculateZoom(), event.calculateCentroid(useCurrent = true))
                event.changes.forEach { it.consume() }
              }
            } while (event.changes.any { it.pressed })
          }
        }
        .horizontalScroll(horizontal, enabled = contentW > viewportW),
    ) {
      LazyColumn(
        state = list,
        modifier = Modifier.width(with(density) { maxOf(contentW, viewportW).toDp() }).fillMaxHeight(),
        contentPadding = PaddingValues(vertical = PAD_DP.dp),
        verticalArrangement = Arrangement.spacedBy(GAP_DP.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
      ) {
        itemsIndexed(doc.sizes, key = { index, _ -> index }) { index, size ->
          PageItem(
            doc = doc,
            index = index,
            widthPx = size.first * scale,
            heightPx = size.second * scale,
            renderScale = base * renderZoom,
            night = state.nightMode,
            matches = state.matches,
            current = state.matches.getOrNull(state.current),
            reading = state.readingPage == index,
            onDoubleTap = { focal -> zoomBy(if (state.zoom > 1.01f) 1f / state.zoom else 2.5f, focal) },
            onLink = actions.link,
          )
        }
      }
    }
  }
}

/** One page: its bitmap, the search highlights and the link areas. */
@Composable
private fun PageItem(
  doc: OmniPdfDocument,
  index: Int,
  widthPx: Float,
  heightPx: Float,
  renderScale: Float,
  night: Boolean,
  matches: List<OmniPdfMatch>,
  current: OmniPdfMatch?,
  reading: Boolean,
  onDoubleTap: (Offset) -> Unit,
  onLink: (OmniPdfLink) -> Unit,
) {
  val density = LocalDensity.current
  val (pageW, pageH) = doc.sizes[index]
  // bitmap width: the drawn size, limited to MAX_PIXELS and rounded (so small zoom changes reuse the cache)
  val limit = sqrt(MAX_PIXELS * pageW / pageH)
  val renderWidth = (minOf(pageW * renderScale, limit) / 64f).toInt().coerceAtLeast(1) * 64
  val bitmap by produceState<Bitmap?>(null, doc, index, renderWidth) { value = doc.render(index, renderWidth) }
  val links by produceState(emptyList<OmniPdfLink>(), doc, index) { value = if (doc.hasText) doc.links(index) else emptyList() }
  val pageMatches = remember(matches, index) { matches.filter { it.page == index } }
  val toPx = widthPx / pageW

  Box(
    Modifier
      .size(with(density) { widthPx.toDp() }, with(density) { heightPx.toDp() })
      .shadow(2.dp, RoundedCornerShape(2.dp))
      .background(if (night) Color.Black else Color.White)
      .then(if (reading) Modifier.border(2.dp, READING.copy(alpha = 0.6f)) else Modifier)
      .pointerInput(doc, index, links) {
        detectTapGestures(
          onDoubleTap = { onDoubleTap(it) },
          onTap = { tap ->
            val x = tap.x / toPx
            val y = tap.y / toPx
            links.firstOrNull { link -> link.bounds.any { it.contains(x, y) } }?.let(onLink)
          },
        )
      },
  ) {
    bitmap?.let {
      Image(
        bitmap = it.asImageBitmap(),
        contentDescription = "Page ${index + 1}",
        contentScale = ContentScale.FillBounds,
        colorFilter = if (night) INVERT else null,
        modifier = Modifier.fillMaxSize(),
      )
    }
    if (pageMatches.isNotEmpty()) {
      Canvas(Modifier.fillMaxSize()) {
        pageMatches.forEach { match ->
          val color = if (match == current) CURRENT else MATCH
          match.bounds.forEach { r ->
            drawRect(color, Offset(r.left * toPx, r.top * toPx), Size(r.width() * toPx, r.height() * toPx))
          }
        }
      }
    }
  }
}

// ── thumbnails ──

@Composable
private fun Thumbnails(state: OmniPdfUiState, doc: OmniPdfDocument, colors: PdfColors) {
  val density = LocalDensity.current
  val thumbWidth = with(density) { 48.dp.roundToPx() }
  val row = rememberLazyListState()
  LaunchedEffect(state.page) { row.animateScrollToItem((state.page - 2).coerceAtLeast(0)) }
  Box(Modifier.fillMaxWidth().height(1.dp).background(colors.divider))
  LazyRow(
    state = row,
    modifier = Modifier.fillMaxWidth().height(92.dp).background(colors.bar),
    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
    horizontalArrangement = Arrangement.spacedBy(10.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    itemsIndexed(doc.sizes, key = { index, _ -> index }) { index, (w, h) ->
      val bitmap by produceState<Bitmap?>(null, doc, index) { value = doc.render(index, thumbWidth * 2) }
      val selected = index == state.page
      Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(
          Modifier
            .size(48.dp, (48f * h / w).dp.coerceAtMost(60.dp))
            .border(2.dp, if (selected) colors.text else Color.Transparent, RoundedCornerShape(3.dp))
            .padding(2.dp)
            .clip(RoundedCornerShape(2.dp))
            .background(if (state.nightMode) Color.Black else Color.White)
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { state.scroll = PdfScroll(index) },
        ) {
          bitmap?.let {
            Image(it.asImageBitmap(), "Page ${index + 1}", Modifier.fillMaxSize(), contentScale = ContentScale.Fit, colorFilter = if (state.nightMode) INVERT else null)
          }
        }
        BasicText("${index + 1}", style = TextStyle(color = if (selected) colors.text else colors.muted, fontSize = 11.sp, fontFeatureSettings = "tnum"))
      }
    }
  }
}

// ── status ──

@Composable
private fun StatusOverlay(status: PdfStatus, actions: OmniPdfActions, colors: PdfColors) {
  when (status) {
    PdfStatus.Ready -> Unit
    PdfStatus.Loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Spinner(colors.text) }
    is PdfStatus.Error -> Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
      BasicText(status.message, style = TextStyle(color = Color(0xFFFF453A), fontSize = 14.sp, textAlign = TextAlign.Center))
    }
    is PdfStatus.Locked -> LockedPrompt(status.wrong, actions, colors)
  }
}

@Composable
private fun Spinner(color: Color) {
  val sweep = remember { androidx.compose.animation.core.Animatable(0f) }
  LaunchedEffect(Unit) {
    while (true) {
      sweep.animateTo(360f, androidx.compose.animation.core.tween(800, easing = androidx.compose.animation.core.LinearEasing))
      sweep.snapTo(0f)
    }
  }
  Canvas(Modifier.size(28.dp)) {
    drawArc(color.copy(alpha = 0.2f), 0f, 360f, false, style = androidx.compose.ui.graphics.drawscope.Stroke(3.dp.toPx()))
    drawArc(color, sweep.value, 90f, false, style = androidx.compose.ui.graphics.drawscope.Stroke(3.dp.toPx(), cap = androidx.compose.ui.graphics.StrokeCap.Round))
  }
}

@Composable
private fun LockedPrompt(wrong: Boolean, actions: OmniPdfActions, colors: PdfColors) {
  var password by remember { mutableStateOf("") }
  Column(
    Modifier.fillMaxSize().background(colors.canvas).padding(24.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
  ) {
    PdfIconImage(PdfIcon.Lock, colors.text, 32)
    BasicText(
      if (wrong) "Wrong password. Try again." else "This document is protected.",
      style = TextStyle(color = if (wrong) Color(0xFFFF453A) else colors.muted, fontSize = 14.sp, textAlign = TextAlign.Center),
    )
    Row(Modifier.width(300.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      Field(
        password,
        "Password",
        colors,
        Modifier.weight(1f),
        KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Go),
        KeyboardActions(onGo = { actions.password(password) }),
        secret = true,
      ) { password = it }
      BasicText(
        "Open",
        Modifier.clip(RoundedCornerShape(10.dp)).background(colors.text).clickable { actions.password(password) }.padding(horizontal = 14.dp, vertical = 10.dp),
        style = TextStyle(color = colors.canvas, fontSize = 14.sp, fontWeight = FontWeight.SemiBold),
      )
    }
  }
}
