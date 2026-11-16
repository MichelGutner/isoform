package com.omnistyle

import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
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
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event

/** Props of the picker, read by the Compose UI (every change recomposes it). */
internal class OmniDatePickerState {
  /** The selected moment (ms since the epoch). */
  var value by mutableStateOf(0L)
  var mode by mutableStateOf("date")
  var display by mutableStateOf("inline")
  /** Earliest moment (ms); beyond ±8.64e15 means no limit. */
  var minimum by mutableDoubleStateOf(-8.64e15)
  var maximum by mutableDoubleStateOf(8.64e15)
  var locale by mutableStateOf("")
  var hourCycle by mutableStateOf("auto")
  /** Accent color (ARGB), or `null` for the default. */
  var tint by mutableStateOf<Int?>(null)
  var disabled by mutableStateOf(false)
}

/**
 * Native view of `DatePicker` on Android: the picker is drawn by the lib in Jetpack Compose
 * (`OmniDatePicker.kt`), the same design as on iOS. It reports its natural size so JS sizes the view to it.
 */
class OmniDatePickerView(private val reactContext: ThemedReactContext) : FrameLayout(reactContext) {

  internal val state = OmniDatePickerState()

  private val composeView = ComposeView(reactContext).apply {
    layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
    setContent {
      OmniDatePicker(
        state = state,
        onChange = { millis -> emit(CHANGE, Arguments.createMap().apply { putDouble("value", millis.toDouble()) }) },
        onSize = { width, height ->
          val density = resources.displayMetrics.density
          emit(SIZE, Arguments.createMap().apply { putDouble("width", width / density.toDouble()); putDouble("height", height / density.toDouble()) })
        },
      )
    }
  }

  /**
   * Compose needs lifecycle, saved-state and view-model owners on the window's root view.
   * They are on the activity's window; the activity's are borrowed for any other window.
   * Runs before the children (the Compose view) attach.
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
   * was laid out would stay at 0×0 forever: measure it by hand (the width of this view, the
   * height its content wants) and place it at the top.
   */
  private fun layoutCompose() {
    if (composeView.parent == null || width == 0) return
    composeView.measure(MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED))
    composeView.layout(0, 0, width, composeView.measuredHeight)
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

  // ── props ──

  fun setMoment(value: Double) { state.value = value.toLong() }
  fun setMode(value: String?) { state.mode = value ?: "date" }
  fun setDisplay(value: String?) { state.display = value ?: "inline" }
  fun setMinimum(value: Double) { state.minimum = value }
  fun setMaximum(value: Double) { state.maximum = value }
  fun setLocale(value: String?) { state.locale = value.orEmpty() }
  fun setHourCycle(value: String?) { state.hourCycle = value ?: "auto" }
  fun setTint(value: Int?) { state.tint = value }
  fun setDisabled(value: Boolean) { state.disabled = value }

  // ── events → JS ──

  private fun emit(name: String, payload: WritableMap) {
    val surfaceId = UIManagerHelper.getSurfaceId(reactContext)
    UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)
      ?.dispatchEvent(PickerEvent(surfaceId, id, name, payload))
  }

  private class PickerEvent(
    surfaceId: Int,
    viewId: Int,
    private val name: String,
    private val payload: WritableMap,
  ) : Event<PickerEvent>(surfaceId, viewId) {
    override fun getEventName(): String = name
    override fun getEventData(): WritableMap = payload
  }

  companion object {
    const val CHANGE = "topPickerChange"
    const val SIZE = "topPickerSize"
    val EVENTS = listOf(CHANGE, SIZE)
  }
}
