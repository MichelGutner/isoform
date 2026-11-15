package com.omnistyle

import android.content.ComponentName
import android.content.Context
import android.net.Uri
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.MediaSession
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture

/**
 * Connects an `Audio` player to the system media controls (`modules.mediaSession` on).
 * Each player gets a `MediaSession`; a `MediaController` bound to `OmniMediaService`
 * makes Media3 start the foreground service and show the notification.
 * Must be called on the main thread.
 */
internal object OmniMediaSession {
  private val sessions = LinkedHashMap<Player, MediaSession>()
  private var lastPlayed: MediaSession? = null
  private var binder: ListenableFuture<MediaController>? = null

  fun current(): MediaSession? = lastPlayed ?: sessions.values.lastOrNull()

  fun attach(context: Context, player: Player) {
    if (sessions.containsKey(player)) return
    val session = MediaSession.Builder(context, player)
      .setId("omnistyle-${System.identityHashCode(player)}")
      .build()
    sessions[player] = session
    player.addListener(object : Player.Listener {
      override fun onIsPlayingChanged(isPlaying: Boolean) {
        if (isPlaying) lastPlayed = session
      }
    })
    bind(context)
  }

  /** Title, artist and cover shown in the notification and on the lock screen. */
  fun setMetadata(player: Player, title: String, artist: String, artwork: String) {
    player.playlistMetadata = MediaMetadata.Builder()
      .setTitle(title.ifEmpty { null })
      .setArtist(artist.ifEmpty { null })
      .setArtworkUri(if (artwork.isEmpty()) null else Uri.parse(artwork))
      .build()
  }

  fun detach(player: Player) {
    val session = sessions.remove(player) ?: return
    if (lastPlayed === session) lastPlayed = null
    session.release()
    if (sessions.isEmpty()) unbind()
  }

  private fun bind(context: Context) {
    if (binder != null) return
    val token = SessionToken(context, ComponentName(context, OmniMediaService::class.java))
    binder = MediaController.Builder(context, token).buildAsync()
  }

  private fun unbind() {
    binder?.let { MediaController.releaseFuture(it) }
    binder = null
  }
}
