package com.isoform

import android.content.Context
import androidx.camera.core.UseCase

/**
 * Stand-in for the code scanner when `camera.codeScanner` is off: same API, no ML Kit
 * in the app. JS never turns it on (it warns first).
 */
@Suppress("UNUSED_PARAMETER")
internal class IsoCodeScanner(context: Context, onCodes: (List<Pair<String, String>>) -> Unit) {
  fun useCase(types: List<String>, rotation: Int): UseCase? = null

  fun setRotation(rotation: Int) = Unit

  fun release() = Unit
}
