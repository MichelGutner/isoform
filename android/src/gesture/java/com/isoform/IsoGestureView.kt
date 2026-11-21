package com.isoform

import android.os.SystemClock
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.VelocityTracker
import android.view.ViewConfiguration
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import com.facebook.react.uimanager.events.NativeGestureUtil
import com.facebook.react.views.view.ReactViewGroup
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin

/** Continuous gesture moments sent to JS (`state` in the events). */
private const val STATE_START = 0
private const val STATE_MOVE = 1
private const val STATE_END = 2
private const val STATE_CANCEL = 3

/** `kind` of a tap event. */
private const val TAP_DOUBLE = 0
private const val TAP_LONG = 1

/** Longest gap between the two taps of a double tap, in ms (same as the web and iOS). */
private const val DOUBLE_TAP_MS = 300L

/** Turn needed before a rotation starts, in radians (about 6°), so a pinch does not also rotate by accident. */
private const val ROTATION_SLOP = 0.1

/**
 * `.gesture()` on Android: a regular React view (background, borders, children)
 * that also recognizes pan, pinch, rotation, double tap and long press on its
 * touches. Its events are bound in JS to `Animated.Value`s with the native driver,
 * so the view follows the fingers without a trip through JS.
 *
 * Positions are measured in the parent's coordinates (the event mapped through the
 * view's own transform): the view moves under the fingers, so its local coordinates
 * would chase themselves. Distances go to JS in dp, speeds in dp per second.
 */
class IsoGestureView(private val reactContext: ThemedReactContext) : ReactViewGroup(reactContext) {
  var panAxis = "none"
  var pinchEnabled = false
  var rotateEnabled = false
  var doubleTapEnabled = false
  var longPressEnabled = false
  var longPressDuration = 500L
  /** The one-finger pan may run together with pinch/rotation; `false`: the first to start wins. */
  var simultaneous = true

  private val density = resources.displayMetrics.density
  private val slop = ViewConfiguration.get(reactContext).scaledTouchSlop.toFloat()

  private val anyEnabled: Boolean
    get() = panAxis != "none" || pinchEnabled || rotateEnabled || doubleTapEnabled || longPressEnabled

  // ── one finger ──
  private var primaryId = MotionEvent.INVALID_POINTER_ID
  private var startX = 0f
  private var startY = 0f
  private var downLocalX = 0f
  private var downLocalY = 0f
  private var moved = false
  private var panActive = false
  private var velocity: VelocityTracker? = null

  // ── two fingers ──
  private var startDistance = 0.0
  private var startAngle = 0.0
  private var pinchActive = false
  private var rotateActive = false
  private var lastScale = 1.0
  private var lastRotation = 0.0
  private var lastTwoFingerTime = 0L
  private var scaleVelocity = 0.0
  private var rotationVelocity = 0.0

  // ── taps ──
  private var longPressFired = false
  private var lastTapTime = 0L
  private var lastTapX = 0f
  private var lastTapY = 0f
  private val longPressRunnable = Runnable {
    longPressFired = true
    dispatchTap(TAP_LONG, downLocalX, downLocalY)
  }

  private var claimed = false

  /** A child took the touch (an inner element with `.gesture()`, a scroll view): the innermost wins. */
  private var childClaimed = false

  fun reset() {
    removeCallbacks(longPressRunnable)
    velocity?.recycle()
    velocity = null
    primaryId = MotionEvent.INVALID_POINTER_ID
    panActive = false
    pinchActive = false
    rotateActive = false
    claimed = false
  }

  override fun requestDisallowInterceptTouchEvent(disallowIntercept: Boolean) {
    if (disallowIntercept) childClaimed = true
    super.requestDisallowInterceptTouchEvent(disallowIntercept)
  }

  override fun dispatchTouchEvent(event: MotionEvent): Boolean {
    if (!anyEnabled) return super.dispatchTouchEvent(event)
    if (event.actionMasked == MotionEvent.ACTION_DOWN) childClaimed = false
    // the children see the touch first: one that claims it (`requestDisallowInterceptTouchEvent`) wins
    if (!claimed) super.dispatchTouchEvent(event)
    if (childClaimed && !claimed) {
      yieldToChild(event)
      return true
    }
    val inParent = MotionEvent.obtain(event).apply { transform(matrix) }
    try {
      handle(event, inParent)
    } finally {
      inParent.recycle()
    }
    // keep receiving the whole stream, whether or not a child took the touch
    return true
  }

  /** A child claimed the touch: this view's gestures in progress end as cancelled, and nothing new starts. */
  private fun yieldToChild(event: MotionEvent) {
    if (primaryId == MotionEvent.INVALID_POINTER_ID) return
    removeCallbacks(longPressRunnable)
    if (panActive) dispatchPan(STATE_CANCEL, event, 0f, 0f)
    endTwoFingers(STATE_CANCEL)
    reset()
  }

  /** Plays a device tap: 0 light (snap, bounds), 1 medium (swipe, long press). */
  fun haptic(kind: Int) {
    performHapticFeedback(if (kind == 0) HapticFeedbackConstants.CLOCK_TICK else HapticFeedbackConstants.LONG_PRESS)
  }

  private fun handle(event: MotionEvent, inParent: MotionEvent) {
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> onDown(event, inParent)
      MotionEvent.ACTION_POINTER_DOWN -> onSecondFinger(inParent)
      MotionEvent.ACTION_MOVE -> onMove(event, inParent)
      MotionEvent.ACTION_POINTER_UP -> onFingerUp(event, inParent)
      MotionEvent.ACTION_UP -> onUp(event, inParent, STATE_END)
      MotionEvent.ACTION_CANCEL -> onUp(event, inParent, STATE_CANCEL)
    }
  }

  private fun onDown(event: MotionEvent, inParent: MotionEvent) {
    reset()
    primaryId = event.getPointerId(0)
    startX = inParent.x
    startY = inParent.y
    downLocalX = event.x
    downLocalY = event.y
    moved = false
    longPressFired = false
    velocity = VelocityTracker.obtain().also { it.addMovement(inParent) }
    if (longPressEnabled) postDelayed(longPressRunnable, longPressDuration)
  }

  private fun onSecondFinger(inParent: MotionEvent) {
    removeCallbacks(longPressRunnable)
    moved = true
    if (inParent.pointerCount < 2) return
    startDistance = distance(inParent)
    startAngle = angle(inParent)
    lastScale = 1.0
    lastRotation = 0.0
    lastTwoFingerTime = SystemClock.uptimeMillis()
  }

  private fun onMove(event: MotionEvent, inParent: MotionEvent) {
    velocity?.addMovement(inParent)
    val index = inParent.findPointerIndex(primaryId)
    if (index >= 0) trackPan(event, inParent, index)
    if (inParent.pointerCount >= 2) trackTwoFingers(event, inParent)
  }

  private fun trackPan(event: MotionEvent, inParent: MotionEvent, index: Int) {
    val dx = inParent.getX(index) - startX
    val dy = inParent.getY(index) - startY
    if (!moved && hypot(dx, dy) > slop) {
      moved = true
      removeCallbacks(longPressRunnable)
    }
    if (panAxis == "none") return
    if (!panActive) {
      val twoFingersOwnIt = !simultaneous && (pinchActive || rotateActive)
      if (!moved || inParent.pointerCount > 1 || twoFingersOwnIt || !movesAlong(dx, dy)) return
      panActive = true
      claim(event)
      dispatchPan(STATE_START, event, dx, dy)
      return
    }
    dispatchPan(STATE_MOVE, event, dx, dy)
  }

  private fun movesAlong(dx: Float, dy: Float): Boolean = when (panAxis) {
    "x" -> abs(dx) > abs(dy)
    "y" -> abs(dy) > abs(dx)
    else -> true
  }

  private fun trackTwoFingers(event: MotionEvent, inParent: MotionEvent) {
    if (startDistance <= 0.0) return
    val scale = distance(inParent) / startDistance
    val rotation = angleDelta(startAngle, angle(inParent))
    val now = SystemClock.uptimeMillis()
    val seconds = (now - lastTwoFingerTime).coerceAtLeast(1L) / 1000.0
    scaleVelocity = (scale - lastScale) / seconds
    rotationVelocity = (rotation - lastRotation) / seconds
    lastScale = scale
    lastRotation = rotation
    lastTwoFingerTime = now

    // with `simultaneous` off, a pan already running keeps the touch
    if (!simultaneous && panActive) return
    if (pinchEnabled) {
      val starts = !pinchActive && abs(scale - 1.0) * startDistance > slop
      if (starts) pinchActive = true
      if (pinchActive) dispatchPinch(if (starts) STATE_START else STATE_MOVE, event, scale)
    }
    if (rotateEnabled) {
      val starts = !rotateActive && abs(rotation) > ROTATION_SLOP
      if (starts) rotateActive = true
      if (rotateActive) dispatchRotate(if (starts) STATE_START else STATE_MOVE, rotation)
    }
    if (pinchActive || rotateActive) claim(event)
  }

  private fun onFingerUp(event: MotionEvent, inParent: MotionEvent) {
    // two fingers become one: pinch and rotation end
    if (inParent.pointerCount - 1 < 2) endTwoFingers(STATE_END)
    if (event.getPointerId(event.actionIndex) == primaryId && panActive) {
      val index = inParent.findPointerIndex(primaryId)
      dispatchPan(STATE_END, event, inParent.getX(index) - startX, inParent.getY(index) - startY)
      panActive = false
    }
  }

  private fun onUp(event: MotionEvent, inParent: MotionEvent, state: Int) {
    removeCallbacks(longPressRunnable)
    velocity?.addMovement(inParent)
    if (panActive) dispatchPan(state, event, inParent.x - startX, inParent.y - startY)
    endTwoFingers(state)
    if (state == STATE_END && !moved && !longPressFired && !claimed) onTap(event)
    if (claimed) NativeGestureUtil.notifyNativeGestureEnded(this, event)
    reset()
  }

  private fun endTwoFingers(state: Int) {
    if (pinchActive) dispatchPinchEnd(state)
    if (rotateActive) dispatchRotate(state, lastRotation)
    pinchActive = false
    rotateActive = false
    startDistance = 0.0
  }

  private fun onTap(event: MotionEvent) {
    if (!doubleTapEnabled) return
    val now = event.eventTime
    val isSecond = now - lastTapTime <= DOUBLE_TAP_MS && hypot(event.x - lastTapX, event.y - lastTapY) <= slop * 2
    if (isSecond) {
      lastTapTime = 0L
      dispatchTap(TAP_DOUBLE, event.x, event.y)
      return
    }
    lastTapTime = now
    lastTapX = event.x
    lastTapY = event.y
  }

  /** The first continuous gesture takes the touch: no scrolling parent, no JS touch (Pressables cancel). */
  private fun claim(event: MotionEvent) {
    if (claimed) return
    claimed = true
    removeCallbacks(longPressRunnable)
    parent?.requestDisallowInterceptTouchEvent(true)
    NativeGestureUtil.notifyNativeGestureStarted(this, event)
    // the children's own touch ends here
    val cancel = MotionEvent.obtain(event).apply { action = MotionEvent.ACTION_CANCEL }
    super.dispatchTouchEvent(cancel)
    cancel.recycle()
  }

  // ── geometry ──

  private fun distance(e: MotionEvent): Double = hypot((e.getX(1) - e.getX(0)).toDouble(), (e.getY(1) - e.getY(0)).toDouble())

  private fun angle(e: MotionEvent): Double = atan2((e.getY(1) - e.getY(0)).toDouble(), (e.getX(1) - e.getX(0)).toDouble())

  /** Difference between two angles in (-π, π], so crossing the ±π line does not jump a full turn. */
  private fun angleDelta(from: Double, to: Double): Double = atan2(sin(to - from), cos(to - from))

  // ── events → JS ──

  private fun dispatchPan(state: Int, event: MotionEvent, dx: Float, dy: Float) {
    val tracker = velocity
    tracker?.computeCurrentVelocity(1000)
    val vx = tracker?.getXVelocity(primaryId) ?: 0f
    val vy = tracker?.getYVelocity(primaryId) ?: 0f
    dispatch("topIsoPan", state, Arguments.createMap().apply {
      putDouble("translationX", (dx / density).toDouble())
      putDouble("translationY", (dy / density).toDouble())
      putDouble("velocityX", (vx / density).toDouble())
      putDouble("velocityY", (vy / density).toDouble())
      putDouble("x", (event.x / density).toDouble())
      putDouble("y", (event.y / density).toDouble())
    })
  }

  private fun dispatchPinch(state: Int, event: MotionEvent, scale: Double) {
    val focalX = if (event.pointerCount >= 2) (event.getX(0) + event.getX(1)) / 2 else event.x
    val focalY = if (event.pointerCount >= 2) (event.getY(0) + event.getY(1)) / 2 else event.y
    dispatch("topIsoPinch", state, Arguments.createMap().apply {
      putDouble("scale", scale)
      putDouble("velocity", scaleVelocity)
      putDouble("focalX", (focalX / density).toDouble())
      putDouble("focalY", (focalY / density).toDouble())
    })
  }

  private fun dispatchPinchEnd(state: Int) {
    dispatch("topIsoPinch", state, Arguments.createMap().apply {
      putDouble("scale", lastScale)
      putDouble("velocity", scaleVelocity)
      putDouble("focalX", 0.0)
      putDouble("focalY", 0.0)
    })
  }

  private fun dispatchRotate(state: Int, rotation: Double) {
    dispatch("topIsoRotate", state, Arguments.createMap().apply {
      putDouble("rotation", rotation)
      putDouble("velocity", rotationVelocity)
    })
  }

  private fun dispatchTap(kind: Int, x: Float, y: Float) {
    val payload = Arguments.createMap().apply {
      putInt("kind", kind)
      putDouble("x", (x / density).toDouble())
      putDouble("y", (y / density).toDouble())
    }
    send(GestureEvent(UIManagerHelper.getSurfaceId(reactContext), id, "topIsoTap", payload, coalesce = false))
  }

  private fun dispatch(name: String, state: Int, payload: WritableMap) {
    payload.putInt("state", state)
    // moves can be merged when JS (or the native driver) is behind; start/end never are
    send(GestureEvent(UIManagerHelper.getSurfaceId(reactContext), id, name, payload, coalesce = state == STATE_MOVE))
  }

  private fun send(event: GestureEvent) {
    UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)?.dispatchEvent(event)
  }

  private class GestureEvent(
    surfaceId: Int,
    viewId: Int,
    private val name: String,
    private val payload: WritableMap,
    private val coalesce: Boolean,
  ) : Event<GestureEvent>(surfaceId, viewId) {
    override fun getEventName(): String = name
    override fun getEventData(): WritableMap = payload
    override fun canCoalesce(): Boolean = coalesce
  }

  companion object {
    /** Native event names; JS props are the same with `on` instead of `top`. */
    val EVENTS = listOf("topIsoPan", "topIsoPinch", "topIsoRotate", "topIsoTap")
  }
}
