package com.omnistyle

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.pm.ActivityInfo
import android.graphics.drawable.ColorDrawable
import android.os.Build
import android.view.ViewGroup
import android.view.WindowManager
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.AnimatedVisibilityScope
import androidx.compose.animation.Crossfade
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.displayCutout
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.ui.compose.ContentFrame
import androidx.media3.ui.compose.SURFACE_TYPE_TEXTURE_VIEW
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/**
 * Controles do vídeo em Jetpack Compose, desenhados para lembrar os do iOS
 * (AVPlayerViewController): play/pause e ±10 s no centro, barra fina com tempo
 * decorrido e restante embaixo, tela cheia, velocidade e mudo nos cantos, e tudo some sozinho enquanto toca.
 */

private const val SKIP_SECONDS = 10.0
private const val AUTO_HIDE_MS = 3000L

/** Fundo translúcido dos botões (o "vidro" dos controles do iOS). */
private val Glass = Color.Black.copy(alpha = 0.38f)
private val Scrim = Color.Black.copy(alpha = 0.22f)
private val Track = Color.White.copy(alpha = 0.3f)
private val MenuBackground = Color(0xFF2C2C2E) // opaco, como o menu escuro do iOS

/** Estado que a view nativa atualiza e os controles leem. */
class OmniVideoUiState {
  var isPlaying by mutableStateOf(false)
  var isBuffering by mutableStateOf(false)
  var ended by mutableStateOf(false)
  var muted by mutableStateOf(false)
  var controlsEnabled by mutableStateOf(true)
  var position by mutableDoubleStateOf(0.0)
  var duration by mutableDoubleStateOf(0.0)
  var rate by mutableFloatStateOf(1f)
  /** Fica na view (não no Compose): o JS também abre e fecha pelo `setFullscreen`. */
  var fullscreen by mutableStateOf(false)

  fun reset() {
    isPlaying = false
    isBuffering = false
    ended = false
    position = 0.0
    duration = 0.0
  }
}

/**
 * Entrada da interface do vídeo. Em tela cheia, o player sai da view do React
 * Native e vai para um `Dialog` do tamanho da tela (o mesmo `ExoPlayer`, sem
 * recarregar): só uma superfície mostra o vídeo de cada vez.
 */
@Composable
internal fun OmniVideoControls(
  player: Player,
  state: OmniVideoUiState,
  onTogglePlay: () -> Unit,
  onSkip: (Double) -> Unit,
  onSeek: (Double) -> Unit,
  onToggleMute: () -> Unit,
  onRateSelected: (Float) -> Unit,
  onFullscreenChange: (Boolean) -> Unit,
) {
  if (state.fullscreen) {
    // no lugar do vídeo, fica um fundo preto enquanto ele está em tela cheia
    Box(Modifier.fillMaxSize().background(Color.Black))

    Dialog(
      onDismissRequest = { onFullscreenChange(false) }, // botão "voltar" do Android
      properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
      FullscreenWindow(player)
      PlayerLayer(player, state, onTogglePlay, onSkip, onSeek, onToggleMute, onRateSelected, fullscreen = true) {
        onFullscreenChange(false)
      }
    }
  } else {
    PlayerLayer(player, state, onTogglePlay, onSkip, onSeek, onToggleMute, onRateSelected, fullscreen = false) {
      onFullscreenChange(true)
    }
  }
}

/** Vídeo + controles. É o mesmo componente na view e na tela cheia. */
@androidx.annotation.OptIn(markerClass = [UnstableApi::class])
@Composable
private fun PlayerLayer(
  player: Player,
  state: OmniVideoUiState,
  onTogglePlay: () -> Unit,
  onSkip: (Double) -> Unit,
  onSeek: (Double) -> Unit,
  onToggleMute: () -> Unit,
  onRateSelected: (Float) -> Unit,
  fullscreen: Boolean,
  onToggleFullscreen: () -> Unit,
) {
  var visible by remember { mutableStateOf(true) }
  var scrubbing by remember { mutableStateOf(false) }
  var speedMenuOpen by remember { mutableStateOf(false) }
  // muda a cada toque nos controles: reinicia a contagem para esconder
  var lastTouch by remember { mutableIntStateOf(0) }
  val touched = { lastTouch++ }
  // último toque duplo nas laterais (para o aviso animado de ±10 s)
  var seekFeedback by remember { mutableStateOf<SeekFeedback?>(null) }

  LaunchedEffect(visible, state.isPlaying, scrubbing, speedMenuOpen, lastTouch) {
    if (visible && state.isPlaying && !scrubbing && !speedMenuOpen) {
      delay(AUTO_HIDE_MS)
      visible = false
    }
  }

  // pausado ou no fim: os controles ficam à vista, como no iOS
  val shown = state.controlsEnabled && (visible || !state.isPlaying)

  Box(
    Modifier
      .fillMaxSize()
      .background(Color.Black)
      .pointerInput(state.controlsEnabled) {
        if (!state.controlsEnabled) return@pointerInput
        detectTapGestures(
          onTap = {
            visible = !visible
            touched()
          },
          // toque duplo na metade esquerda volta, na direita avança (como no YouTube)
          onDoubleTap = { offset ->
            val forward = offset.x > size.width / 2
            onSkip(skipSeconds(forward))
            seekFeedback = SeekFeedback(forward, id = (seekFeedback?.id ?: 0) + 1)
          },
        )
      },
  ) {
    // TextureView: respeita o recorte de bordas arredondadas (`borderRadius` no JS)
    ContentFrame(player = player, modifier = Modifier.fillMaxSize(), surfaceType = SURFACE_TYPE_TEXTURE_VIEW)

    if (!shown && state.isBuffering) {
      BufferingRing(Modifier.align(Alignment.Center).size(34.dp))
    }

    seekFeedback?.let { feedback ->
      SeekFeedbackBubble(feedback, Modifier.align(feedbackAlignment(feedback.forward)).padding(horizontal = 32.dp))
    }

    AnimatedVisibility(
      visible = shown,
      enter = fadeIn(tween(200)),
      exit = fadeOut(tween(300)),
      modifier = Modifier.fillMaxSize(),
    ) {
      Box(
        Modifier
          .fillMaxSize()
          .background(Scrim)
          // em tela cheia, os controles não ficam embaixo do recorte da câmera
          .then(if (fullscreen) Modifier.windowInsetsPadding(WindowInsets.displayCutout) else Modifier),
      ) {
        // mesmo lugar do iOS: tela cheia à esquerda, som à direita
        GlassButton(
          size = 36.dp,
          modifier = entrance(Entrance.Top).align(Alignment.TopStart).padding(12.dp),
          onClick = {
            onToggleFullscreen()
            touched()
          },
        ) { FullscreenIcon(exit = fullscreen, modifier = Modifier.size(16.dp)) }

        Row(
          modifier = entrance(Entrance.Top).align(Alignment.TopEnd).padding(12.dp),
          horizontalArrangement = Arrangement.spacedBy(8.dp),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Box {
            GlassPill(onClick = {
              speedMenuOpen = true
              touched()
            }) { RateLabel(state.rate) }

            if (speedMenuOpen) {
              SpeedMenu(
                current = state.rate,
                onSelect = { rate ->
                  onRateSelected(rate)
                  speedMenuOpen = false
                  touched()
                },
                onDismiss = { speedMenuOpen = false },
              )
            }
          }

          GlassButton(size = 36.dp, onClick = {
            onToggleMute()
            touched()
          }) {
            Crossfade(targetState = state.muted, label = "mute") { muted ->
              SpeakerIcon(muted = muted, modifier = Modifier.size(18.dp))
            }
          }
        }

        Row(
          modifier = entrance(Entrance.Center).align(Alignment.Center),
          horizontalArrangement = Arrangement.spacedBy(36.dp),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          SkipButton(forward = false) {
            onSkip(skipSeconds(forward = false))
            touched()
          }

          GlassButton(size = 68.dp, onClick = {
            onTogglePlay()
            touched()
          }) { PlayPauseIcon(centerIcon(state)) }

          SkipButton(forward = true) {
            onSkip(skipSeconds(forward = true))
            touched()
          }
        }

        Scrubber(
          position = state.position,
          duration = state.duration,
          onScrubbingChange = {
            scrubbing = it
            touched()
          },
          onSeek = onSeek,
          modifier = entrance(Entrance.Bottom)
            .align(Alignment.BottomCenter)
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 10.dp),
        )
      }
    }
  }
}

/* ───────────────────────── animações ───────────────────────── */

private val ENTRANCE_SPEC = tween<IntOffset>(250)

/** Como cada grupo de controles entra e sai (além do fade do conjunto). */
private enum class Entrance(val enter: EnterTransition, val exit: ExitTransition) {
  Top(slideInVertically(ENTRANCE_SPEC) { -it / 2 }, slideOutVertically(ENTRANCE_SPEC) { -it / 2 }),
  Bottom(slideInVertically(ENTRANCE_SPEC) { it / 2 }, slideOutVertically(ENTRANCE_SPEC) { it / 2 }),
  Center(scaleIn(tween(250), initialScale = 0.85f), scaleOut(tween(250), targetScale = 0.85f)),
}

private fun AnimatedVisibilityScope.entrance(entrance: Entrance): Modifier =
  Modifier.animateEnterExit(enter = entrance.enter, exit = entrance.exit)

/** Ícone do botão central. */
private enum class CenterIcon { Loading, Pause, Play }

private fun centerIcon(state: OmniVideoUiState): CenterIcon = when {
  state.isBuffering && !state.isPlaying -> CenterIcon.Loading
  state.isPlaying -> CenterIcon.Pause
  else -> CenterIcon.Play
}

/** Play ⇄ pause: o ícone novo "salta" no lugar do antigo. */
@Composable
private fun PlayPauseIcon(icon: CenterIcon) {
  AnimatedContent(
    targetState = icon,
    transitionSpec = {
      (fadeIn(tween(150)) + scaleIn(tween(220), initialScale = 0.4f)) togetherWith
        (fadeOut(tween(120)) + scaleOut(tween(120), targetScale = 0.4f))
    },
    contentAlignment = Alignment.Center,
    label = "play-pause",
  ) { target ->
    when (target) {
      CenterIcon.Loading -> BufferingRing(Modifier.size(30.dp))
      CenterIcon.Pause -> PauseIcon(Modifier.size(26.dp))
      CenterIcon.Play -> PlayIcon(Modifier.size(28.dp))
    }
  }
}

private fun skipSeconds(forward: Boolean) = if (forward) SKIP_SECONDS else -SKIP_SECONDS

/** Botão de ±10 s: a seta dá uma volta no sentido do pulo a cada toque. */
@Composable
private fun SkipButton(forward: Boolean, onClick: () -> Unit) {
  val turn = remember { Animatable(0f) }
  val scope = rememberCoroutineScope()
  val fullTurn = if (forward) 360f else -360f

  GlassButton(size = 48.dp, onClick = {
    onClick()
    scope.launch {
      turn.snapTo(0f)
      turn.animateTo(fullTurn, tween(500, easing = FastOutSlowInEasing))
    }
  }) { SkipIcon(forward = forward, arrowRotation = { turn.value }) }
}

/** Toque duplo nas laterais; o `id` muda a cada toque para reiniciar a animação. */
private class SeekFeedback(val forward: Boolean, val id: Int)

private fun feedbackAlignment(forward: Boolean) = if (forward) Alignment.CenterEnd else Alignment.CenterStart

private fun seekLabel(forward: Boolean) = (if (forward) "+" else "−") + "${SKIP_SECONDS.toInt()} s"

/** Círculo que cresce e some, com "+10 s" / "−10 s", do lado tocado. */
@Composable
private fun SeekFeedbackBubble(feedback: SeekFeedback, modifier: Modifier) {
  val progress = remember(feedback.id) { Animatable(0f) }
  LaunchedEffect(feedback.id) { progress.animateTo(1f, tween(700, easing = LinearOutSlowInEasing)) }

  Box(
    modifier
      .size(96.dp)
      .graphicsLayer {
        scaleX = 0.7f + 0.5f * progress.value
        scaleY = scaleX
        alpha = 1f - progress.value
      }
      .clip(CircleShape)
      .background(Color.White.copy(alpha = 0.18f)),
    contentAlignment = Alignment.Center,
  ) {
    BasicText(
      text = seekLabel(feedback.forward),
      style = TextStyle(color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold),
    )
  }
}

/** "1x" → "1.5x" deslizando para cima (a pílula acompanha a largura do texto). */
@Composable
private fun RateLabel(rate: Float) {
  AnimatedContent(
    targetState = rate,
    transitionSpec = {
      (slideInVertically { it } + fadeIn()) togetherWith (slideOutVertically { -it } + fadeOut())
    },
    contentAlignment = Alignment.Center,
    label = "rate",
  ) { PillLabel(rateLabel(it)) }
}

/* ───────────────────────── tela cheia ───────────────────────── */

/**
 * Ajusta a janela do `Dialog` enquanto a tela cheia está aberta e desfaz tudo
 * ao sair: ocupa a tela toda, esconde as barras do sistema (voltam com um
 * deslize) e gira para paisagem quando o vídeo é horizontal.
 */
@Composable
private fun FullscreenWindow(player: Player) {
  val view = LocalView.current
  val activity = LocalContext.current.findActivity()

  DisposableEffect(Unit) {
    (view.parent as? DialogWindowProvider)?.window?.let { window ->
      window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
      window.setBackgroundDrawable(ColorDrawable(android.graphics.Color.BLACK))
      window.setDimAmount(0f)
      // Sem isso, em paisagem o Android desloca a janela para fora do recorte da câmera:
      // sobra uma faixa preta de um lado e o outro lado (botões, barra) fica cortado.
      // O vídeo cobre a tela toda; os controles se afastam do recorte via `displayCutout`.
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        window.attributes = window.attributes.apply {
          layoutInDisplayCutoutMode =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
            else WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
      }
      WindowCompat.setDecorFitsSystemWindows(window, false)
      WindowCompat.getInsetsController(window, window.decorView).apply {
        hide(WindowInsetsCompat.Type.systemBars())
        systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
      }
    }

    val previousOrientation = activity?.requestedOrientation
    val video = player.videoSize
    if (video.width >= video.height) {
      activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
    }

    onDispose {
      if (activity != null && previousOrientation != null) activity.requestedOrientation = previousOrientation
    }
  }
}

private tailrec fun Context.findActivity(): Activity? = when (this) {
  is Activity -> this
  is ContextWrapper -> baseContext.findActivity()
  else -> null
}

/* ───────────────────────── botão "de vidro" ───────────────────────── */

@Composable
private fun GlassButton(
  size: Dp,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
  content: @Composable () -> Unit,
) {
  val interaction = remember { MutableInteractionSource() }
  val pressed by interaction.collectIsPressedAsState()
  val scale by animateFloatAsState(if (pressed) 0.9f else 1f, label = "press")

  Box(
    modifier = modifier
      .size(size)
      .graphicsLayer {
        scaleX = scale
        scaleY = scale
      }
      .clip(CircleShape)
      .background(Glass)
      .clickable(interactionSource = interaction, indication = null, onClick = onClick),
    contentAlignment = Alignment.Center,
  ) { content() }
}

/* ───────────────────────── velocidade ───────────────────────── */

/** As mesmas opções do menu de velocidade do iOS. */
private val SPEEDS = listOf(0.5f, 0.75f, 1f, 1.25f, 1.5f, 2f)

private fun rateLabel(rate: Float): String =
  if (rate % 1f == 0f) "${rate.toInt()}x" else "${rate}x"

/** Botão em pílula (mesmo "vidro" dos outros), para texto como "1x". */
@Composable
private fun GlassPill(onClick: () -> Unit, content: @Composable () -> Unit) {
  val interaction = remember { MutableInteractionSource() }
  val pressed by interaction.collectIsPressedAsState()
  val scale by animateFloatAsState(if (pressed) 0.92f else 1f, label = "press")

  Box(
    modifier = Modifier
      .height(36.dp)
      .graphicsLayer {
        scaleX = scale
        scaleY = scale
      }
      .clip(RoundedCornerShape(50))
      .background(Glass)
      .clickable(interactionSource = interaction, indication = null, onClick = onClick)
      .padding(horizontal = 12.dp),
    contentAlignment = Alignment.Center,
  ) { content() }
}

@Composable
private fun PillLabel(text: String) {
  BasicText(
    text = text,
    style = TextStyle(color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, fontFeatureSettings = "tnum"),
  )
}

/** Menu flutuante abaixo do botão, com ✓ na velocidade atual (como no iOS). */
@Composable
private fun SpeedMenu(current: Float, onSelect: (Float) -> Unit, onDismiss: () -> Unit) {
  // logo abaixo do botão (36 dp de altura + um respiro)
  val below = with(LocalDensity.current) { 44.dp.roundToPx() }
  // começa fechado e abre ao montar: o menu "cresce" a partir do canto do botão
  val appear = remember { MutableTransitionState(false).apply { targetState = true } }
  Popup(
    alignment = Alignment.TopEnd,
    offset = IntOffset(0, below),
    onDismissRequest = onDismiss,
    properties = PopupProperties(focusable = true),
  ) {
    AnimatedVisibility(
      visibleState = appear,
      enter = fadeIn(tween(150)) + scaleIn(tween(200), initialScale = 0.8f, transformOrigin = TransformOrigin(1f, 0f)),
    ) { SpeedMenuList(current, onSelect) }
  }
}

@Composable
private fun SpeedMenuList(current: Float, onSelect: (Float) -> Unit) {
  // Largura fixa: dentro do `Popup` o espaço disponível é a janela inteira, e as
  // linhas com `fillMaxWidth()` esticariam o menu de ponta a ponta.
  Column(
    Modifier
      .width(176.dp)
      .shadow(12.dp, RoundedCornerShape(14.dp))
      .clip(RoundedCornerShape(14.dp))
      .background(MenuBackground)
      .padding(vertical = 6.dp),
  ) {
    BasicText(
      text = "Velocidade",
      modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
      style = TextStyle(color = Color.White.copy(alpha = 0.6f), fontSize = 12.sp, fontWeight = FontWeight.Medium),
    )
    for (rate in SPEEDS) {
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .clickable { onSelect(rate) }
          .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        BasicText(
          text = if (rate == current) "✓" else "",
          modifier = Modifier.widthIn(min = 22.dp),
          style = TextStyle(color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold),
        )
        BasicText(
          text = rateLabel(rate),
          style = TextStyle(color = Color.White, fontSize = 15.sp, fontFeatureSettings = "tnum"),
        )
      }
    }
  }
}

/* ───────────────────────── barra de progresso ───────────────────────── */

/**
 * Barra fina como a do iOS: engrossa enquanto o dedo arrasta e só faz o seek
 * ao soltar (sem disparar dezenas de seeks no meio do gesto). Um toque pula direto.
 */
@Composable
private fun Scrubber(
  position: Double,
  duration: Double,
  onScrubbingChange: (Boolean) -> Unit,
  onSeek: (Double) -> Unit,
  modifier: Modifier = Modifier,
) {
  var widthPx by remember { mutableIntStateOf(1) }
  var dragFraction by remember { mutableStateOf<Float?>(null) }

  val fraction = dragFraction
    ?: if (duration > 0) (position / duration).toFloat().coerceIn(0f, 1f) else 0f
  val dragging = dragFraction != null
  val trackHeight by animateDpAsState(if (dragging) 10.dp else 5.dp, label = "track")
  // bolinha que "brota" sob o dedo enquanto arrasta
  val thumbSize by animateDpAsState(if (dragging) 18.dp else 0.dp, label = "thumb")
  val fractionAt = { x: Float -> (x / widthPx).coerceIn(0f, 1f) }

  Column(modifier) {
    Box(
      modifier = Modifier
        .fillMaxWidth()
        .height(28.dp)
        .onSizeChanged { widthPx = it.width.coerceAtLeast(1) }
        .pointerInput(duration) {
          detectHorizontalDragGestures(
            onDragStart = { offset ->
              dragFraction = fractionAt(offset.x)
              onScrubbingChange(true)
            },
            onHorizontalDrag = { change, _ ->
              change.consume()
              dragFraction = fractionAt(change.position.x)
            },
            onDragEnd = {
              dragFraction?.let { onSeek(it * duration) }
              dragFraction = null
              onScrubbingChange(false)
            },
            onDragCancel = {
              dragFraction = null
              onScrubbingChange(false)
            },
          )
        }
        .pointerInput(duration) {
          detectTapGestures { offset -> onSeek(fractionAt(offset.x) * duration) }
        },
      contentAlignment = Alignment.CenterStart,
    ) {
      Box(
        Modifier
          .fillMaxWidth()
          .height(trackHeight)
          .clip(RoundedCornerShape(50))
          .background(Track),
      ) {
        Box(Modifier.fillMaxHeight().fillMaxWidth(fraction).background(Color.White))
      }

      Box(
        Modifier
          .offset { IntOffset((fraction * widthPx - thumbSize.toPx() / 2).roundToInt(), 0) }
          .size(thumbSize)
          .shadow(3.dp, CircleShape)
          .background(Color.White, CircleShape),
      )
    }

    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
      val current = fraction * duration
      TimeLabel(clock(current))
      TimeLabel("-" + clock((duration - current).coerceAtLeast(0.0)))
    }
  }
}

@Composable
private fun TimeLabel(text: String) {
  BasicText(
    text = text,
    style = TextStyle(
      color = Color.White.copy(alpha = 0.85f),
      fontSize = 12.sp,
      fontWeight = FontWeight.Medium,
      fontFeatureSettings = "tnum", // dígitos de mesma largura: o texto não "dança"
    ),
  )
}

private fun clock(seconds: Double): String {
  val total = seconds.toLong().coerceAtLeast(0)
  val h = total / 3600
  val m = (total % 3600) / 60
  val s = total % 60
  return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}

/* ───────────────────────── ícones (desenhados, sem dependências) ───────────────────────── */

@Composable
private fun PlayIcon(modifier: Modifier) {
  Canvas(modifier) {
    val path = Path().apply {
      moveTo(size.width * 0.24f, size.height * 0.14f)
      lineTo(size.width * 0.86f, size.height * 0.5f)
      lineTo(size.width * 0.24f, size.height * 0.86f)
      close()
    }
    drawPath(path, Color.White)
    // contorno com junção arredondada: cantos suaves como o SF Symbol
    drawPath(path, Color.White, style = Stroke(width = size.width * 0.1f, join = StrokeJoin.Round))
  }
}

@Composable
private fun PauseIcon(modifier: Modifier) {
  Canvas(modifier) {
    val barWidth = size.width * 0.24f
    val radius = CornerRadius(barWidth * 0.3f)
    val top = size.height * 0.12f
    val barSize = Size(barWidth, size.height * 0.76f)
    drawRoundRect(Color.White, Offset(size.width * 0.18f, top), barSize, radius)
    drawRoundRect(Color.White, Offset(size.width * 0.58f, top), barSize, radius)
  }
}

/** Quatro cantos: para fora (entrar em tela cheia) ou para dentro (sair). */
@Composable
private fun FullscreenIcon(exit: Boolean, modifier: Modifier) {
  Canvas(modifier) {
    val w = size.width
    val h = size.height
    val arm = w * 0.32f
    val stroke = w * 0.12f
    // cada canto: o vértice e as direções dos dois braços
    val corners = listOf(
      Triple(Offset(0f, 0f), 1f, 1f),
      Triple(Offset(w, 0f), -1f, 1f),
      Triple(Offset(0f, h), 1f, -1f),
      Triple(Offset(w, h), -1f, -1f),
    )
    for ((corner, dx, dy) in corners) {
      // para sair, o vértice fica perto do centro e os braços apontam para fora
      val tip = if (exit) Offset(corner.x + dx * arm, corner.y + dy * arm) else corner
      val sx = if (exit) -dx else dx
      val sy = if (exit) -dy else dy
      drawLine(Color.White, tip, Offset(tip.x + sx * arm, tip.y), stroke, StrokeCap.Round)
      drawLine(Color.White, tip, Offset(tip.x, tip.y + sy * arm), stroke, StrokeCap.Round)
    }
  }
}

/**
 * Seta circular com "10" no meio; a de voltar é o espelho da de avançar.
 * `arrowRotation` gira só a seta (o número fica parado).
 */
@Composable
private fun SkipIcon(forward: Boolean, arrowRotation: () -> Float = { 0f }) {
  Box(Modifier.size(30.dp), contentAlignment = Alignment.Center) {
    Canvas(Modifier.fillMaxSize().graphicsLayer { rotationZ = arrowRotation() }) {
      if (forward) drawSkipArrow() else scale(scaleX = -1f, scaleY = 1f) { drawSkipArrow() }
    }
    BasicText(
      text = "10",
      style = TextStyle(color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Bold),
    )
  }
}

private fun DrawScope.drawSkipArrow() {
  val stroke = size.width * 0.09f
  val radius = size.width / 2 - stroke
  // arco no sentido horário terminando no topo, com uma abertura à direita do topo
  drawArc(
    color = Color.White,
    startAngle = -30f,
    sweepAngle = 300f,
    useCenter = false,
    topLeft = Offset(center.x - radius, center.y - radius),
    size = Size(radius * 2, radius * 2),
    style = Stroke(width = stroke, cap = StrokeCap.Round),
  )
  // ponta da seta no topo, apontando para a direita
  val tipY = center.y - radius
  val head = size.width * 0.16f
  val arrow = Path().apply {
    moveTo(center.x + head, tipY)
    lineTo(center.x - head * 0.2f, tipY - head * 0.8f)
    lineTo(center.x - head * 0.2f, tipY + head * 0.8f)
    close()
  }
  drawPath(arrow, Color.White)
}

@Composable
private fun SpeakerIcon(muted: Boolean, modifier: Modifier) {
  Canvas(modifier) {
    val w = size.width
    val h = size.height
    val body = Path().apply {
      moveTo(w * 0.08f, h * 0.36f)
      lineTo(w * 0.28f, h * 0.36f)
      lineTo(w * 0.52f, h * 0.14f)
      lineTo(w * 0.52f, h * 0.86f)
      lineTo(w * 0.28f, h * 0.64f)
      lineTo(w * 0.08f, h * 0.64f)
      close()
    }
    drawPath(body, Color.White)

    val line = Stroke(width = w * 0.09f, cap = StrokeCap.Round)
    if (muted) {
      drawLine(Color.White, Offset(w * 0.66f, h * 0.36f), Offset(w * 0.92f, h * 0.64f), line.width, StrokeCap.Round)
      drawLine(Color.White, Offset(w * 0.92f, h * 0.36f), Offset(w * 0.66f, h * 0.64f), line.width, StrokeCap.Round)
    } else {
      for (r in listOf(0.2f, 0.36f)) {
        drawArc(
          color = Color.White,
          startAngle = -45f,
          sweepAngle = 90f,
          useCenter = false,
          topLeft = Offset(w * 0.5f - w * r, h * 0.5f - w * r),
          size = Size(w * r * 2, w * r * 2),
          style = line,
        )
      }
    }
  }
}

@Composable
private fun BufferingRing(modifier: Modifier) {
  val transition = rememberInfiniteTransition(label = "buffering")
  val angle by transition.animateFloat(
    initialValue = 0f,
    targetValue = 360f,
    animationSpec = infiniteRepeatable(tween(900, easing = LinearEasing)),
    label = "angle",
  )
  Canvas(modifier) {
    val stroke = size.width * 0.1f
    rotate(angle) {
      drawArc(
        color = Color.White,
        startAngle = 0f,
        sweepAngle = 270f,
        useCenter = false,
        topLeft = Offset(stroke / 2, stroke / 2),
        size = Size(size.width - stroke, size.height - stroke),
        style = Stroke(width = stroke, cap = StrokeCap.Round),
      )
    }
  }
}
