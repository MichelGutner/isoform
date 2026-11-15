package com.omnistyle

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.OmniVideoViewManagerDelegate
import com.facebook.react.viewmanagers.OmniVideoViewManagerInterface

/**
 * Ponte entre o Fabric e o `OmniVideoView`: props, comandos e eventos.
 * `OmniVideoViewManagerInterface`/`Delegate` são gerados pelo Codegen a partir
 * de `src/adapters/react-native/media/video/native/OmniVideoViewNativeComponent.ts`.
 */
@ReactModule(name = OmniVideoViewManager.NAME)
class OmniVideoViewManager :
  SimpleViewManager<OmniVideoView>(),
  OmniVideoViewManagerInterface<OmniVideoView> {

  private val delegate = OmniVideoViewManagerDelegate(this)

  override fun getDelegate(): ViewManagerDelegate<OmniVideoView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): OmniVideoView = OmniVideoView(context)

  override fun onDropViewInstance(view: OmniVideoView) {
    view.release()
    super.onDropViewInstance(view)
  }

  // ── props ──

  @ReactProp(name = "src")
  override fun setSrc(view: OmniVideoView, value: String?) = view.setSource(value)

  @ReactProp(name = "controls", defaultBoolean = true)
  override fun setControls(view: OmniVideoView, value: Boolean) = view.setControls(value)

  @ReactProp(name = "autoPlay")
  override fun setAutoPlay(view: OmniVideoView, value: Boolean) = view.setAutoPlay(value)

  @ReactProp(name = "loop")
  override fun setLoop(view: OmniVideoView, value: Boolean) = view.setLoop(value)

  @ReactProp(name = "muted")
  override fun setMuted(view: OmniVideoView, value: Boolean) = view.setMuted(value)

  @ReactProp(name = "playlistIndex", defaultInt = -1)
  override fun setPlaylistIndex(view: OmniVideoView, value: Int) = view.setPlaylist(value, view.playlistCount)

  @ReactProp(name = "playlistItems")
  override fun setPlaylistItems(view: OmniVideoView, value: String?) = view.setPlaylistItems(value)

  @ReactProp(name = "playlistCount")
  override fun setPlaylistCount(view: OmniVideoView, value: Int) = view.setPlaylist(view.playlistIndex, value)

  @ReactProp(name = "rate", defaultFloat = 1f)
  override fun setRate(view: OmniVideoView, value: Float) = view.setRate(value)

  @ReactProp(name = "volume", defaultFloat = 1f)
  override fun setVolume(view: OmniVideoView, value: Float) = view.setVolume(value)

  // ── comandos ──

  override fun play(view: OmniVideoView) = view.play()

  override fun pause(view: OmniVideoView) = view.pause()

  override fun seekTo(view: OmniVideoView, seconds: Double) = view.seekTo(seconds)

  override fun setFullscreen(view: OmniVideoView, fullscreen: Boolean) = view.setFullscreen(fullscreen)

  // ── eventos (nome nativo → prop do JS) ──

  override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> =
    OmniVideoView.EVENTS.associateWith { mapOf("registrationName" to "on" + it.removePrefix("top")) }

  companion object {
    const val NAME = "OmniVideoView"
  }
}
