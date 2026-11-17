package com.isoform

import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/**
 * Foreground service of the `Audio` module (only compiled with `modules.mediaSession`).
 * Media3 posts the media notification (play/pause, ±10 s, seek bar, cover, title)
 * and keeps the process alive as a foreground service while audio plays, so it
 * keeps going with the app in the background or the screen off.
 */
class IsoMediaService : MediaSessionService() {
  /** The notification controls follow the session that played last. */
  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? =
    IsoMediaSession.current()

  override fun onDestroy() {
    // the sessions belong to the views: the service only stops serving them
    super.onDestroy()
  }
}
