package com.isoform

import android.content.Context
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
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

/** Props of the modal, read by the Compose UI (every change recomposes it). */
internal class IsoModalState {
  var open by mutableStateOf(false)
  /** `dialog` or `fullScreen`. */
  var presentation by mutableStateOf("dialog")
  /** `scale`, `slide`, `fade` or `none`. */
  var animation by mutableStateOf("scale")
  var dismissible by mutableStateOf(true)
  /** Backdrop color (ARGB), or `null` for the default. */
  var backdrop by mutableStateOf<Int?>(null)
  /** Card color (ARGB), or `null` for the default. */
  var surface by mutableStateOf<Int?>(null)
  /** Card corner radius in dp (negative = the default). */
  var cornerRadius by mutableStateOf(-1.0)
  /** Widest dialog card, in dp. */
  var maxWidth by mutableStateOf(420.0)
  /** Measured height of a dialog's content in dp (0 = not measured yet). */
  var contentHeight by mutableStateOf(0.0)
}

/**
 * Holds the React children. Fabric lays each child out itself (`child.layout(...)`),
 * so this group never measures or moves them; it only takes the size Compose gives it.
 */
internal class IsoModalContent(context: Context) : ViewGroup(context) {
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
  }

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) = Unit
}

/**
 * Native view of `Modal` on Android: the modal is Jetpack Compose (`IsoModal.kt`), the
 * React children live in [content], inside the card. JS puts this view in a transparent
 * React Native `Modal` (its window routes touches, the back button and the keyboard).
 */
class IsoModalView(private val reactContext: ThemedReactContext) : FrameLayout(reactContext) {

  internal val state = IsoModalState()
  internal val content = IsoModalContent(reactContext)

  private val composeView = ComposeView(reactContext).apply {
    layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    setContent {
      IsoModal(
        state = state,
        content = content,
        onLayout = { width, height -> emit(LAYOUT, Arguments.createMap().apply { putDouble("width", width); putDouble("height", height) }) },
        onDismiss = { emit(DISMISS) },
        onClosed = { emit(CLOSED) },
      )
    }
  }

  /**
   * Compose needs lifecycle, saved-state and view-model owners on the window's root view;
   * React Native's `Modal` window has none, so the activity's are borrowed (as in `IsoSheetView`).
   */
  override fun onAttachedToWindow() {
    ensureViewTreeOwners()
    super.onAttachedToWindow()
    // a ComposeView cannot be measured before it has a window: it joins once attached
    post {
      if (isAttachedToWindow && composeView.parent == null) {
        addView(composeView)
        layoutCompose()
      }
    }
  }

  /** React Native swallows `requestLayout` in its view tree: measure and place the Compose view by hand. */
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

  // ── events → JS ──

  private fun emit(name: String, payload: WritableMap = Arguments.createMap()) {
    val surfaceId = UIManagerHelper.getSurfaceId(reactContext)
    UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)?.dispatchEvent(ModalEvent(surfaceId, id, name, payload))
  }

  private class ModalEvent(surfaceId: Int, viewId: Int, private val name: String, private val payload: WritableMap) :
    Event<ModalEvent>(surfaceId, viewId) {
    override fun getEventName(): String = name
    override fun getEventData(): WritableMap = payload
  }

  companion object {
    const val LAYOUT = "topModalLayout"
    const val DISMISS = "topModalDismiss"
    const val CLOSED = "topModalClosed"
    val EVENTS = listOf(LAYOUT, DISMISS, CLOSED)
  }
}

/** The children of the view are the modal's content, not the view's own children. */
internal fun IsoModalView.childAt(index: Int): View? = content.getChildAt(index)
