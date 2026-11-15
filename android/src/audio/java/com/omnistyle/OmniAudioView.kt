package com.omnistyle

import android.os.Handler
import android.os.Looper
import android.widget.FrameLayout
import androidx.compose.ui.platform.ComposeView
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import kotlin.math.abs

/**
 * Native view of `Audio` on Android.
 *  · playback: Media3 `ExoPlayer` (MP3, AAC, HLS…) with audio focus handling;
 *  · interface: Jetpack Compose (`OmniAudioControls.kt`), a Material-style card.
 * This class only holds the player, props, commands and events to JS.
 */
class OmniAudioView(private val reactContext: ThemedReactContext) : FrameLayout(reactContext) {

  private val player: ExoPlayer = ExoPlayer.Builder(reactContext)
    // pauses for calls / other media and resumes after; pauses when headphones are unplugged
    .setAudioAttributes(
      AudioAttributes.Builder()
        .setUsage(C.USAGE_MEDIA)
        .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
        .build(),
      true,
    )
    .setHandleAudioBecomingNoisy(true)
    // ±10 s, like the card and the system controls (the default is 5 s back, 15 s forward)
    .setSeekBackIncrementMs(10_000)
    .setSeekForwardIncrementMs(10_000)
    .build()

  /** State read by the Compose controls (updated by the listener and the ticker). */
  private val ui = OmniAudioUiState()

  private var source: String? = null
  private var muted = false
  private var volume = 1f
  private var loaded = false

  // last value reported to JS (avoids repeated events)
  private var lastVolume = Pair(1f, false)
  private var lastBuffered = 0.0

  private val composeView = ComposeView(reactContext).apply {
    layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    setContent {
      OmniAudioControls(
        state = ui,
        onTogglePlay = { if (player.isPlaying) player.pause() else play() },
        onSkip = { seconds -> seekTo(ui.position + seconds) },
        onSeek = { seconds -> seekTo(seconds) },
        onToggleMute = { setMuted(!muted) },
        onRateSelected = { rate -> setRate(rate) },
        onPlaylist = { emit(PLAYLIST) },
      )
    }
  }

  /** Position every 250 ms (feeds the bar and the JS `onTimeUpdate`). */
  private val handler = Handler(Looper.getMainLooper())
  private val ticker = object : Runnable {
    override fun run() {
      ui.position = player.currentPosition / 1000.0
      ui.duration = durationSeconds()

      // how far it has been downloaded: only reports every new half second (like the web)
      val buffered = player.bufferedPosition / 1000.0
      ui.buffered = buffered
      if (abs(buffered - lastBuffered) >= 0.5) {
        lastBuffered = buffered
        emit(BUFFERED, Arguments.createMap().apply { putDouble("buffered", buffered) })
      }

      if (player.isPlaying) {
        emit(TIME, Arguments.createMap().apply {
          putDouble("currentTime", ui.position)
          putDouble("duration", ui.duration)
        })
      }
      handler.postDelayed(this, 250)
    }
  }

  init {
    addView(composeView)
    // system media controls (no-op unless `modules.mediaSession` is on)
    OmniMediaSession.attach(reactContext, player)

    player.addListener(object : Player.Listener {
      override fun onIsPlayingChanged(isPlaying: Boolean) {
        ui.isPlaying = isPlaying
        emit(if (isPlaying) PLAY else PAUSE)
      }

      override fun onPlaybackStateChanged(state: Int) {
        val buffering = state == Player.STATE_BUFFERING
        if (buffering != ui.isBuffering) {
          ui.isBuffering = buffering
          emit(BUFFERING, Arguments.createMap().apply { putBoolean("buffering", buffering) })
        }
        if (state == Player.STATE_READY && !loaded) {
          loaded = true
          ui.duration = durationSeconds()
          emit(LOAD, Arguments.createMap().apply { putDouble("duration", ui.duration) })
        }
        if (state == Player.STATE_ENDED) emit(END)
      }

      /** Seek (bar, ±10 s or `seekTo`): Media3 reports the position before and after. */
      override fun onPositionDiscontinuity(
        oldPosition: Player.PositionInfo,
        newPosition: Player.PositionInfo,
        reason: Int,
      ) {
        if (reason != Player.DISCONTINUITY_REASON_SEEK) return
        emit(SEEK, Arguments.createMap().apply {
          putDouble("from", oldPosition.positionMs / 1000.0)
          putDouble("to", newPosition.positionMs / 1000.0)
        })
      }

      override fun onPlaybackParametersChanged(playbackParameters: PlaybackParameters) {
        ui.rate = playbackParameters.speed
        emit(RATE, Arguments.createMap().apply { putDouble("rate", playbackParameters.speed.toDouble()) })
      }

      override fun onPlayerError(error: PlaybackException) {
        emit(ERROR, Arguments.createMap().apply {
          putString("message", error.localizedMessage ?: "Failed to load the audio.")
        })
      }
    })

    handler.post(ticker)
  }

  // ── props ──

  fun setSource(value: String?) {
    if (value == source) return
    source = value
    loaded = false
    ui.reset()
    lastBuffered = 0.0
    if (value.isNullOrEmpty()) {
      player.clearMediaItems()
      return
    }
    player.setMediaItem(MediaItem.fromUri(value))
    OmniMediaSession.setMetadata(player, ui.title, ui.artist, ui.artwork)
    player.prepare()
  }

  fun setControls(value: Boolean) {
    ui.controlsEnabled = value
  }

  fun setTitle(value: String?) {
    ui.title = value.orEmpty()
    OmniMediaSession.setMetadata(player, ui.title, ui.artist, ui.artwork)
  }

  fun setArtist(value: String?) {
    ui.artist = value.orEmpty()
    OmniMediaSession.setMetadata(player, ui.title, ui.artist, ui.artwork)
  }

  val playlistIndex: Int get() = ui.playlistIndex
  val playlistCount: Int get() = ui.playlistCount

  /** List (`items`): shows the playlist chip with the position (`count` 0 hides it). */
  fun setPlaylist(index: Int, count: Int) {
    ui.playlistIndex = index
    ui.playlistCount = count
  }

  fun setArtwork(value: String?) {
    ui.artwork = value.orEmpty()
    OmniMediaSession.setMetadata(player, ui.title, ui.artist, ui.artwork)
  }

  fun setAutoPlay(value: Boolean) {
    player.playWhenReady = value
  }

  fun setLoop(value: Boolean) {
    player.repeatMode = if (value) Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_OFF
  }

  fun setMuted(value: Boolean) {
    muted = value
    ui.muted = value
    applyVolume()
  }

  fun setVolume(value: Float) {
    volume = value.coerceIn(0f, 1f)
    applyVolume()
  }

  fun setRate(value: Float) {
    val rate = if (value > 0f) value else 1f
    if (rate != player.playbackParameters.speed) player.setPlaybackSpeed(rate)
  }

  private fun applyVolume() {
    player.volume = if (muted) 0f else volume
    val current = Pair(volume, muted)
    if (current != lastVolume) {
      lastVolume = current
      emit(VOLUME, Arguments.createMap().apply {
        putDouble("volume", volume.toDouble())
        putBoolean("muted", muted)
      })
    }
  }

  // ── commands ──

  fun play() {
    // it ended: play restarts from the beginning, like on iOS
    if (player.playbackState == Player.STATE_ENDED) player.seekTo(0)
    player.play()
  }

  fun pause() = player.pause()

  fun seekTo(seconds: Double) {
    val target = seconds.coerceIn(0.0, if (ui.duration > 0) ui.duration else Double.MAX_VALUE)
    ui.position = target
    player.seekTo((target * 1000).toLong())
  }

  /** Releases the decoder when the view leaves the screen. */
  fun release() {
    handler.removeCallbacks(ticker)
    composeView.disposeComposition()
    OmniMediaSession.detach(player)
    player.release()
  }

  // ── layout ──

  /**
   * React Native controls the layout of its views and does not forward
   * `requestLayout` from native children. Without this, the `ComposeView`
   * would not be measured when the size changes.
   */
  private val measureAndLayout = Runnable {
    measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
    )
    layout(left, top, right, bottom)
  }

  override fun requestLayout() {
    super.requestLayout()
    post(measureAndLayout)
  }

  /**
   * Fabric may measure the view BEFORE it enters the window (e.g. on mount or
   * recycle). `ComposeView` crashes if measured without a window ("Cannot locate
   * windowRecomposer"), so until then the view only keeps the requested size.
   */
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    if (!isAttachedToWindow) {
      return setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
    }
    super.onMeasure(widthMeasureSpec, heightMeasureSpec)
  }

  /** Entered the window: now the `ComposeView` can be measured and drawn. */
  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    requestLayout()
  }

  // ── events → JS ──

  private fun durationSeconds(): Double =
    if (player.duration == C.TIME_UNSET) 0.0 else player.duration / 1000.0

  private fun emit(name: String, payload: WritableMap = Arguments.createMap()) {
    val surfaceId = UIManagerHelper.getSurfaceId(reactContext)
    UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)
      ?.dispatchEvent(PlayerEvent(surfaceId, id, name, payload))
  }

  private class PlayerEvent(
    surfaceId: Int,
    viewId: Int,
    private val name: String,
    private val payload: WritableMap,
  ) : Event<PlayerEvent>(surfaceId, viewId) {
    override fun getEventName(): String = name
    override fun getEventData(): WritableMap = payload
  }

  companion object {
    const val PLAY = "topPlayerPlay"
    const val PAUSE = "topPlayerPause"
    const val END = "topPlayerEnd"
    const val TIME = "topPlayerTime"
    const val LOAD = "topPlayerLoad"
    const val ERROR = "topPlayerError"
    const val SEEK = "topPlayerSeek"
    const val BUFFERING = "topPlayerBuffering"
    const val BUFFERED = "topPlayerBuffered"
    const val VOLUME = "topPlayerVolume"
    const val RATE = "topPlayerRate"
    const val PLAYLIST = "topPlayerPlaylist"
    val EVENTS = listOf(PLAY, PAUSE, END, TIME, LOAD, ERROR, SEEK, BUFFERING, BUFFERED, VOLUME, RATE, PLAYLIST)
  }
}
