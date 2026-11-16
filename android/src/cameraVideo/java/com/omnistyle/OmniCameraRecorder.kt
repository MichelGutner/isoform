package com.omnistyle

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import androidx.camera.core.UseCase
import androidx.camera.video.FallbackStrategy
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.core.content.ContextCompat

/**
 * Video recording (`camera.video` on): CameraX `VideoCapture` with a `Recorder`,
 * Full HD or the closest the camera offers, into an MP4 in the cache folder.
 */
internal class OmniCameraRecorder(private val context: Context) {
  private val recorder = Recorder.Builder()
    .setQualitySelector(QualitySelector.from(Quality.FHD, FallbackStrategy.lowerQualityOrHigherThan(Quality.FHD)))
    .build()
  private val videoCapture = VideoCapture.withOutput(recorder)
  private var recording: Recording? = null

  /** Request id of the `stopRecording` waiting for the file (`-1`: none, the recording ended by itself). */
  private var stopRequest = -1

  /** The use case to bind. */
  fun useCase(rotation: Int): UseCase = videoCapture.apply { targetRotation = rotation }

  fun setRotation(rotation: Int) {
    videoCapture.targetRotation = rotation
  }

  /**
   * Starts recording. [onStarted] gets an error message (empty = started); [onEnded]
   * gets `(stopRequestId, uri, seconds, error)` when the file is complete.
   */
  @SuppressLint("MissingPermission") // checked right below; without it the video is silent
  fun start(withAudio: Boolean, onStarted: (String) -> Unit, onEnded: (Int, String, Double, String) -> Unit) {
    if (recording != null) return onStarted("Camera is already recording")
    val file = outputFile(context, "video", "mp4")
    val micGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
    val pending = recorder.prepareRecording(context, FileOutputOptions.Builder(file).build())
      .let { if (withAudio && micGranted) it.withAudioEnabled() else it }
    stopRequest = -1
    recording = runCatching {
      pending.start(ContextCompat.getMainExecutor(context)) { event ->
        when (event) {
          is VideoRecordEvent.Start -> onStarted("")
          is VideoRecordEvent.Finalize -> {
            recording = null
            val seconds = event.recordingStats.recordedDurationNanos / 1_000_000_000.0
            // some errors (camera closed, storage almost full) still leave a playable file
            val usable = file.exists() && file.length() > 0
            val error = if (usable) "" else "Recording failed (error ${event.error})"
            onEnded(stopRequest, if (usable) "file://${file.absolutePath}" else "", seconds, error)
          }
          else -> Unit
        }
      }
    }.getOrElse { error ->
      onStarted(error.message ?: "Recording failed to start")
      null
    }
  }

  /** Stops; the file arrives through `onEnded` with [requestId]. */
  fun stop(requestId: Int, onNotRecording: () -> Unit) {
    val current = recording ?: return onNotRecording()
    stopRequest = requestId
    current.stop()
  }

  fun release() {
    recording?.close()
    recording = null
  }
}
