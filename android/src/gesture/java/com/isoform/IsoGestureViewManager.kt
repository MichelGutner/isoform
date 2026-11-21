package com.isoform

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.views.view.ReactViewGroup
import com.facebook.react.views.view.ReactViewManager

/**
 * Bridge between Fabric and `IsoGestureView`. It extends React Native's own view
 * manager, so every view style (background, borders, radius, overflow…) keeps
 * working; the gesture props come on top through `@ReactProp`. The props and events
 * are declared in `src/adapters/react-native/gesture/native/IsoGestureViewNativeComponent.ts`.
 */
@ReactModule(name = IsoGestureViewManager.NAME)
class IsoGestureViewManager : ReactViewManager() {

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): ReactViewGroup = IsoGestureView(context)

  override fun onDropViewInstance(view: ReactViewGroup) {
    (view as? IsoGestureView)?.reset()
    super.onDropViewInstance(view)
  }

  // ── props ──

  @ReactProp(name = "panAxis")
  fun setPanAxis(view: ReactViewGroup, value: String?) {
    (view as? IsoGestureView)?.panAxis = value ?: "none"
  }

  @ReactProp(name = "pinchEnabled", defaultBoolean = false)
  fun setPinchEnabled(view: ReactViewGroup, value: Boolean) {
    (view as? IsoGestureView)?.pinchEnabled = value
  }

  @ReactProp(name = "rotateEnabled", defaultBoolean = false)
  fun setRotateEnabled(view: ReactViewGroup, value: Boolean) {
    (view as? IsoGestureView)?.rotateEnabled = value
  }

  @ReactProp(name = "doubleTapEnabled", defaultBoolean = false)
  fun setDoubleTapEnabled(view: ReactViewGroup, value: Boolean) {
    (view as? IsoGestureView)?.doubleTapEnabled = value
  }

  @ReactProp(name = "longPressEnabled", defaultBoolean = false)
  fun setLongPressEnabled(view: ReactViewGroup, value: Boolean) {
    (view as? IsoGestureView)?.longPressEnabled = value
  }

  @ReactProp(name = "longPressDuration", defaultDouble = 500.0)
  fun setLongPressDuration(view: ReactViewGroup, value: Double) {
    (view as? IsoGestureView)?.longPressDuration = value.toLong().coerceAtLeast(0L)
  }

  @ReactProp(name = "simultaneous", defaultBoolean = true)
  fun setSimultaneous(view: ReactViewGroup, value: Boolean) {
    (view as? IsoGestureView)?.simultaneous = value
  }

  // ── commands ──

  override fun receiveCommand(root: ReactViewGroup, commandId: String, args: ReadableArray?) {
    if (commandId == "haptic") {
      (root as? IsoGestureView)?.haptic(args?.getInt(0) ?: 0)
      return
    }
    super.receiveCommand(root, commandId, args)
  }

  // ── events (native name → JS prop) ──

  override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> =
    (super.getExportedCustomDirectEventTypeConstants() ?: emptyMap()) +
      IsoGestureView.EVENTS.associateWith { mapOf("registrationName" to "on" + it.removePrefix("top")) }

  companion object {
    const val NAME = "IsoGestureView"
  }
}
