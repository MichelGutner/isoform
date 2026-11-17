package com.isoform

import android.content.Context
import androidx.camera.core.UseCase

/**
 * Stand-in for the recorder when `camera.video` is off: same API, no `camera-video`
 * dependency in the app. JS never asks it to record (it warns first).
 */
@Suppress("UNUSED_PARAMETER")
internal class IsoCameraRecorder(context: Context) {
  fun useCase(rotation: Int): UseCase? = null

  fun setRotation(rotation: Int) = Unit

  fun start(withAudio: Boolean, onStarted: (String) -> Unit, onEnded: (Int, String, Double, String) -> Unit) =
    onStarted("Video recording is off: set camera.video in isoform.config.json")

  fun stop(requestId: Int, onNotRecording: () -> Unit) = onNotRecording()

  fun release() = Unit
}
