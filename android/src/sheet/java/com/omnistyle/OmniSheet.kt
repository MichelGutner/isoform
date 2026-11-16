package com.omnistyle

import android.view.View
import android.view.ViewGroup
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.roundToInt

/** One rest height of the sheet, in px, and its index in the JS `detents`. */
internal data class SheetAnchor(val height: Float, val source: Int)

/** Upward release speed (dp/s) that counts as a fling to the next detent. */
private const val FLING_DP = 600f

/** Space kept above the tallest sheet, below the status bar. */
private val TOP_GAP = 12.dp

/** Material 3's sheet corner radius. */
private val DEFAULT_RADIUS = 28.dp

/** Height of one detent in px: `fit` (content), `full`, `50%` or a number of dp. */
internal fun detentPx(raw: String, screen: Float, content: Float, density: Float): Float = when {
  raw == "full" -> screen
  raw == "fit" -> if (content > 0f) content else screen / 2f
  raw.endsWith("%") -> screen * (raw.dropLast(1).toFloatOrNull() ?: 100f) / 100f
  else -> (raw.toFloatOrNull() ?: 0f) * density
}.coerceIn(0f, screen)

/** The detents as anchors, smallest first. */
internal fun resolveAnchors(detents: List<String>, screen: Float, content: Float, density: Float): List<SheetAnchor> =
  detents.mapIndexed { source, raw -> SheetAnchor(detentPx(raw, screen, content, density), source) }.sortedBy { it.height }

/**
 * Anchor to rest at after a drag (same rule as the web and `settleDetent` in JS):
 * the nearest one, or the next one in the fling's direction.
 * @return the index into [heights], or `-1` to close.
 */
internal fun settleAnchor(heights: List<Float>, current: Float, upVelocityDp: Float, dismissible: Boolean): Int {
  if (upVelocityDp <= -FLING_DP) {
    val below = heights.indexOfLast { it < current - 1f }
    return if (below >= 0) below else if (dismissible) -1 else 0
  }
  if (upVelocityDp >= FLING_DP) {
    val above = heights.indexOfFirst { it > current + 1f }
    return if (above >= 0) above else heights.lastIndex
  }
  val options = if (dismissible) listOf(0f) + heights else heights
  val nearest = options.indices.minByOrNull { abs(options[it] - current) } ?: 0
  return if (dismissible) nearest - 1 else nearest
}

/**
 * The bottom sheet, drawn with Compose over the whole window:
 *  · a scrim that fades with the sheet (modal only; a tap closes it);
 *  · the sheet, dragged and snapped to the detents with a spring, under the system
 *    bars' insets and lifted by the keyboard;
 *  · the React children ([content]) inside it, sized to the content area.
 */
@Composable
internal fun OmniSheet(
  state: OmniSheetState,
  content: View,
  onDragStart: () -> Unit,
  onLayout: (width: Double, height: Double) -> Unit,
  onDismiss: () -> Unit,
  onClosed: () -> Unit,
  onDetent: (index: Int) -> Unit,
) {
  val density = LocalDensity.current
  val scope = rememberCoroutineScope()
  val dark = isSystemInDarkTheme()

  val visible = remember { Animatable(0f) }
  var resting by remember { mutableIntStateOf(state.detent) }
  var dismissing by remember { mutableStateOf(false) }
  var dragging by remember { mutableStateOf(false) }
  var shown by remember { mutableStateOf(false) }
  var smallest by remember { mutableStateOf(1f) }

  LaunchedEffect(state.detent) { resting = state.detent }
  LaunchedEffect(state.open) { if (state.open) dismissing = false }

  /** The user closes it: slide out, then JS is told (it sets `open` to false). */
  val dismiss = {
    if (state.dismissible && !dismissing) {
      dismissing = true
      onDismiss()
    }
  }

  Box(Modifier.fillMaxSize()) {
    if (state.modal) {
      Box(
        Modifier
          .fillMaxSize()
          // only the alpha follows the sheet: no recomposition per frame
          .graphicsLayer { alpha = (visible.value / smallest).coerceIn(0f, 1f) }
          .background(Color.Black.copy(alpha = 0.32f))
          .pointerInput(Unit) { detectTapGestures { dismiss() } }
          .semantics { contentDescription = "Close sheet" },
      )
    }

    BoxWithConstraints(Modifier.fillMaxSize().imePadding()) {
      val top = WindowInsets.statusBars.getTop(density)
      val bottom = WindowInsets.navigationBars.getBottom(density).toFloat()
      val screen = constraints.maxHeight - top - with(density) { TOP_GAP.toPx() }
      val contentPx = (state.contentHeight * density.density).toFloat()
      val fits = "fit" in state.detents
      val ready = !fits || state.contentHeight > 0

      val anchors = resolveAnchors(state.detents, screen.coerceAtLeast(1f), contentPx, density.density)
      val heights = anchors.map { it.height }
      val tallest = heights.maxOrNull() ?: 0f
      smallest = heights.firstOrNull { it > 0f } ?: 1f

      val target = if (state.open && ready && !dismissing) {
        anchors.firstOrNull { it.source == resting }?.height ?: heights.firstOrNull() ?: 0f
      } else {
        0f
      }

      // the area the React children are laid out to (JS sizes them from this)
      val width = with(density) { constraints.maxWidth.toDp().value.toDouble() }
      val area = with(density) { tallest.toDp().value.toDouble() }
      LaunchedEffect(width, area) { onLayout(width, area) }

      // open, close, move to another detent or follow the content's height
      LaunchedEffect(target, dragging) {
        if (dragging) return@LaunchedEffect
        if (target > 0f) shown = true
        visible.animateTo(target, spring(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = Spring.StiffnessMediumLow))
        if (target == 0f && shown) {
          shown = false
          onClosed()
        }
      }

      val drag = rememberDraggableState { delta ->
        scope.launch { visible.snapTo((visible.value - delta).coerceIn(0f, tallest)) }
      }

      val radius = if (state.cornerRadius >= 0) state.cornerRadius.dp else DEFAULT_RADIUS
      val shape = RoundedCornerShape(topStart = radius, topEnd = radius)
      val surface = state.color?.let { Color(it) } ?: if (dark) Color(0xFF1E1F23) else Color.White
      val panel = tallest + bottom

      Box(
        Modifier
          .align(Alignment.BottomCenter)
          .fillMaxWidth()
          .height(with(density) { panel.toDp() })
          // the navigation bar strip slides in with the sheet
          .offset { IntOffset(0, (panel - visible.value - bottom * (visible.value / smallest).coerceIn(0f, 1f)).roundToInt()) }
          .shadow(16.dp, shape, clip = false)
          .clip(shape)
          .background(surface)
          .draggable(
            state = drag,
            orientation = Orientation.Vertical,
            onDragStarted = {
              dragging = true
              onDragStart()
            },
            onDragStopped = { velocity ->
              val index = settleAnchor(heights, visible.value, -velocity / density.density, state.dismissible)
              if (index < 0) {
                dismiss()
              } else {
                val source = anchors[index].source
                if (source != resting) {
                  resting = source
                  onDetent(source)
                }
              }
              dragging = false
            },
          ),
      ) {
        AndroidView(
          factory = {
            // a recomposition after dispose would find it still attached to the old holder
            (content.parent as? ViewGroup)?.removeView(content)
            content
          },
          modifier = Modifier
            .fillMaxWidth()
            .height(with(density) { (if (fits) contentPx else tallest).toDp() }),
        )
        if (state.grabber) {
          Box(
            Modifier
              .align(Alignment.TopCenter)
              .padding(top = 10.dp)
              .size(width = 36.dp, height = 4.dp)
              .clip(CircleShape)
              .background(if (dark) Color.White.copy(alpha = 0.4f) else Color.Black.copy(alpha = 0.22f)),
          )
        }
      }
    }
  }
}
