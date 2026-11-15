package com.omnistyle

import android.content.ComponentName
import android.content.Context
import android.net.Uri
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.CommandButton
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
      .setMediaButtonPreferences(buttons())
      .build()
    sessions[player] = session
    player.addListener(object : Player.Listener {
      override fun onIsPlayingChanged(isPlaying: Boolean) {
        if (isPlaying) lastPlayed = session
      }
    })
    bind(context)
  }

  /** Same buttons as the card: −10 s · play/pause (the system draws it) · +10 s. */
  private fun buttons(): List<CommandButton> = listOf(
    CommandButton.Builder(CommandButton.ICON_SKIP_BACK_10)
      .setPlayerCommand(Player.COMMAND_SEEK_BACK)
      .setDisplayName("Back 10 seconds")
      .setSlots(CommandButton.SLOT_BACK)
      .build(),
    CommandButton.Builder(CommandButton.ICON_SKIP_FORWARD_10)
      .setPlayerCommand(Player.COMMAND_SEEK_FORWARD)
      .setDisplayName("Forward 10 seconds")
      .setSlots(CommandButton.SLOT_FORWARD)
      .build(),
  )

  /**
   * Title, artist and cover shown in the notification and on the lock screen. They go
   * on the current `MediaItem` (what the system controls read); Android 13+ also uses
   * the cover as the background of those controls. Replacing only the metadata of the
   * item that is playing does not interrupt playback.
   */
  fun setMetadata(player: Player, title: String, artist: String, artwork: String) {
    val metadata = MediaMetadata.Builder()
      .setTitle(title.ifEmpty { null })
      .setArtist(artist.ifEmpty { null })
      .setArtworkUri(if (artwork.isEmpty()) null else Uri.parse(artwork))
      .build()
    player.playlistMetadata = metadata
    if (player.mediaItemCount == 0) return
    val item = player.getMediaItemAt(0)
    if (item.mediaMetadata == metadata) return
    player.replaceMediaItem(0, item.buildUpon().setMediaMetadata(metadata).build())
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
