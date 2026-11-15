package com.omnistyle

import android.content.Context
import androidx.media3.common.Player

/** `modules.mediaSession` off: no foreground service and no notification (it does nothing). */
internal object OmniMediaSession {
  fun attach(@Suppress("UNUSED_PARAMETER") context: Context, @Suppress("UNUSED_PARAMETER") player: Player) = Unit

  fun setMetadata(
    @Suppress("UNUSED_PARAMETER") player: Player,
    @Suppress("UNUSED_PARAMETER") title: String,
    @Suppress("UNUSED_PARAMETER") artist: String,
    @Suppress("UNUSED_PARAMETER") artwork: String,
  ) = Unit

  fun detach(@Suppress("UNUSED_PARAMETER") player: Player) = Unit
}
