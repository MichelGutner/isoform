package com.omnistyle

import android.content.Context
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.ComposeView
import androidx.lifecycle.findViewTreeLifecycleOwner
import androidx.lifecycle.findViewTreeViewModelStoreOwner
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.lifecycle.setViewTreeViewModelStoreOwner
import androidx.savedstate.findViewTreeSavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import com.facebook.react.uimanager.events.NativeGestureUtil

/** Props of the sheet, read by the Compose UI (every change recomposes it). */
internal class OmniSheetState {
  var open by mutableStateOf(false)
  /** Rest heights as JS sends them: `fit`, `full`, `50%` or a number of dp. */
  var detents by mutableStateOf(listOf("fit"))
  /** Index in [detents] to rest at. */
  var detent by mutableIntStateOf(0)
  /** Measured content height in dp, for `fit` (0 = not measured yet). */
  var contentHeight by mutableStateOf(0.0)
  var dismissible by mutableStateOf(true)
  var modal by mutableStateOf(true)
  var grabber by mutableStateOf(true)
  /** Surface color (ARGB), or `null` for the default. */
  var color by mutableStateOf<Int?>(null)
  /** Top corner radius in dp (negative = the default). */
  var cornerRadius by mutableStateOf(-1.0)
}

/**
 * Holds the React children. Fabric lays each child out itself (`child.layout(...)`),
 * so this group never measures or moves them; it only takes the size Compose gives it.
 */
internal class OmniSheetContent(context: Context) : ViewGroup(context) {
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
  }

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) = Unit
}

/**
 * Native view of `BottomSheet` on Android: the sheet is Jetpack Compose (`OmniSheet.kt`),
 * the React children live in [content], inside the sheet. JS puts this view in a
 * transparent React Native `Modal` (modal sheets) or over its parent (non-modal).
 */
class OmniSheetView(private val reactContext: ThemedReactContext) : FrameLayout(reactContext) {

  internal val state = OmniSheetState()
  internal val content = OmniSheetContent(reactContext)

  /** Last touch, handed to React Native when the sheet drag takes over (it then cancels the JS press). */
  private var lastTouch: MotionEvent? = null

  private val composeView = ComposeView(reactContext).apply {
    layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    setContent {
      OmniSheet(
        state = state,
        content = content,
        onDragStart = ::dragStarted,
        onLayout = { width, height -> emit(LAYOUT, Arguments.createMap().apply { putDouble("width", width); putDouble("height", height) }) },
        onDismiss = { emit(DISMISS) },
        onClosed = { emit(CLOSED) },
        onDetent = { index -> emit(DETENT, Arguments.createMap().apply { putInt("index", index) }) },
      )
    }
  }

  /**
   * Compose needs lifecycle, saved-state and view-model owners on the window's root view.
   * The activity's window has them, but React Native's `Modal` is a plain dialog window
   * without them (composing there fails with "ViewTreeLifecycleOwner not found"), so the
   * activity's are borrowed. Runs before the children (the Compose view) attach.
   */
  override fun onAttachedToWindow() {
    ensureViewTreeOwners()
    super.onAttachedToWindow()
    // Fabric measures this view before it has a window, and a ComposeView cannot be measured
    // then ("Cannot locate windowRecomposer"): it joins only once attached (after this dispatch).
    post {
      if (isAttachedToWindow && composeView.parent == null) {
        addView(composeView)
        layoutCompose()
      }
    }
  }

  /**
   * React Native swallows `requestLayout` in its view tree, so a child added after this view
   * was laid out would stay at 0×0 forever: measure and place it by hand, to fill this view.
   */
  private fun layoutCompose() {
    if (composeView.parent == null || width == 0 || height == 0) return
    composeView.measure(MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY))
    composeView.layout(0, 0, width, height)
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    super.onLayout(changed, left, top, right, bottom)
    layoutCompose()
  }

  private fun ensureViewTreeOwners() {
    val root = rootView
    val activity = reactContext.currentActivity as? ComponentActivity ?: return
    if (root.findViewTreeLifecycleOwner() == null) root.setViewTreeLifecycleOwner(activity)
    if (root.findViewTreeSavedStateRegistryOwner() == null) root.setViewTreeSavedStateRegistryOwner(activity)
    if (root.findViewTreeViewModelStoreOwner() == null) root.setViewTreeViewModelStoreOwner(activity)
  }

  override fun dispatchTouchEvent(event: MotionEvent): Boolean {
    lastTouch?.recycle()
    lastTouch = MotionEvent.obtain(event)
    return super.dispatchTouchEvent(event)
  }

  private fun dragStarted() {
    lastTouch?.let { NativeGestureUtil.notifyNativeGestureStarted(this, it) }
  }

  // ── props ──

  fun setOpen(value: Boolean) { state.open = value }

  fun setDetents(value: ReadableArray?) {
    val next = (0 until (value?.size() ?: 0)).mapNotNull { value?.getString(it) }.ifEmpty { listOf("fit") }
    if (next != state.detents) state.detents = next
  }

  fun setDetent(value: Int) { state.detent = value }
  fun setContentHeight(value: Double) { state.contentHeight = value }
  fun setDismissible(value: Boolean) { state.dismissible = value }
  fun setModal(value: Boolean) { state.modal = value }
  fun setGrabber(value: Boolean) { state.grabber = value }
  fun setColor(value: Int?) { state.color = value }
  fun setCornerRadius(value: Double) { state.cornerRadius = value }

  fun release() {
    lastTouch?.recycle()
    lastTouch = null
  }

  // ── events → JS ──

  private fun emit(name: String, payload: WritableMap = Arguments.createMap()) {
    val surfaceId = UIManagerHelper.getSurfaceId(reactContext)
    UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)
      ?.dispatchEvent(SheetEvent(surfaceId, id, name, payload))
  }

  private class SheetEvent(
    surfaceId: Int,
    viewId: Int,
    private val name: String,
    private val payload: WritableMap,
  ) : Event<SheetEvent>(surfaceId, viewId) {
    override fun getEventName(): String = name
    override fun getEventData(): WritableMap = payload
  }

  companion object {
    const val LAYOUT = "topSheetLayout"
    const val DISMISS = "topSheetDismiss"
    const val CLOSED = "topSheetClosed"
    const val DETENT = "topSheetDetent"
    val EVENTS = listOf(LAYOUT, DISMISS, CLOSED, DETENT)
  }
}

/** The children of the view are the sheet's content, not the view's own children. */
internal fun OmniSheetView.childAt(index: Int): View? = content.getChildAt(index)
