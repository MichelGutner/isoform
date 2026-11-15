package com.omnistyle

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import java.util.Locale

/**
 * Read aloud on Android, with the system `TextToSpeech`. Pages are read in order
 * from a starting page; each page's text comes from the renderer (Android 12+ with
 * updates, or 15+). The voice is the most natural one installed for the language.
 */
internal class OmniPdfReader(private val context: Context, private val scope: CoroutineScope) {
  /** BCP 47 language of the voice (`null` = the device language). */
  var language: String? = null
  /** Voice chosen by the app or the user (`Voice.name`; `null` = the most natural one). */
  var voiceName: String? = null
  /** Called when a new page starts being read (index from `0`). */
  var onPage: (Int) -> Unit = {}
  /** Called with `true` when reading starts and `false` when it stops or ends. */
  var onChange: (Boolean) -> Unit = {}

  private val main = Handler(Looper.getMainLooper())
  private var tts: TextToSpeech? = null
  private var ready = false
  private val pending = ArrayList<() -> Unit>()
  private var document: OmniPdfDocument? = null
  private var page = 0
  private var job: Job? = null

  val isReading: Boolean get() = document != null

  fun start(document: OmniPdfDocument, from: Int) {
    stop()
    this.document = document
    page = from
    onChange(true)
    whenReady { speakPage() }
  }

  fun stop() {
    if (document == null) return
    document = null
    job?.cancel()
    tts?.stop()
    onChange(false)
  }

  fun release() {
    stop()
    tts?.shutdown()
    tts = null
    ready = false
  }

  /** The voices of the language, most natural first (empty until the engine is up). */
  fun voices(done: (List<PdfVoice>) -> Unit) = whenReady {
    val engine = tts ?: return@whenReady done(emptyList())
    done(languageVoices(engine, language).map { PdfVoice(it.name, voiceLabel(it)) })
  }

  /** Runs `action` once the engine is up (it starts on the first use). */
  private fun whenReady(action: () -> Unit) {
    if (ready) return action()
    pending += action
    if (tts != null) return
    tts = TextToSpeech(context) { status ->
      main.post {
        ready = status == TextToSpeech.SUCCESS
        val queued = pending.toList()
        pending.clear()
        if (!ready) return@post stop()
        tts?.setOnUtteranceProgressListener(progress)
        queued.forEach { it() }
      }
    }
  }

  /** Speaks the next page with text (pages without text, like scans, are skipped). */
  private fun speakPage() {
    val doc = document ?: return
    job = scope.launch {
      while (page < doc.pageCount && document === doc) {
        val text = doc.text(page).trim()
        if (text.isEmpty()) {
          page++
          continue
        }
        if (document !== doc) return@launch
        onPage(page)
        speak(text, page)
        return@launch
      }
      stop()
    }
  }

  private fun speak(text: String, index: Int) {
    val engine = tts ?: return
    val chosen = voiceName?.let { name -> runCatching { engine.voices }.getOrNull()?.firstOrNull { it.name == name } }
    (chosen ?: bestVoice(engine, language))?.let { engine.voice = it }
    val limit = TextToSpeech.getMaxSpeechInputLength() - 1
    val chunks = text.chunked(limit)
    chunks.forEachIndexed { i, chunk ->
      val id = if (i == chunks.lastIndex) "page-$index-end" else "page-$index-$i"
      engine.speak(chunk, TextToSpeech.QUEUE_ADD, null, id)
    }
  }

  private val progress =
    object : UtteranceProgressListener() {
      override fun onStart(utteranceId: String?) = Unit

      override fun onDone(utteranceId: String?) {
        if (utteranceId?.endsWith("-end") != true) return
        main.post {
          if (document == null) return@post
          page++
          speakPage()
        }
      }

      @Deprecated("Deprecated in Java")
      override fun onError(utteranceId: String?) {
        main.post { stop() }
      }
    }

  companion object {
    /**
     * The most natural installed voice for `language`: highest quality first (the
     * neural ones), offline before online at the same quality, never a voice that is
     * not downloaded yet. `null` keeps the engine's default.
     */
    fun bestVoice(engine: TextToSpeech, language: String?): Voice? = languageVoices(engine, language).firstOrNull()

    /** Installed voices of `language` (exact locale first, else same language), most natural first. */
    fun languageVoices(engine: TextToSpeech, language: String?): List<Voice> {
      val wanted = language?.let(Locale::forLanguageTag) ?: Locale.getDefault()
      val voices = runCatching { engine.voices.orEmpty() }.getOrDefault(emptySet())
        .filter { TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED !in it.features }
      val exact = voices.filter { it.locale == wanted }
      val pool = exact.ifEmpty { voices.filter { it.locale.language == wanted.language } }
      return pool.sortedByDescending { it.quality * 2 + (if (it.isNetworkConnectionRequired) 0 else 1) }
    }

    private val QUALITY = mapOf(
      Voice.QUALITY_VERY_HIGH to "Very high quality",
      Voice.QUALITY_HIGH to "High quality",
      Voice.QUALITY_NORMAL to "Normal quality",
      Voice.QUALITY_LOW to "Low quality",
      Voice.QUALITY_VERY_LOW to "Very low quality",
    )

    /** "Voice AFS · Very high quality · Online": the engine's short code, quality and whether it needs internet. */
    fun voiceLabel(voice: Voice): String {
      val code = Regex("-x-([a-z0-9]+)").find(voice.name)?.groupValues?.get(1)?.uppercase() ?: voice.name
      val online = if (voice.isNetworkConnectionRequired) " · Online" else ""
      return "Voice $code · ${QUALITY[voice.quality] ?: "Quality ${voice.quality}"}$online"
    }
  }
}

/** A voice the user can pick: its engine name and a readable label. */
internal data class PdfVoice(
  /** `Voice.name`, given back to `OmniPdfReader.voiceName`. */
  val name: String,
  /** What the menu shows. */
  val label: String,
)
