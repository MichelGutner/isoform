package com.omnistyle

import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.widget.FrameLayout
import androidx.compose.ui.platform.ComposeView
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

/**
 * View nativa do `Video` no Android.
 *  · reprodução: Media3 `ExoPlayer` (MP4, HLS…);
 *  · interface: Jetpack Compose (`OmniVideoControls.kt`), no estilo dos controles do iOS.
 * Aqui ficam só o player, as props, os comandos e os eventos para o JS.
 */
class OmniVideoView(private val reactContext: ThemedReactContext) : FrameLayout(reactContext) {

  private val player: ExoPlayer = ExoPlayer.Builder(reactContext).build()

  /** Estado lido pelos controles em Compose (atualizado pelo listener e pelo ticker). */
  private val ui = OmniVideoUiState()

  private var source: String? = null
  private var muted = false
  private var volume = 1f
  private var loaded = false

  // último valor avisado ao JS (evita eventos repetidos)
  private var lastVolume = Pair(1f, false)
  private var lastBuffered = 0.0

  private val composeView = ComposeView(reactContext).apply {
    layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    setContent {
      OmniVideoControls(
        player = player,
        state = ui,
        onTogglePlay = { if (player.isPlaying) player.pause() else play() },
        onSkip = { seconds -> seekTo(ui.position + seconds) },
        onSeek = { seconds -> seekTo(seconds) },
        onToggleMute = { setMuted(!muted) },
        onRateSelected = { rate -> setRate(rate) },
        onFullscreenChange = { value -> setFullscreen(value) },
      )
    }
  }

  /** Posição atual a cada 250 ms (alimenta a barra e o `onTimeUpdate` do JS). */
  private val handler = Handler(Looper.getMainLooper())
  private val ticker = object : Runnable {
    override fun run() {
      ui.position = player.currentPosition / 1000.0
      ui.duration = durationSeconds()

      // até onde já foi baixado: só avisa a cada meio segundo novo (como na web)
      val buffered = player.bufferedPosition / 1000.0
      if (kotlin.math.abs(buffered - lastBuffered) >= 0.5) {
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
    setBackgroundColor(Color.BLACK)
    addView(composeView)

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
          emit(LOAD, Arguments.createMap().apply {
            putDouble("duration", ui.duration)
            putDouble("width", player.videoSize.width.toDouble())
            putDouble("height", player.videoSize.height.toDouble())
          })
        }
        if (state == Player.STATE_ENDED) {
          ui.ended = true
          emit(END)
        }
      }

      /** Seek (barra, ±10 s ou `seekTo`): o Media3 informa a posição antes e depois. */
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
          putString("message", error.localizedMessage ?: "Falha ao carregar o vídeo.")
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
    player.prepare()
  }

  fun setControls(value: Boolean) {
    ui.controlsEnabled = value
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

  // ── comandos ──

  fun play() {
    // terminou: o play recomeça do início, como no iOS
    if (player.playbackState == Player.STATE_ENDED) player.seekTo(0)
    ui.ended = false
    player.play()
  }

  fun pause() = player.pause()

  /** Abre ou fecha a tela cheia (botão dos controles ou comando do JS). */
  fun setFullscreen(value: Boolean) {
    if (value == ui.fullscreen) return
    ui.fullscreen = value
    emit(FULLSCREEN, Arguments.createMap().apply { putBoolean("fullscreen", value) })
  }

  fun seekTo(seconds: Double) {
    val target = seconds.coerceIn(0.0, if (ui.duration > 0) ui.duration else Double.MAX_VALUE)
    ui.position = target
    ui.ended = false
    player.seekTo((target * 1000).toLong())
  }

  /** Libera o decodificador quando a view sai da tela. */
  fun release() {
    handler.removeCallbacks(ticker)
    composeView.disposeComposition()
    player.release()
  }

  // ── layout ──

  /**
   * O React Native controla o layout das suas views e não repassa
   * `requestLayout` dos filhos nativos. Sem isto, a `ComposeView` (e a
   * superfície do vídeo dentro dela) não seria medida quando muda de tamanho.
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
   * A Fabric pode medir a view ANTES de ela entrar na janela (ex.: ao montar ou
   * reciclar). A `ComposeView` quebra se for medida sem janela ("Cannot locate
   * windowRecomposer"), então até lá a view só guarda o tamanho pedido.
   */
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    if (!isAttachedToWindow) {
      return setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
    }
    super.onMeasure(widthMeasureSpec, heightMeasureSpec)
  }

  /** Entrou na janela: agora a `ComposeView` pode ser medida e desenhada. */
  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    requestLayout()
  }

  // ── eventos → JS ──

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
    const val FULLSCREEN = "topPlayerFullscreen"
    const val VOLUME = "topPlayerVolume"
    const val RATE = "topPlayerRate"
    val EVENTS = listOf(PLAY, PAUSE, END, TIME, LOAD, ERROR, SEEK, BUFFERING, BUFFERED, FULLSCREEN, VOLUME, RATE)
  }
}
