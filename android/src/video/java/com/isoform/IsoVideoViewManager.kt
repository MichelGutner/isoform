package com.isoform

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.IsoVideoViewManagerDelegate
import com.facebook.react.viewmanagers.IsoVideoViewManagerInterface

/**
 * Ponte entre o Fabric e o `IsoVideoView`: props, comandos e eventos.
 * `IsoVideoViewManagerInterface`/`Delegate` são gerados pelo Codegen a partir
 * de `src/adapters/react-native/media/video/native/IsoVideoViewNativeComponent.ts`.
 */
@ReactModule(name = IsoVideoViewManager.NAME)
class IsoVideoViewManager :
  SimpleViewManager<IsoVideoView>(),
  IsoVideoViewManagerInterface<IsoVideoView> {

  private val delegate = IsoVideoViewManagerDelegate(this)

  override fun getDelegate(): ViewManagerDelegate<IsoVideoView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): IsoVideoView = IsoVideoView(context)

  override fun onDropViewInstance(view: IsoVideoView) {
    view.release()
    super.onDropViewInstance(view)
  }

  // ── props ──

  @ReactProp(name = "src")
  override fun setSrc(view: IsoVideoView, value: String?) = view.setSource(value)

  @ReactProp(name = "controls", defaultBoolean = true)
  override fun setControls(view: IsoVideoView, value: Boolean) = view.setControls(value)

  @ReactProp(name = "autoPlay")
  override fun setAutoPlay(view: IsoVideoView, value: Boolean) = view.setAutoPlay(value)

  @ReactProp(name = "loop")
  override fun setLoop(view: IsoVideoView, value: Boolean) = view.setLoop(value)

  @ReactProp(name = "muted")
  override fun setMuted(view: IsoVideoView, value: Boolean) = view.setMuted(value)

  @ReactProp(name = "playlistIndex", defaultInt = -1)
  override fun setPlaylistIndex(view: IsoVideoView, value: Int) = view.setPlaylist(value, view.playlistCount)

  @ReactProp(name = "playlistItems")
  override fun setPlaylistItems(view: IsoVideoView, value: String?) = view.setPlaylistItems(value)

  @ReactProp(name = "playlistCount")
  override fun setPlaylistCount(view: IsoVideoView, value: Int) = view.setPlaylist(view.playlistIndex, value)

  @ReactProp(name = "rate", defaultFloat = 1f)
  override fun setRate(view: IsoVideoView, value: Float) = view.setRate(value)

  @ReactProp(name = "volume", defaultFloat = 1f)
  override fun setVolume(view: IsoVideoView, value: Float) = view.setVolume(value)

  // ── comandos ──

  override fun play(view: IsoVideoView) = view.play()

  override fun pause(view: IsoVideoView) = view.pause()

  override fun seekTo(view: IsoVideoView, seconds: Double) = view.seekTo(seconds)

  override fun setFullscreen(view: IsoVideoView, fullscreen: Boolean) = view.setFullscreen(fullscreen)

  // ── eventos (nome nativo → prop do JS) ──

  override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> =
    IsoVideoView.EVENTS.associateWith { mapOf("registrationName" to "on" + it.removePrefix("top")) }

  companion object {
    const val NAME = "IsoVideoView"
  }
}
