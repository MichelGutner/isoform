package com.isoform

import android.content.Context
import android.graphics.BitmapFactory
import android.util.Rational
import android.view.Surface
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.CameraState
import androidx.camera.core.FocusMeteringAction
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.MeteringPoint
import androidx.camera.core.Preview
import androidx.camera.core.SurfaceRequest
import androidx.camera.core.UseCaseGroup
import androidx.camera.core.ViewPort
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.lifecycle.awaitInstance
import androidx.core.content.ContextCompat
import androidx.exifinterface.media.ExifInterface
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.io.File
import java.util.concurrent.TimeUnit

/** What the controller tells the view (which turns it into JS events). */
internal interface IsoCameraListener {
  fun onCameraReady()
  fun onCameraError(message: String)
  fun onCameraZoomRange(min: Float, max: Float)
  fun onCodes(codes: List<Pair<String, String>>)
}

/** The use cases that need a rebind when they change. */
internal data class IsoCameraSetup(
  val front: Boolean,
  val video: Boolean,
  val codes: List<String>?,
  /** Width / height of the preview box, for the viewport (photos match what is shown). */
  val aspect: Rational?,
)

/**
 * CameraX for one camera view: binds Preview + ImageCapture (+ VideoCapture and the
 * code scanner when on) to the view's own lifecycle, hands the preview's
 * [SurfaceRequest] to the Compose viewfinder, and runs photos, zoom, torch and focus.
 */
internal class IsoCameraController(
  private val context: Context,
  private val lifecycle: IsoCameraLifecycle,
  private val listener: IsoCameraListener,
) {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
  private val mainExecutor = ContextCompat.getMainExecutor(context)

  private val requests = MutableStateFlow<SurfaceRequest?>(null)

  /** The preview's surface, drawn by `CameraXViewfinder`. */
  val surfaceRequest: StateFlow<SurfaceRequest?> = requests

  private val preview = Preview.Builder().build().apply { setSurfaceProvider { request -> requests.value = request } }
  private var imageCapture: ImageCapture? = null
  private var bound: List<androidx.camera.core.UseCase> = emptyList()
  private var provider: ProcessCameraProvider? = null
  private var camera: Camera? = null
  private var setup: IsoCameraSetup? = null
  private var rotation = Surface.ROTATION_0

  val recorder = IsoCameraRecorder(context)
  private val scanner = IsoCodeScanner(context) { codes -> listener.onCodes(codes) }

  var zoom = 1f
    private set
  private var torch = false
  private var flash = ImageCapture.FLASH_MODE_OFF

  /** Binds the use cases for [next] (only when something that needs a rebind changed). */
  fun configure(next: IsoCameraSetup) {
    if (next == setup) return
    setup = next
    scope.launch {
      runCatching { bind(next) }.onFailure { listener.onCameraError(it.message ?: "Camera failed to start") }
    }
  }

  private suspend fun bind(next: IsoCameraSetup) {
    val cameras = provider ?: ProcessCameraProvider.awaitInstance(context).also { provider = it }
    val selector = if (next.front) CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA
    if (!cameras.hasCamera(selector)) {
      listener.onCameraError(if (next.front) "No front camera" else "No back camera")
      return
    }
    // zero shutter lag where the camera supports it, else the fastest capture
    val zsl = cameras.getCameraInfo(selector).isZslSupported
    val capture = ImageCapture.Builder()
      .setCaptureMode(if (zsl) ImageCapture.CAPTURE_MODE_ZERO_SHUTTER_LAG else ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
      .setFlashMode(flash)
      .setTargetRotation(rotation)
      .build()
    imageCapture = capture

    val useCases = listOfNotNull(
      preview,
      capture,
      if (next.video) recorder.useCase(rotation) else null,
      next.codes?.let { scanner.useCase(it, rotation) },
    )
    val group = UseCaseGroup.Builder().apply {
      useCases.forEach(::addUseCase)
      // photos and videos keep the part of the frame the preview shows (it crops to fill)
      next.aspect?.let { setViewPort(ViewPort.Builder(it, rotation).setScaleType(ViewPort.FILL_CENTER).build()) }
    }.build()

    // only this view's use cases: another camera on screen keeps its own
    if (bound.isNotEmpty()) cameras.unbind(*bound.toTypedArray())
    bound = useCases
    val opened = cameras.bindToLifecycle(lifecycle, selector, group)
    camera = opened
    observe(opened)
    applyZoom(zoom)
    applyTorch(torch)
  }

  private fun observe(opened: Camera) {
    opened.cameraInfo.cameraState.removeObservers(lifecycle)
    opened.cameraInfo.cameraState.observe(lifecycle) { state ->
      if (state.type == CameraState.Type.OPEN) listener.onCameraReady()
      state.error?.let { error -> if (error.type == CameraState.ErrorType.CRITICAL) listener.onCameraError(cameraErrorMessage(error.code)) }
    }
    opened.cameraInfo.zoomState.removeObservers(lifecycle)
    opened.cameraInfo.zoomState.observe(lifecycle) { state -> listener.onCameraZoomRange(state.minZoomRatio, state.maxZoomRatio) }
  }

  /** Zoom factor, clamped to what the camera supports. */
  fun applyZoom(value: Float) {
    val range = camera?.cameraInfo?.zoomState?.value
    zoom = range?.let { value.coerceIn(it.minZoomRatio, it.maxZoomRatio) } ?: value
    camera?.cameraControl?.setZoomRatio(zoom)
  }

  fun applyTorch(on: Boolean) {
    torch = on
    val current = camera ?: return
    if (current.cameraInfo.hasFlashUnit()) current.cameraControl.enableTorch(on)
  }

  fun applyFlash(mode: String) {
    flash = flashMode(mode)
    imageCapture?.flashMode = flash
  }

  /** Focus and exposure at [point] (from the viewfinder's coordinate transformer), reset after 3 s. */
  fun focus(point: MeteringPoint) {
    val action = FocusMeteringAction.Builder(point).setAutoCancelDuration(3, TimeUnit.SECONDS).build()
    camera?.cameraControl?.startFocusAndMetering(action)
  }

  /** Device rotation (Surface.ROTATION_*): photos, videos and codes come out upright. */
  fun setRotation(value: Int) {
    if (value == rotation) return
    rotation = value
    imageCapture?.targetRotation = value
    recorder.setRotation(value)
    scanner.setRotation(value)
  }

  /** Takes a JPEG into the cache folder. [done] gets `(uri, width, height, error)`. */
  fun takePhoto(flashOverride: String, done: (String, Int, Int, String) -> Unit) {
    val capture = imageCapture ?: return done("", 0, 0, "Camera is not ready")
    capture.flashMode = flashMode(flashOverride)
    val file = outputFile(context, "photo", "jpg")
    val options = ImageCapture.OutputFileOptions.Builder(file).build()
    capture.takePicture(
      options,
      mainExecutor,
      object : ImageCapture.OnImageSavedCallback {
        override fun onImageSaved(output: ImageCapture.OutputFileResults) {
          capture.flashMode = flash
          val (width, height) = uprightSize(file)
          done("file://${file.absolutePath}", width, height, "")
        }

        override fun onError(exception: ImageCaptureException) {
          capture.flashMode = flash
          done("", 0, 0, exception.message ?: "Photo failed")
        }
      },
    )
  }

  /** Unbinds and stops everything (the view was dropped). */
  fun release() {
    recorder.release()
    scanner.release()
    if (bound.isNotEmpty()) provider?.unbind(*bound.toTypedArray())
    bound = emptyList()
    camera = null
    scope.cancel()
  }
}

/** `off` / `on` / `auto` → CameraX flash mode. */
private fun flashMode(mode: String): Int = when (mode) {
  "on" -> ImageCapture.FLASH_MODE_ON
  "auto" -> ImageCapture.FLASH_MODE_AUTO
  else -> ImageCapture.FLASH_MODE_OFF
}

private fun cameraErrorMessage(code: Int): String = when (code) {
  CameraState.ERROR_CAMERA_IN_USE, CameraState.ERROR_MAX_CAMERAS_IN_USE -> "The camera is in use by another app"
  CameraState.ERROR_CAMERA_DISABLED -> "The camera is disabled by a device policy"
  CameraState.ERROR_DO_NOT_DISTURB_MODE_ENABLED -> "The camera is blocked by Do Not Disturb"
  else -> "The camera stopped (error $code)"
}

/** A new file in the app's cache (`isoform-camera/`): the app moves it if it wants to keep it. */
internal fun outputFile(context: Context, kind: String, extension: String): File =
  File(context.cacheDir, "isoform-camera").apply { mkdirs() }.let { File(it, "$kind-${System.currentTimeMillis()}.$extension") }

/** Size of the JPEG as it is meant to be seen (EXIF rotation applied). */
private fun uprightSize(file: File): Pair<Int, Int> {
  val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
  BitmapFactory.decodeFile(file.absolutePath, bounds)
  val turned = runCatching { ExifInterface(file).rotationDegrees % 180 != 0 }.getOrDefault(false)
  return if (turned) bounds.outHeight to bounds.outWidth else bounds.outWidth to bounds.outHeight
}
