package com.omnistyle

import androidx.camera.compose.CameraXViewfinder
import androidx.camera.core.SurfaceOrientedMeteringPointFactory
import androidx.camera.viewfinder.compose.MutableCoordinateTransformer
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp

/** Props the viewfinder reads (each change recomposes only what uses it). */
internal class OmniCameraUiState {
  var zoomGesture by mutableStateOf(true)
  var focusGesture by mutableStateOf(true)
}

/** A tap that asked for focus: where, and an id so two taps on the same spot both animate. */
private data class FocusTap(val at: Offset, val id: Long)

/**
 * The preview: CameraX's Compose viewfinder filling the box (cropped like `cover`),
 * pinch to zoom, and tap to focus with a ring that fades out.
 */
@Composable
internal fun OmniCamera(
  controller: OmniCameraController,
  ui: OmniCameraUiState,
  onPinchStart: () -> Unit,
  onPinch: (zoomChange: Float) -> Unit,
) {
  val request by controller.surfaceRequest.collectAsState()
  val transformer = remember { MutableCoordinateTransformer() }
  var tap by remember { mutableStateOf<FocusTap?>(null) }

  Box(Modifier.fillMaxSize().background(Color.Black)) {
    request?.let { surface ->
      CameraXViewfinder(
        surfaceRequest = surface,
        coordinateTransformer = transformer,
        contentScale = ContentScale.Crop,
        modifier = Modifier
          .fillMaxSize()
          .pointerInput(ui.focusGesture, surface) {
            if (!ui.focusGesture) return@pointerInput
            detectTapGestures { offset ->
              // viewfinder coordinates → camera surface coordinates → a metering point
              val onSurface = with(transformer) { offset.transform() }
              val factory = SurfaceOrientedMeteringPointFactory(surface.resolution.width.toFloat(), surface.resolution.height.toFloat())
              controller.focus(factory.createPoint(onSurface.x, onSurface.y))
              tap = FocusTap(offset, System.nanoTime())
            }
          }
          .pointerInput(ui.zoomGesture) {
            if (!ui.zoomGesture) return@pointerInput
            detectTransformGestures { _, _, zoomChange, _ ->
              if (zoomChange == 1f) return@detectTransformGestures
              // the view hands the gesture over to Compose once per touch (it ignores repeats)
              onPinchStart()
              onPinch(zoomChange)
            }
          },
      )
    }
    tap?.let { FocusRing(it) }
  }
}

/** The ring drawn where the user tapped to focus: it shrinks in, then fades out. */
@Composable
private fun FocusRing(tap: FocusTap) {
  val alpha = remember(tap.id) { Animatable(1f) }
  val scale = remember(tap.id) { Animatable(1.4f) }
  LaunchedEffect(tap.id) {
    scale.animateTo(1f, tween(200))
    alpha.animateTo(0f, tween(600, delayMillis = 700))
  }
  Canvas(Modifier.fillMaxSize()) {
    val radius = 36.dp.toPx() * scale.value
    drawCircle(Color.White.copy(alpha = alpha.value), radius, tap.at, style = Stroke(width = 1.5.dp.toPx()))
  }
}
