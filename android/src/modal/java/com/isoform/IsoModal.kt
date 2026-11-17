package com.isoform

import android.view.View
import android.view.ViewGroup
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutLinearInEasing
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView

/** Space kept around a dialog (`DIALOG_MARGIN` in JS). */
private val DIALOG_MARGIN = 24.dp

/** Default dialog corner radius (`DIALOG_RADIUS` in JS). */
private const val DIALOG_RADIUS = 20f

/** Default card color: white, or the dark elevated gray in dark mode (the same as iOS). */
private val LIGHT_SURFACE = Color.White
private val DARK_SURFACE = Color(0xFF1C1C1E)

/**
 * The modal, drawn with Compose over the whole window (the same design as iOS):
 *  · a backdrop that fades in (dialog; a tap closes it);
 *  · the card — centered and as tall as its content (dialog) or the whole screen with the
 *    content in the safe area (full screen) — kept above the keyboard;
 *  · the React children ([content]) inside it, sized to the content area;
 *  · enter/exit animations: scale (from 92%), slide (from the bottom), fade or none.
 */
@Composable
internal fun IsoModal(
  state: IsoModalState,
  content: View,
  onLayout: (width: Double, height: Double) -> Unit,
  onDismiss: () -> Unit,
  onClosed: () -> Unit,
) {
  val density = LocalDensity.current
  val dark = isSystemInDarkTheme()
  val progress = remember { Animatable(0f) }
  var shown by remember { mutableStateOf(false) }
  var dismissing by remember { mutableStateOf(false) }
  val dialog = state.presentation != "fullScreen"
  val ready = !dialog || state.contentHeight > 0
  val target = if (state.open && ready && !dismissing) 1f else 0f

  LaunchedEffect(state.open) { if (state.open) dismissing = false }

  LaunchedEffect(target) {
    if (target > 0f) shown = true
    when {
      state.animation == "none" -> progress.snapTo(target)
      target > 0f -> progress.animateTo(1f, spring(dampingRatio = 0.86f, stiffness = 380f))
      else -> progress.animateTo(0f, tween(220, easing = FastOutLinearInEasing))
    }
    if (target == 0f && shown) {
      shown = false
      onClosed()
    }
  }

  /** The user closes it: JS is told (it sets `open` to false, and the card animates out). */
  val dismiss = {
    if (state.dismissible && !dismissing) {
      dismissing = true
      onDismiss()
    }
  }

  val surface = state.surface?.let { Color(it) } ?: if (dark) DARK_SURFACE else LIGHT_SURFACE
  val radius = if (state.cornerRadius >= 0) state.cornerRadius.toFloat() else DIALOG_RADIUS

  Box(Modifier.fillMaxSize()) {
    if (dialog) {
      Box(
        Modifier
          .fillMaxSize()
          // only the alpha follows the animation: no recomposition per frame
          .graphicsLayer { alpha = progress.value.coerceIn(0f, 1f) }
          .background(state.backdrop?.let { Color(it) } ?: Color.Black.copy(alpha = 0.4f))
          .pointerInput(Unit) { detectTapGestures { dismiss() } }
          .semantics { contentDescription = "Close" },
      )
    }

    /** How the card is moved for the animation (`p` from 0 hidden to 1 shown). */
    val animated = Modifier.graphicsLayer {
      val p = progress.value
      when (state.animation) {
        "scale" -> {
          val s = 0.92f + 0.08f * p
          scaleX = s
          scaleY = s
          alpha = p.coerceIn(0f, 1f)
        }
        "slide" -> translationY = (1f - p) * size.height
        "fade" -> alpha = p.coerceIn(0f, 1f)
        else -> Unit
      }
    }

    if (dialog) {
      BoxWithConstraints(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing.union(WindowInsets.ime)).padding(DIALOG_MARGIN)) {
        val widthDp = minOf(maxWidth.value, state.maxWidth.toFloat())
        val tallestDp = maxHeight.value
        val heightDp = if (state.contentHeight > 0) minOf(state.contentHeight.toFloat(), tallestDp) else tallestDp
        LaunchedEffect(widthDp, tallestDp) { onLayout(widthDp.toDouble(), tallestDp.toDouble()) }
        val shape = RoundedCornerShape(radius.dp)
        Box(
          Modifier
            .align(Alignment.Center)
            .size(widthDp.dp, heightDp.dp)
            .then(animated)
            .shadow(24.dp, shape, clip = false)
            .clip(shape)
            .background(surface)
            // taps on the card do not reach the backdrop
            .pointerInput(Unit) { detectTapGestures { } },
        ) {
          ModalContent(content, Modifier.fillMaxSize())
        }
      }
    } else {
      Box(Modifier.fillMaxSize().then(animated).background(surface, RectangleShape)) {
        ModalContent(
          content,
          Modifier
            .fillMaxSize()
            .windowInsetsPadding(WindowInsets.safeDrawing.union(WindowInsets.ime))
            .onSizeChanged { size ->
              with(density) { onLayout(size.width.toDp().value.toDouble(), size.height.toDp().value.toDouble()) }
            },
        )
      }
    }
  }
}

/** The React children inside the card. */
@Composable
private fun ModalContent(content: View, modifier: Modifier) {
  AndroidView(
    factory = {
      // a recomposition after dispose would find it still attached to the old holder
      (content.parent as? ViewGroup)?.removeView(content)
      content
    },
    modifier = modifier,
  )
}
