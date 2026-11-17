package com.isoform

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.util.Rational
import android.view.MotionEvent
import android.view.OrientationEventListener
import android.view.Surface
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.compose.ui.platform.ComposeView
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.findViewTreeLifecycleOwner
import androidx.lifecycle.findViewTreeViewModelStoreOwner
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.lifecycle.setViewTreeViewModelStoreOwner
import androidx.savedstate.findViewTreeSavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.common.LifecycleState
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import com.facebook.react.uimanager.events.NativeGestureUtil
import kotlin.math.roundToInt

/** Props that decide whether and how the camera runs. */
private class CameraProps {
  var front = false
  var active = true
  var video = false
  var audio = true
  var codeScanner = false
  var codeTypes = listOf("qr")
}

/**
 * Native view of `Camera` on Android: CameraX (`IsoCameraController`) drawn by the
 * Jetpack Compose viewfinder (`IsoCamera.kt`). It asks for the permissions itself,
 * runs the camera only while it is on screen, active, allowed and the app is in the
 * foreground, and reports everything to JS as events.
 */
class IsoCameraView(private val reactContext: ThemedReactContext) :
  FrameLayout(reactContext),
  IsoCameraListener,
  LifecycleEventListener {

  private val props = CameraProps()
  private val ui = IsoCameraUiState()
  private val lifecycle = IsoCameraLifecycle()
  private val controller = IsoCameraController(reactContext, lifecycle, this)

  private var attached = false
  private var hostResumed = reactContext.lifecycleState == LifecycleState.RESUMED
  private var lastPermission = ""
  private var asking = false

  /** Last touch, handed to React Native when the pinch takes over (it then cancels JS touches). */
  private var lastTouch: MotionEvent? = null
  private var pinchHandedOver = false

  private val composeView = ComposeView(reactContext).apply {
    layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    setContent {
      IsoCamera(controller = controller, ui = ui, onPinchStart = ::pinchStarted, onPinch = ::pinched)
    }
  }

  /** Device orientation → rotation of photos, videos and codes (the screen may stay in portrait). */
  private val orientation = object : OrientationEventListener(reactContext) {
    override fun onOrientationChanged(degrees: Int) {
      if (degrees == ORIENTATION_UNKNOWN) return
      controller.setRotation(surfaceRotation(degrees))
    }
  }

  init {
    reactContext.addLifecycleEventListener(this)
  }

  // ── window: the Compose view joins once attached (see IsoSheetView for why) ──

  override fun onAttachedToWindow() {
    ensureViewTreeOwners()
    super.onAttachedToWindow()
    attached = true
    post {
      if (isAttachedToWindow && composeView.parent == null) {
        addView(composeView)
        layoutCompose()
      }
    }
    refresh()
  }

  override fun onDetachedFromWindow() {
    attached = false
    refresh()
    super.onDetachedFromWindow()
  }

  /** React Native swallows `requestLayout`: the late Compose view is measured and placed by hand. */
  private fun layoutCompose() {
    if (composeView.parent == null || width == 0 || height == 0) return
    composeView.measure(MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY))
    composeView.layout(0, 0, width, height)
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    super.onLayout(changed, left, top, right, bottom)
    layoutCompose()
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    refresh()
  }

  /** Compose needs these owners on the window's root; the activity's are borrowed when missing. */
  private fun ensureViewTreeOwners() {
    val root = rootView
    val activity = reactContext.currentActivity as? ComponentActivity ?: return
    if (root.findViewTreeLifecycleOwner() == null) root.setViewTreeLifecycleOwner(activity)
    if (root.findViewTreeSavedStateRegistryOwner() == null) root.setViewTreeSavedStateRegistryOwner(activity)
    if (root.findViewTreeViewModelStoreOwner() == null) root.setViewTreeViewModelStoreOwner(activity)
  }

  // ── app in the foreground or not ──

  override fun onHostResume() {
    hostResumed = true
    // the user may have changed the permission in the system settings meanwhile
    refresh()
  }

  override fun onHostPause() {
    hostResumed = false
    refresh()
  }

  override fun onHostDestroy() {
    hostResumed = false
    refresh()
  }

  // ── run state ──

  private val needsMicrophone get() = props.video && props.audio

  /** Applies the current state: permissions, then whether the camera runs and with what. */
  private fun refresh() {
    reportPermission()
    if (attached && props.active && hostResumed) askIfUndetermined()
    val run = attached && props.active && hostResumed && granted(Manifest.permission.CAMERA)
    lifecycle.moveTo(if (run) Lifecycle.State.RESUMED else Lifecycle.State.CREATED)
    if (run) {
      orientation.enable()
      controller.configure(
        IsoCameraSetup(
          front = props.front,
          video = props.video,
          codes = if (props.codeScanner) props.codeTypes else null,
          aspect = if (width > 0 && height > 0) Rational(width, height) else null,
        ),
      )
    } else {
      orientation.disable()
    }
  }

  // ── permissions ──

  private val preferences get() = reactContext.getSharedPreferences("isoform.camera", Context.MODE_PRIVATE)

  private fun granted(permission: String) =
    ContextCompat.checkSelfPermission(reactContext, permission) == PackageManager.PERMISSION_GRANTED

  private fun asked(permission: String) = preferences.getBoolean(permission, false)

  /** `granted`, `undetermined` (never asked), `denied` (may ask again) or `blocked` (settings only). */
  private fun status(permission: String): String {
    val activity = reactContext.currentActivity
    return when {
      granted(permission) -> "granted"
      !asked(permission) -> "undetermined"
      activity?.shouldShowRequestPermissionRationale(permission) == true -> "denied"
      else -> "blocked"
    }
  }

  private fun reportPermission() {
    val camera = status(Manifest.permission.CAMERA)
    val microphone = if (needsMicrophone) status(Manifest.permission.RECORD_AUDIO) else "undetermined"
    val key = "$camera/$microphone"
    if (key == lastPermission) return
    lastPermission = key
    emit(PERMISSION, Arguments.createMap().apply {
      putString("camera", camera)
      putString("microphone", microphone)
    })
  }

  /** Asks on its own the first time (camera, and the microphone when recording with sound). */
  private fun askIfUndetermined() {
    val missing = listOfNotNull(
      Manifest.permission.CAMERA.takeIf { !asked(it) && !granted(it) },
      Manifest.permission.RECORD_AUDIO.takeIf { needsMicrophone && !asked(it) && !granted(it) },
    )
    if (missing.isNotEmpty()) ask(missing)
  }

  /** The system dialog for [permissions]; the result refreshes the state. */
  private fun ask(permissions: List<String>) {
    val activity = reactContext.currentActivity as? PermissionAwareActivity ?: return
    if (asking) return
    asking = true
    activity.requestPermissions(
      permissions.toTypedArray(),
      PERMISSION_REQUEST,
      PermissionListener { requestCode, _, _ ->
        if (requestCode != PERMISSION_REQUEST) return@PermissionListener false
        asking = false
        preferences.edit().apply { permissions.forEach { putBoolean(it, true) } }.apply()
        refresh()
        true
      },
    )
  }

  /** `requestPermission` command: the "Allow camera" button of the notice. */
  fun requestPermission() {
    val missing = listOfNotNull(
      Manifest.permission.CAMERA.takeIf { !granted(it) },
      Manifest.permission.RECORD_AUDIO.takeIf { needsMicrophone && !granted(it) },
    )
    if (missing.isNotEmpty()) ask(missing)
  }

  // ── gestures ──

  override fun dispatchTouchEvent(event: MotionEvent): Boolean {
    lastTouch?.recycle()
    lastTouch = MotionEvent.obtain(event)
    if (event.actionMasked == MotionEvent.ACTION_UP || event.actionMasked == MotionEvent.ACTION_CANCEL) pinchHandedOver = false
    return super.dispatchTouchEvent(event)
  }

  /** A pinch started: parents (scroll views) and JS touch handlers let go of this touch. */
  private fun pinchStarted() {
    if (pinchHandedOver) return
    pinchHandedOver = true
    parent?.requestDisallowInterceptTouchEvent(true)
    lastTouch?.let { NativeGestureUtil.notifyNativeGestureStarted(this, it) }
  }

  private fun pinched(change: Float) {
    controller.applyZoom(controller.zoom * change)
    emit(ZOOM, Arguments.createMap().apply { putDouble("zoom", (controller.zoom * 100).roundToInt() / 100.0) })
  }

  // ── props ──

  fun setFacing(value: String?) = update { props.front = value == "front" }
  fun setActive(value: Boolean) = update { props.active = value }
  fun setVideo(value: Boolean) = update { props.video = value }
  fun setAudio(value: Boolean) = update { props.audio = value }
  fun setCodeScanner(value: Boolean) = update { props.codeScanner = value }

  fun setCodeTypes(value: ReadableArray?) = update {
    props.codeTypes = (0 until (value?.size() ?: 0)).mapNotNull { value?.getString(it) }.ifEmpty { listOf("qr") }
  }

  fun setFlash(value: String?) = controller.applyFlash(value ?: "off")
  fun setTorch(value: Boolean) = controller.applyTorch(value)
  fun setZoom(value: Float) = controller.applyZoom(value)
  fun setZoomGesture(value: Boolean) { ui.zoomGesture = value }
  fun setFocusGesture(value: Boolean) { ui.focusGesture = value }

  private inline fun update(change: () -> Unit) {
    change()
    refresh()
  }

  // ── commands ──

  fun takePhoto(requestId: Int, flash: String) {
    controller.takePhoto(flash) { uri, width, height, error ->
      emit(PHOTO, Arguments.createMap().apply {
        putInt("requestId", requestId)
        putString("uri", uri)
        putInt("width", width)
        putInt("height", height)
        putString("error", error)
      })
    }
  }

  fun startRecording(requestId: Int) {
    controller.recorder.start(
      withAudio = props.audio,
      onStarted = { error ->
        emit(RECORD_START, Arguments.createMap().apply {
          putInt("requestId", requestId)
          putString("error", error)
        })
      },
      onEnded = ::recordingEnded,
    )
  }

  fun stopRecording(requestId: Int) {
    controller.recorder.stop(requestId) { recordingEnded(requestId, "", 0.0, "Camera is not recording") }
  }

  private fun recordingEnded(requestId: Int, uri: String, seconds: Double, error: String) {
    emit(RECORD_END, Arguments.createMap().apply {
      putInt("requestId", requestId)
      putString("uri", uri)
      putDouble("duration", seconds)
      putString("error", error)
    })
  }

  // ── controller → JS ──

  override fun onCameraReady() = emit(READY)

  override fun onCameraError(message: String) = emit(ERROR, Arguments.createMap().apply { putString("message", message) })

  override fun onCameraZoomRange(min: Float, max: Float) = Unit

  override fun onCodes(codes: List<Pair<String, String>>) {
    val list = Arguments.createArray()
    codes.forEach { (value, type) ->
      list.pushMap(Arguments.createMap().apply {
        putString("value", value)
        putString("type", type)
      })
    }
    emit(CODES, Arguments.createMap().apply { putArray("codes", list) })
  }

  fun release() {
    reactContext.removeLifecycleEventListener(this)
    orientation.disable()
    controller.release()
    lifecycle.destroy()
    lastTouch?.recycle()
    lastTouch = null
  }

  private fun emit(name: String, payload: WritableMap = Arguments.createMap()) {
    val surfaceId = UIManagerHelper.getSurfaceId(reactContext)
    UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)?.dispatchEvent(CameraEvent(surfaceId, id, name, payload))
  }

  private class CameraEvent(surfaceId: Int, viewId: Int, private val name: String, private val payload: WritableMap) :
    Event<CameraEvent>(surfaceId, viewId) {
    override fun getEventName(): String = name
    override fun getEventData(): WritableMap = payload
  }

  companion object {
    const val READY = "topCameraReady"
    const val ERROR = "topCameraError"
    const val PERMISSION = "topCameraPermission"
    const val ZOOM = "topCameraZoom"
    const val CODES = "topCameraCodes"
    const val PHOTO = "topCameraPhoto"
    const val RECORD_START = "topCameraRecordStart"
    const val RECORD_END = "topCameraRecordEnd"
    val EVENTS = listOf(READY, ERROR, PERMISSION, ZOOM, CODES, PHOTO, RECORD_START, RECORD_END)

    /** Request code of the permission dialog (any value unique to this lib). */
    private const val PERMISSION_REQUEST = 0x0CA3
  }
}

/** Degrees from `OrientationEventListener` (0 = natural, clockwise) → the `Surface.ROTATION_*` CameraX expects. */
private fun surfaceRotation(degrees: Int): Int = when (degrees) {
  in 45 until 135 -> Surface.ROTATION_270
  in 135 until 225 -> Surface.ROTATION_180
  in 225 until 315 -> Surface.ROTATION_90
  else -> Surface.ROTATION_0
}
