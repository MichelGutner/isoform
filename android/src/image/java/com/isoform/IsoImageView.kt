package com.isoform

import android.animation.ValueAnimator
import android.graphics.Canvas
import android.graphics.Outline
import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
import android.graphics.Rect
import android.graphics.RenderEffect
import android.graphics.Shader
import android.graphics.drawable.Animatable
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.os.Build
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import android.view.ViewOutlineProvider
import android.view.animation.PathInterpolator
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import com.facebook.react.uimanager.events.NativeGestureUtil
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * Where the picture is drawn in the box, in pixels (the same rule as `fitRect` in
 * `src/core/image.ts` and on iOS). [image] is the file's size in pixels.
 */
internal fun fitRect(fit: String, positionX: Float, positionY: Float, boxWidth: Float, boxHeight: Float, imageWidth: Float, imageHeight: Float): Rect {
  if (imageWidth <= 0f || imageHeight <= 0f || fit == "fill") return Rect(0, 0, boxWidth.roundToInt(), boxHeight.roundToInt())
  val scaleX = boxWidth / imageWidth
  val scaleY = boxHeight / imageHeight
  val scale = when (fit) {
    "contain" -> min(scaleX, scaleY)
    "none" -> 1f
    "scaleDown" -> min(1f, min(scaleX, scaleY))
    else -> max(scaleX, scaleY)
  }
  val width = imageWidth * scale
  val height = imageHeight * scale
  val left = (boxWidth - width) * positionX
  val top = (boxHeight - height) * positionY
  return Rect(left.roundToInt(), top.roundToInt(), (left + width).roundToInt(), (top + height).roundToInt())
}

/**
 * The lib's image view on Android: loads through [IsoImagePipeline], draws the picture
 * with `contentFit`/position on a canvas, crossfades from a blurhash or placeholder,
 * tints, blurs, plays animations and handles the viewer gestures (pinch, drag while
 * zoomed, double tap, rotation) — the same behavior as iOS.
 */
class IsoImageView(private val reactContext: ThemedReactContext) : View(reactContext) {
  private val density = resources.displayMetrics.density

  // props
  private var uri = ""
  private var cacheKey = ""
  private var headers = emptyMap<String, String>()
  private var placeholderUri = ""
  private var blurhash = ""
  private var fit = "cover"
  private var positionX = 0.5f
  private var positionY = 0.5f
  private var transition = 250L
  private var tint: Int? = null
  private var blurRadius = 0f
  private var cachePolicy = "memoryDisk"
  private var priority = 1
  private var autoplay = true
  private var zoomable = false
  private var maxZoom = 4f
  private var doubleTapZoom = 2.5f
  private var rotatable = false
  private var cornerRadius = 0f

  // state
  private var sourceChanged = false
  private var placeholderChanged = false
  private var decoded: IsoDecodedImage? = null
  private var image: Drawable? = null
  private var placeholder: Drawable? = null
  private var placeholderIsHash = false
  private var loadedKey = ""
  private var ticket: IsoImageTicket? = null
  private var placeholderTicket: IsoImageTicket? = null
  private var imageAlpha = 0f
  private var fade: ValueAnimator? = null

  // zoom (pixels and degrees)
  private var scale = 1f
  private var offsetX = 0f
  private var offsetY = 0f
  private var rotation = 0f
  private var settle: ValueAnimator? = null
  private var gesturing = false
  private var lastAngle = 0f

  init {
    IsoImagePipeline.init(reactContext)
    outlineProvider = object : ViewOutlineProvider() {
      override fun getOutline(view: View, outline: Outline) = outline.setRoundRect(0, 0, view.width, view.height, cornerRadius)
    }
    clipToOutline = true
  }

  // ── props (applied by [commit]) ──

  fun setSource(uri: String, cacheKey: String, headers: ReadableArray?) {
    val next = headerMap((0 until (headers?.size() ?: 0)).mapNotNull { headers?.getString(it) })
    if (uri == this.uri && cacheKey == this.cacheKey && next == this.headers) return
    this.uri = uri
    this.cacheKey = cacheKey
    this.headers = next
    sourceChanged = true
  }

  fun setPlaceholder(uri: String, blurhash: String) {
    if (uri == placeholderUri && blurhash == this.blurhash) return
    placeholderUri = uri
    this.blurhash = blurhash
    placeholderChanged = true
  }

  fun setFit(value: String) { fit = value; invalidate() }
  fun setPositionX(value: Double) { positionX = value.toFloat(); invalidate() }
  fun setPositionY(value: Double) { positionY = value.toFloat(); invalidate() }
  fun setTransition(value: Double) { transition = value.toLong().coerceAtLeast(0) }

  fun setTint(value: Int?) {
    tint = value
    image?.colorFilter = value?.let { PorterDuffColorFilter(it, PorterDuff.Mode.SRC_IN) }
    invalidate()
  }

  fun setBlurRadius(value: Double) {
    val next = value.toFloat()
    if (next == blurRadius) return
    blurRadius = next
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val radius = next * density
      setRenderEffect(if (next > 0f) RenderEffect.createBlurEffect(radius, radius, Shader.TileMode.CLAMP) else null)
    } else {
      sourceChanged = true
    }
  }

  fun setCachePolicy(value: String) { cachePolicy = value }
  fun setPriority(value: String) { priority = mapOf("low" to 0, "high" to 2)[value] ?: 1 }

  fun setAutoplay(value: Boolean) {
    if (value == autoplay) return
    autoplay = value
    if (value) play() else pause()
  }

  fun setZoomable(value: Boolean) { zoomable = value }
  fun setMaxZoom(value: Double) { maxZoom = max(1f, value.toFloat()) }
  fun setDoubleTapZoom(value: Double) { doubleTapZoom = max(1f, value.toFloat()) }
  fun setRotatable(value: Boolean) { rotatable = value }

  fun setCornerRadius(value: Double) {
    cornerRadius = value.toFloat() * density
    invalidateOutline()
  }

  /** Applies the props set since the last call (the manager calls it after each update). */
  fun commit() {
    if (scale > maxZoom) zoomTo(maxZoom.toDouble(), -1.0, -1.0, false)
    if (placeholderChanged) loadPlaceholder()
    if (sourceChanged) load(reload = false)
    invalidate()
  }

  // ── loading ──

  private fun request(reload: Boolean) = IsoImageRequest(
    uri = uri,
    cacheKey = cacheKey,
    headers = headers,
    memory = cachePolicy == "memoryDisk" || cachePolicy == "memory",
    disk = cachePolicy == "memoryDisk" || cachePolicy == "disk",
    priority = priority,
    viewWidth = width,
    viewHeight = height,
    fit = fit,
    zoom = if (zoomable) maxZoom else 1f,
    blurRadius = blurRadius * density,
    reload = reload || cachePolicy == "none",
  )

  /** Starts loading [uri] (it waits for a size: the picture is decoded for it). */
  private fun load(reload: Boolean) {
    if (width == 0 || height == 0) return
    sourceChanged = false
    ticket?.cancel()
    ticket = null
    if (uri.isEmpty()) return clearImage()
    val request = request(reload)
    // a sharper version of the same picture keeps the current one on screen meanwhile
    val samePicture = decoded != null && !reload && loadedKey == request.memoryKey
    if (!samePicture) clearImage()
    loadedKey = request.memoryKey
    if (IsoImagePipeline.cached(request) == null) emit(LOAD_START)
    ticket = IsoImagePipeline.load(
      request,
      progress = { loaded, total -> emit(PROGRESS, Arguments.createMap().apply { putDouble("loaded", loaded.toDouble()); putDouble("total", total.toDouble()) }) },
    ) { result ->
      ticket = null
      result
        .onSuccess { (picture, type) -> show(picture, type, fadeIn = !samePicture) }
        .onFailure { emit(ERROR, Arguments.createMap().apply { putString("message", it.message ?: "Image failed to load") }) }
    }
  }

  private fun clearImage() {
    stopImage()
    decoded = null
    image = null
    fade?.cancel()
    imageAlpha = 0f
    invalidate()
  }

  private fun show(picture: IsoDecodedImage, type: IsoCacheType, fadeIn: Boolean) {
    decoded = picture
    val done = {
      reveal(fadeIn && type != IsoCacheType.MEMORY)
      emit(LOAD, Arguments.createMap().apply {
        putDouble("width", picture.pixelWidth.toDouble())
        putDouble("height", picture.pixelHeight.toDouble())
        putString("cacheType", type.value)
      })
    }
    val bytes = picture.animated
    if (bytes == null) {
      setImage(BitmapDrawable(resources, picture.bitmap))
      return done()
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
      setImage(BitmapDrawable(resources, IsoImagePipeline.firstFrame(bytes)))
      return done()
    }
    val target = (picture.decodedLongSide * picture.pixelWidth / max(1, max(picture.pixelWidth, picture.pixelHeight))).toInt()
    IsoImagePipeline.animation(bytes, target) { drawable ->
      if (decoded !== picture) return@animation
      setImage(drawable ?: BitmapDrawable(resources, IsoImagePipeline.firstFrame(bytes)))
      done()
    }
  }

  private fun setImage(drawable: Drawable) {
    stopImage()
    image = drawable.also {
      it.callback = this
      it.colorFilter = tint?.let { color -> PorterDuffColorFilter(color, PorterDuff.Mode.SRC_IN) }
    }
    if (autoplay && isAttachedToWindow) play()
    invalidate()
  }

  private fun stopImage() {
    (image as? Animatable)?.stop()
    image?.callback = null
  }

  /** Shows the picture: a crossfade from the placeholder, or at once. */
  private fun reveal(animated: Boolean) {
    fade?.cancel()
    if (!animated || transition == 0L) {
      imageAlpha = 1f
      return invalidate()
    }
    fade = ValueAnimator.ofFloat(imageAlpha, 1f).apply {
      duration = transition
      interpolator = PathInterpolator(0f, 0f, 0.2f, 1f)
      addUpdateListener {
        imageAlpha = it.animatedValue as Float
        invalidate()
      }
      start()
    }
  }

  private fun loadPlaceholder() {
    placeholderChanged = false
    placeholderTicket?.cancel()
    placeholderTicket = null
    placeholderIsHash = blurhash.isNotEmpty()
    placeholder = if (placeholderIsHash) IsoBlurhash.bitmap(blurhash)?.let { BitmapDrawable(resources, it) } else null
    invalidate()
    if (placeholderIsHash || placeholderUri.isEmpty()) return
    placeholderTicket = IsoImagePipeline.load(IsoImageRequest(placeholderUri, priority = 2)) { result ->
      placeholderTicket = null
      result.onSuccess { (picture, _) ->
        placeholder = (picture.bitmap ?: picture.animated?.let(IsoImagePipeline::firstFrame))?.let { BitmapDrawable(resources, it) }
        invalidate()
      }
    }
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    invalidateOutline()
    val picture = decoded
    when {
      sourceChanged -> load(reload = false)
      picture != null && ticket == null && !picture.covers(IsoImagePipeline.neededLongSide(picture.pixelWidth, picture.pixelHeight, request(false))) -> load(reload = false)
    }
  }

  // ── drawing ──

  override fun verifyDrawable(who: Drawable): Boolean = who === image || who === placeholder || super.verifyDrawable(who)

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val w = width.toFloat()
    val h = height.toFloat()
    if (w <= 0f || h <= 0f) return
    canvas.save()
    canvas.translate(w / 2f + offsetX, h / 2f + offsetY)
    canvas.rotate(rotation)
    canvas.scale(scale, scale)
    canvas.translate(-w / 2f, -h / 2f)
    placeholder?.takeIf { imageAlpha < 1f }?.let {
      // a blurhash has no real size: it covers the box
      it.bounds = fitRect(if (placeholderIsHash) "cover" else fit, if (placeholderIsHash) 0.5f else positionX, if (placeholderIsHash) 0.5f else positionY, w, h, it.intrinsicWidth.toFloat(), it.intrinsicHeight.toFloat())
      it.alpha = 255
      it.draw(canvas)
    }
    val picture = decoded
    image?.takeIf { picture != null && imageAlpha > 0f }?.let {
      it.bounds = fitRect(fit, positionX, positionY, w, h, picture!!.pixelWidth.toFloat(), picture.pixelHeight.toFloat())
      it.alpha = (imageAlpha * 255).roundToInt()
      it.draw(canvas)
    }
    canvas.restore()
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (autoplay) play()
  }

  override fun onDetachedFromWindow() {
    (image as? Animatable)?.stop()
    super.onDetachedFromWindow()
  }

  // ── zoom ──

  /** Largest offset on each axis: the part of the zoomed (and rotated) picture that overflows the box. */
  private fun limit(atScale: Float, atRotation: Float): Pair<Float, Float> {
    val radians = Math.toRadians(atRotation.toDouble())
    val cosine = abs(cos(radians)).toFloat()
    val sine = abs(sin(radians)).toFloat()
    val w = (width * cosine + height * sine) * atScale
    val h = (width * sine + height * cosine) * atScale
    return max(0f, (w - width) / 2f) to max(0f, (h - height) / 2f)
  }

  private fun clampX(value: Float, atScale: Float = scale, atRotation: Float = rotation) = limit(atScale, atRotation).first.let { value.coerceIn(-it, it) }
  private fun clampY(value: Float, atScale: Float = scale, atRotation: Float = rotation) = limit(atScale, atRotation).second.let { value.coerceIn(-it, it) }

  private fun canPan(): Boolean = limit(scale, rotation).let { it.first > 0.5f || it.second > 0.5f }

  private fun emitZoom() {
    emit(ZOOM, Arguments.createMap().apply {
      putDouble("scale", scale.toDouble())
      putDouble("x", (offsetX / density).toDouble())
      putDouble("y", (offsetY / density).toDouble())
      putDouble("rotation", rotation.toDouble())
    })
  }

  /** Moves to a zoom state, animated or at once. */
  private fun moveTo(toScale: Float, toX: Float, toY: Float, toRotation: Float, animated: Boolean) {
    settle?.cancel()
    if (!animated) {
      scale = toScale; offsetX = toX; offsetY = toY; rotation = toRotation
      invalidate()
      return emitZoom()
    }
    val from = floatArrayOf(scale, offsetX, offsetY, rotation)
    val to = floatArrayOf(toScale, toX, toY, toRotation)
    settle = ValueAnimator.ofFloat(0f, 1f).apply {
      duration = 320
      interpolator = PathInterpolator(0.2f, 0f, 0f, 1f)
      addUpdateListener {
        val t = it.animatedFraction
        scale = from[0] + (to[0] - from[0]) * t
        offsetX = from[1] + (to[1] - from[1]) * t
        offsetY = from[2] + (to[2] - from[2]) * t
        rotation = from[3] + (to[3] - from[3]) * t
        invalidate()
        emitZoom()
      }
      start()
    }
  }

  /** Zooms keeping the focus (pixels from the center) still. */
  private fun zoomAround(target: Float, focusX: Float, focusY: Float, animated: Boolean) {
    val next = target.coerceIn(1f, maxZoom)
    val x = focusX - (focusX - offsetX) * next / scale
    val y = focusY - (focusY - offsetY) * next / scale
    moveTo(next, clampX(x, next), clampY(y, next), rotation, animated)
  }

  private var focusX = 0f
  private var focusY = 0f

  private val scaleDetector = ScaleGestureDetector(reactContext, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
    override fun onScaleBegin(detector: ScaleGestureDetector): Boolean {
      settle?.cancel()
      focusX = detector.focusX - width / 2f
      focusY = detector.focusY - height / 2f
      return true
    }

    override fun onScale(detector: ScaleGestureDetector): Boolean {
      // a little past the limits while pinching (it springs back on release)
      val next = (scale * detector.scaleFactor).coerceIn(0.8f, maxZoom * 1.2f)
      val fx = detector.focusX - width / 2f
      val fy = detector.focusY - height / 2f
      offsetX = fx - (focusX - offsetX) * next / scale
      offsetY = fy - (focusY - offsetY) * next / scale
      scale = next
      focusX = fx
      focusY = fy
      invalidate()
      emitZoom()
      return true
    }

    override fun onScaleEnd(detector: ScaleGestureDetector) {
      zoomAround(scale, detector.focusX - width / 2f, detector.focusY - height / 2f, true)
    }
  })

  private val gestureDetector = GestureDetector(reactContext, object : GestureDetector.SimpleOnGestureListener() {
    override fun onDown(e: MotionEvent): Boolean = true

    override fun onDoubleTap(e: MotionEvent): Boolean {
      if (scale > 1.01f) resetZoom(true) else zoomAround(doubleTapZoom, e.x - width / 2f, e.y - height / 2f, true)
      return true
    }

    override fun onScroll(e1: MotionEvent?, e2: MotionEvent, distanceX: Float, distanceY: Float): Boolean {
      if (scaleDetector.isInProgress || !canPan()) return false
      startGesture(e2)
      offsetX = clampX(offsetX - distanceX)
      offsetY = clampY(offsetY - distanceY)
      invalidate()
      emitZoom()
      return true
    }

    override fun onFling(e1: MotionEvent?, e2: MotionEvent, velocityX: Float, velocityY: Float): Boolean {
      if (!canPan()) return false
      // keeps gliding a little, like a scroll view
      moveTo(scale, clampX(offsetX + velocityX * 0.12f), clampY(offsetY + velocityY * 0.12f), rotation, true)
      return true
    }
  })

  /** The gesture is ours: the scroll view around stops intercepting and React Native cancels the JS press. */
  private fun startGesture(event: MotionEvent) {
    parent?.requestDisallowInterceptTouchEvent(true)
    if (!gesturing) {
      gesturing = true
      NativeGestureUtil.notifyNativeGestureStarted(this, event)
    }
  }

  private fun angle(event: MotionEvent): Float =
    Math.toDegrees(atan2((event.getY(1) - event.getY(0)).toDouble(), (event.getX(1) - event.getX(0)).toDouble())).toFloat()

  override fun onTouchEvent(event: MotionEvent): Boolean {
    if (!zoomable) return super.onTouchEvent(event)
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        gesturing = false
        // zoomed: the drag is ours from the start; otherwise the scroll view around may take it
        if (canPan()) parent?.requestDisallowInterceptTouchEvent(true)
      }
      MotionEvent.ACTION_POINTER_DOWN -> {
        startGesture(event)
        if (event.pointerCount == 2) lastAngle = angle(event)
      }
      MotionEvent.ACTION_MOVE -> if (rotatable && event.pointerCount >= 2) {
        val next = angle(event)
        rotation += ((next - lastAngle + 540f) % 360f) - 180f
        lastAngle = next
        invalidate()
      }
      MotionEvent.ACTION_POINTER_UP -> if (rotatable && event.pointerCount == 2) {
        // snaps to a right angle
        val snapped = Math.round(rotation / 90f) * 90f
        moveTo(scale, clampX(offsetX, scale, snapped), clampY(offsetY, scale, snapped), snapped, true)
      }
      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> gesturing = false
    }
    scaleDetector.onTouchEvent(event)
    gestureDetector.onTouchEvent(event)
    return true
  }

  // ── commands (the `ref`) ──

  /** [focusX]/[focusY] in dp from the top-left corner (negative = the center). */
  fun zoomTo(value: Double, focusX: Double, focusY: Double, animated: Boolean) {
    val fx = if (focusX < 0 || focusY < 0) 0f else focusX.toFloat() * density - width / 2f
    val fy = if (focusX < 0 || focusY < 0) 0f else focusY.toFloat() * density - height / 2f
    zoomAround(value.toFloat(), fx, fy, animated)
  }

  fun resetZoom(animated: Boolean) = moveTo(1f, 0f, 0f, 0f, animated)

  fun rotateTo(degrees: Double, animated: Boolean) {
    val next = degrees.toFloat()
    moveTo(scale, clampX(offsetX, scale, next), clampY(offsetY, scale, next), next, animated)
  }

  fun play() { (image as? Animatable)?.start() }

  fun pause() { (image as? Animatable)?.stop() }

  fun reload() = load(reload = true)

  fun release() {
    ticket?.cancel()
    placeholderTicket?.cancel()
    fade?.cancel()
    settle?.cancel()
    stopImage()
  }

  // ── events → JS ──

  private fun emit(name: String, payload: WritableMap = Arguments.createMap()) {
    val surfaceId = UIManagerHelper.getSurfaceId(reactContext)
    UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)?.dispatchEvent(ImageEvent(surfaceId, id, name, payload))
  }

  private class ImageEvent(surfaceId: Int, viewId: Int, private val name: String, private val payload: WritableMap) :
    Event<ImageEvent>(surfaceId, viewId) {
    override fun getEventName(): String = name
    override fun getEventData(): WritableMap = payload
    // progress and zoom fire often: only the newest one of a frame matters
    override fun canCoalesce(): Boolean = name == PROGRESS || name == ZOOM
  }

  companion object {
    const val LOAD_START = "topImageLoadStart"
    const val PROGRESS = "topImageProgress"
    const val LOAD = "topImageLoad"
    const val ERROR = "topImageError"
    const val ZOOM = "topImageZoom"
    val EVENTS = listOf(LOAD_START, PROGRESS, LOAD, ERROR, ZOOM)
  }
}
