package com.omnistyle

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.URL
import kotlin.math.cos
import kotlin.math.sin

/**
 * Controls of `Audio` in Jetpack Compose: a rounded card with cover, title,
 * artist and speed menu, a seek bar with elapsed and remaining time, −10 s ·
 * play/pause · +10 s, and mute. It follows the system light/dark theme.
 */

private const val SKIP_SECONDS = 10.0
private val SPEEDS = listOf(0.5f, 0.75f, 1f, 1.25f, 1.5f, 2f)
private val ACCENT = Color(0xFF0A84FF)

/** The card palette, for the light or dark theme. */
private class AudioColors(val card: Color, val text: Color, val muted: Color, val rail: Color, val buffer: Color, val chip: Color, val menu: Color) {
  companion object {
    val Light = AudioColors(Color(0xFFF2F2F7), Color(0xFF1C1C1E), Color(0xFF6E6E73), Color(0x2E3C3C43), Color(0x383C3C43), Color(0x143C3C43), Color(0xFFFFFFFF))
    val Dark = AudioColors(Color(0xFF1C1C1E), Color.White, Color(0xFF98989F), Color(0x33EBEBF5), Color(0x4DEBEBF5), Color(0x1FFFFFFF), Color(0xFF2C2C2E))
  }
}

/** State that the native view updates and the controls read. */
class OmniAudioUiState {
  var isPlaying by mutableStateOf(false)
  var isBuffering by mutableStateOf(false)
  var muted by mutableStateOf(false)
  var controlsEnabled by mutableStateOf(true)
  var position by mutableDoubleStateOf(0.0)
  var duration by mutableDoubleStateOf(0.0)
  var buffered by mutableDoubleStateOf(0.0)
  var rate by mutableFloatStateOf(1f)
  var title by mutableStateOf("")
  var artist by mutableStateOf("")
  var artwork by mutableStateOf("")

  fun reset() {
    isPlaying = false
    isBuffering = false
    position = 0.0
    duration = 0.0
    buffered = 0.0
  }
}

@Composable
internal fun OmniAudioControls(
  state: OmniAudioUiState,
  onTogglePlay: () -> Unit,
  onSkip: (Double) -> Unit,
  onSeek: (Double) -> Unit,
  onToggleMute: () -> Unit,
  onRateSelected: (Float) -> Unit,
) {
  if (!state.controlsEnabled) return
  val colors = if (isSystemInDarkTheme()) AudioColors.Dark else AudioColors.Light
  // position while dragging the bar: the seek only happens on release
  var scrub by remember { mutableStateOf<Double?>(null) }
  val shown = scrub ?: state.position

  Column(
    modifier = Modifier
      .fillMaxSize()
      .clip(RoundedCornerShape(20.dp))
      .background(colors.card)
      .padding(horizontal = 16.dp, vertical = 14.dp),
    verticalArrangement = Arrangement.spacedBy(10.dp),
  ) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
      Artwork(state.artwork)
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        AudioText(state.title.ifEmpty { "Audio" }, colors.text, 15, FontWeight.SemiBold)
        if (state.artist.isNotEmpty()) AudioText(state.artist, colors.muted, 13, FontWeight.Normal)
      }
      SpeedMenu(state.rate, colors, onRateSelected)
    }

    Column {
      SeekBar(
        position = shown,
        duration = state.duration,
        buffered = state.buffered,
        colors = colors,
        onScrub = { scrub = it },
        onSeek = onSeek,
      )
      Row(modifier = Modifier.fillMaxWidth()) {
        TimeText(clock(shown), colors.muted, TextAlign.Start, Modifier.weight(1f))
        TimeText(if (state.duration > 0) "−" + clock(state.duration - shown) else "", colors.muted, TextAlign.End, Modifier.weight(1f))
      }
    }

    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
      IconButton("Back 10 seconds", 42, colors.text, onClick = { onSkip(-SKIP_SECONDS) }) { AudioSkipIcon(forward = false, color = colors.text) }
      PlayButton(state.isPlaying, state.isBuffering && state.isPlaying, onTogglePlay)
      IconButton("Forward 10 seconds", 42, colors.text, onClick = { onSkip(SKIP_SECONDS) }) { AudioSkipIcon(forward = true, color = colors.text) }
      Spacer(Modifier.weight(1f))
      IconButton(if (state.muted) "Unmute" else "Mute", 40, colors.text, onClick = onToggleMute) { AudioSpeakerIcon(state.muted, colors.text) }
    }
  }
}

// ── pieces ──

@Composable
private fun AudioText(text: String, color: Color, size: Int, weight: FontWeight) {
  BasicText(
    text = text,
    maxLines = 1,
    overflow = TextOverflow.Ellipsis,
    style = TextStyle(color = color, fontSize = size.sp, fontWeight = weight),
  )
}

@Composable
private fun TimeText(text: String, color: Color, align: TextAlign, modifier: Modifier) {
  BasicText(
    text = text,
    modifier = modifier,
    style = TextStyle(color = color, fontSize = 12.sp, textAlign = align, fontFeatureSettings = "tnum"),
  )
}

private val artworkCache = LruCache<String, Bitmap>(16)

/** The image at [url], downloaded once and cached (`null` while loading or if it fails). */
@Composable
private fun rememberArtwork(url: String): Bitmap? =
  produceState<Bitmap?>(initialValue = artworkCache.get(url), url) {
    value = if (url.isEmpty()) null else artworkCache.get(url) ?: download(url)
  }.value

private suspend fun download(url: String): Bitmap? =
  withContext(Dispatchers.IO) {
    runCatching { URL(url).openStream().use { BitmapFactory.decodeStream(it) } }.getOrNull()
  }?.also { artworkCache.put(url, it) }

/** Cover: the image over a gradient with a music note. */
@Composable
private fun Artwork(url: String) {
  val bitmap = rememberArtwork(url)
  Box(
    modifier = Modifier
      .size(56.dp)
      .clip(RoundedCornerShape(12.dp))
      .background(Brush.linearGradient(listOf(Color(0xFF5E5CE6), Color(0xFF0A84FF), Color(0xFF64D2FF)))),
    contentAlignment = Alignment.Center,
  ) {
    MusicNote()
    bitmap?.let { Image(it.asImageBitmap(), contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize()) }
  }
}

/** Circle button with a press animation (scales down while pressed). */
@Composable
private fun IconButton(description: String, size: Int, color: Color, onClick: () -> Unit, content: @Composable () -> Unit) {
  val source = remember { MutableInteractionSource() }
  val pressed by source.collectIsPressedAsState()
  val scale by animateFloatAsState(if (pressed) 0.88f else 1f, tween(120), label = "press")
  Box(
    modifier = Modifier
      .size(size.dp)
      .graphicsLayer { scaleX = scale; scaleY = scale }
      .clip(CircleShape)
      .background(if (pressed) color.copy(alpha = 0.1f) else Color.Transparent)
      .clickable(interactionSource = source, indication = null, onClick = onClick)
      .semantics { contentDescription = description },
    contentAlignment = Alignment.Center,
  ) { content() }
}

/** The big filled play/pause button, with a ring while buffering. */
@Composable
private fun PlayButton(playing: Boolean, buffering: Boolean, onClick: () -> Unit) {
  val source = remember { MutableInteractionSource() }
  val pressed by source.collectIsPressedAsState()
  val scale by animateFloatAsState(if (pressed) 0.92f else 1f, tween(120), label = "playPress")
  Box(
    modifier = Modifier
      .size(52.dp)
      .graphicsLayer { scaleX = scale; scaleY = scale }
      .shadow(8.dp, CircleShape, ambientColor = ACCENT, spotColor = ACCENT)
      .clip(CircleShape)
      .background(ACCENT)
      .clickable(interactionSource = source, indication = null, onClick = onClick)
      .semantics { contentDescription = if (playing) "Pause" else "Play" },
    contentAlignment = Alignment.Center,
  ) {
    Crossfade(targetState = playing, animationSpec = tween(160), label = "playPause") { isPlaying ->
      Canvas(Modifier.size(24.dp)) { if (isPlaying) drawPause(Color.White) else drawPlay(Color.White) }
    }
    if (buffering) BufferingRing()
  }
}

@Composable
private fun BufferingRing() {
  val transition = rememberInfiniteTransition(label = "ring")
  val angle by transition.animateFloat(0f, 360f, infiniteRepeatable(tween(800, easing = LinearEasing)), label = "angle")
  Canvas(Modifier.fillMaxSize().graphicsLayer { rotationZ = angle }) {
    drawArc(Color.White, startAngle = 0f, sweepAngle = 90f, useCenter = false, style = Stroke(3.dp.toPx(), cap = StrokeCap.Round))
  }
}

/** "1x" chip that opens the speed list in a popup, with a ✓ on the current one. */
@Composable
private fun SpeedMenu(rate: Float, colors: AudioColors, onSelect: (Float) -> Unit) {
  var open by remember { mutableStateOf(false) }
  val offset = with(LocalDensity.current) { IntOffset(0, 40.dp.roundToPx()) }
  Box {
    Box(
      modifier = Modifier
        .clip(CircleShape)
        .background(colors.chip)
        .clickable { open = true }
        .padding(horizontal = 12.dp, vertical = 7.dp)
        .semantics { contentDescription = "Speed: ${rateLabel(rate)}" },
    ) { AudioText(rateLabel(rate), colors.text, 13, FontWeight.SemiBold) }

    if (open) {
      Popup(alignment = Alignment.TopEnd, offset = offset, onDismissRequest = { open = false }, properties = PopupProperties(focusable = true)) {
        Column(
          modifier = Modifier
            .width(150.dp)
            .shadow(16.dp, RoundedCornerShape(14.dp))
            .clip(RoundedCornerShape(14.dp))
            .background(colors.menu)
            .padding(6.dp),
        ) {
          SPEEDS.forEach { speed ->
            Row(
              modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .clickable { onSelect(speed); open = false }
                .padding(horizontal = 10.dp, vertical = 9.dp),
              verticalAlignment = Alignment.CenterVertically,
            ) {
              Box(Modifier.width(22.dp)) { if (speed == rate) Canvas(Modifier.size(14.dp)) { drawCheck(ACCENT) } }
              AudioText(rateLabel(speed), colors.text, 14, FontWeight.Normal)
            }
          }
        }
      }
    }
  }
}

/** Seek bar: tap to jump, drag to scrub (the seek happens on release). Shows the buffered range. */
@Composable
private fun SeekBar(
  position: Double,
  duration: Double,
  buffered: Double,
  colors: AudioColors,
  onScrub: (Double?) -> Unit,
  onSeek: (Double) -> Unit,
) {
  var width by remember { mutableIntStateOf(1) }
  var dragging by remember { mutableStateOf(false) }
  var dragTime by remember { mutableDoubleStateOf(0.0) }
  val growth by animateFloatAsState(if (dragging) 1f else 0.6f, tween(120), label = "thumb")
  fun timeAt(x: Float) = (x / width).coerceIn(0f, 1f) * duration

  Box(
    modifier = Modifier
      .fillMaxWidth()
      .height(28.dp)
      .onSizeChanged { width = it.width.coerceAtLeast(1) }
      .pointerInput(duration) {
        detectTapGestures { offset -> if (duration > 0) onSeek(timeAt(offset.x)) }
      }
      .pointerInput(duration) {
        detectHorizontalDragGestures(
          onDragStart = { offset ->
            if (duration > 0) {
              dragging = true
              dragTime = timeAt(offset.x)
              onScrub(dragTime)
            }
          },
          onDragEnd = {
            if (dragging) onSeek(dragTime) // the seek is committed on release
            dragging = false
            onScrub(null)
          },
          onDragCancel = {
            dragging = false
            onScrub(null)
          },
          onHorizontalDrag = { change, _ ->
            if (dragging) {
              dragTime = timeAt(change.position.x)
              onScrub(dragTime)
            }
          },
        )
      }
      .semantics { contentDescription = "Progress" },
  ) {
    Canvas(Modifier.fillMaxSize()) {
      val trackHeight = 4.dp.toPx()
      val top = (size.height - trackHeight) / 2
      val radius = CornerRadius(trackHeight / 2)
      fun bar(fraction: Float, color: Color) =
        drawRoundRect(color, Offset(0f, top), Size(size.width * fraction, trackHeight), radius)

      val played = if (duration > 0) (position / duration).toFloat().coerceIn(0f, 1f) else 0f
      val loaded = if (duration > 0) (buffered / duration).toFloat().coerceIn(0f, 1f) else 0f
      bar(1f, colors.rail)
      bar(loaded, colors.buffer)
      bar(played, ACCENT)
      drawCircle(Color.White, radius = 10.dp.toPx() * growth, center = Offset(size.width * played, size.height / 2))
    }
  }
}

// ── helpers ──

private fun rateLabel(rate: Float): String = (if (rate == rate.toInt().toFloat()) rate.toInt().toString() else rate.toString()) + "x"

/** 75 → "1:15"; 3725 → "1:02:05". */
private fun clock(seconds: Double): String {
  val total = if (seconds.isFinite()) seconds.toLong().coerceAtLeast(0) else 0L
  val (h, m, s) = Triple(total / 3600, total % 3600 / 60, total % 60)
  return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}

// ── icons (drawn, no icon library) ──

private fun DrawScope.drawPlay(color: Color) {
  val path = Path().apply {
    moveTo(size.width * 0.28f, size.height * 0.16f)
    lineTo(size.width * 0.86f, size.height * 0.5f)
    lineTo(size.width * 0.28f, size.height * 0.84f)
    close()
  }
  drawPath(path, color)
}

private fun DrawScope.drawPause(color: Color) {
  val barWidth = size.width * 0.24f
  val radius = CornerRadius(barWidth / 3)
  drawRoundRect(color, Offset(size.width * 0.2f, size.height * 0.14f), Size(barWidth, size.height * 0.72f), radius)
  drawRoundRect(color, Offset(size.width * 0.56f, size.height * 0.14f), Size(barWidth, size.height * 0.72f), radius)
}

private fun DrawScope.drawCheck(color: Color) {
  val path = Path().apply {
    moveTo(size.width * 0.08f, size.height * 0.54f)
    lineTo(size.width * 0.38f, size.height * 0.84f)
    lineTo(size.width * 0.94f, size.height * 0.18f)
  }
  drawPath(path, color, style = Stroke(2.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
}

@Composable
private fun MusicNote() {
  Canvas(Modifier.size(26.dp)) {
    val w = size.width
    val h = size.height
    drawCircle(Color.White, radius = w * 0.17f, center = Offset(w * 0.3f, h * 0.76f))
    drawCircle(Color.White, radius = w * 0.17f, center = Offset(w * 0.74f, h * 0.66f))
    val stem = w * 0.07f
    drawRoundRect(Color.White, Offset(w * 0.42f, h * 0.18f), Size(stem, h * 0.58f), CornerRadius(stem / 2))
    drawRoundRect(Color.White, Offset(w * 0.86f, h * 0.08f), Size(stem, h * 0.58f), CornerRadius(stem / 2))
    drawRoundRect(Color.White, Offset(w * 0.42f, h * 0.08f), Size(w * 0.51f, h * 0.18f), CornerRadius(stem))
  }
}

/** Circular arrow with "10" in the middle; `forward` mirrors it. */
@Composable
private fun AudioSkipIcon(forward: Boolean, color: Color) {
  Box(Modifier.size(28.dp), contentAlignment = Alignment.Center) {
    Canvas(Modifier.fillMaxSize()) {
      val stroke = 1.8.dp.toPx()
      val inset = stroke + 2.dp.toPx()
      val box = Size(size.width - 2 * inset, size.height - 2 * inset)
      val radius = box.width / 2
      val center = Offset(size.width / 2, size.height / 2)
      scale(if (forward) 1f else -1f, 1f, pivot = center) {
        // clockwise arc with a gap at the top; the arrow head sits at the end of the arc
        drawArc(color, startAngle = -50f, sweepAngle = 280f, useCenter = false, topLeft = Offset(inset, inset), size = box, style = Stroke(stroke, cap = StrokeCap.Round))
        val end = Math.toRadians(230.0)
        val tip = Offset(center.x + radius * cos(end).toFloat(), center.y + radius * sin(end).toFloat())
        val direction = Offset((-sin(end)).toFloat(), cos(end).toFloat()) // clockwise tangent
        val side = Offset(-direction.y, direction.x)
        val head = 4.5.dp.toPx()
        val path = Path().apply {
          moveTo(tip.x + direction.x * head, tip.y + direction.y * head)
          lineTo(tip.x + side.x * head * 0.9f, tip.y + side.y * head * 0.9f)
          lineTo(tip.x - side.x * head * 0.9f, tip.y - side.y * head * 0.9f)
          close()
        }
        drawPath(path, color)
      }
    }
    BasicText("10", style = TextStyle(color = color, fontSize = 8.sp, fontWeight = FontWeight.Bold))
  }
}

@Composable
private fun AudioSpeakerIcon(muted: Boolean, color: Color) {
  Canvas(Modifier.size(22.dp)) {
    val w = size.width
    val h = size.height
    val body = Path().apply {
      moveTo(w * 0.1f, h * 0.4f)
      lineTo(w * 0.28f, h * 0.4f)
      lineTo(w * 0.5f, h * 0.2f)
      lineTo(w * 0.5f, h * 0.8f)
      lineTo(w * 0.28f, h * 0.6f)
      lineTo(w * 0.1f, h * 0.6f)
      close()
    }
    drawPath(body, color)
    val style = Stroke(1.8.dp.toPx(), cap = StrokeCap.Round)
    if (muted) {
      drawLine(color, Offset(w * 0.64f, h * 0.38f), Offset(w * 0.92f, h * 0.62f), 1.8.dp.toPx(), StrokeCap.Round)
      drawLine(color, Offset(w * 0.92f, h * 0.38f), Offset(w * 0.64f, h * 0.62f), 1.8.dp.toPx(), StrokeCap.Round)
    } else {
      drawArc(color, -45f, 90f, false, Offset(w * 0.34f, h * 0.3f), Size(w * 0.4f, h * 0.4f), style = style)
      drawArc(color, -45f, 90f, false, Offset(w * 0.2f, h * 0.16f), Size(w * 0.68f, h * 0.68f), style = style)
    }
  }
}
