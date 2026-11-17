import MediaPlayer
import UIKit

/// Lock screen / Control Center / headset / CarPlay controls for an `Audio`
/// (only compiled with `modules.mediaSession`). It publishes what is playing
/// (`MPNowPlayingInfoCenter`) and answers the system buttons (`MPRemoteCommandCenter`).
///
/// For audio to keep playing with the app in the background, the app's Info.plist
/// needs `UIBackgroundModes` → `audio` (a library cannot add it).
///
/// There is one lock screen: the player that played last owns it (`activate`).
@objc(IsoNowPlaying)
public final class IsoNowPlaying: NSObject {
  /// What the system buttons do (set by the player).
  struct Commands {
    var play: () -> Void
    var pause: () -> Void
    var skip: (Double) -> Void
    var seek: (Double) -> Void
  }

  private static weak var owner: IsoNowPlaying?
  private static let skipSeconds = 10.0
  private static let artworkCache = NSCache<NSString, UIImage>()

  private let commands: Commands
  private var title = ""
  private var artist = ""
  private var artworkURL = ""
  private var artwork: MPMediaItemArtwork?
  private var targets: [(MPRemoteCommand, Any)] = []

  init(commands: Commands) {
    self.commands = commands
  }

  deinit { deactivate() }

  // MARK: - Metadata

  func setMetadata(title: String, artist: String, artwork url: String) {
    self.title = title
    self.artist = artist
    loadArtwork(url)
  }

  /// Takes the lock screen. Called when this player starts playing.
  func activate() {
    guard Self.owner !== self else { return }
    Self.owner?.removeTargets()
    Self.owner = self
    registerTargets()
  }

  /// Gives the lock screen back (only if it is still ours).
  func deactivate() {
    guard Self.owner === self else { return }
    removeTargets()
    Self.owner = nil
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
  }

  /// Publishes position, duration and speed (`rate` 0 = paused). Call on every change, not on every tick:
  /// the system extrapolates the elapsed time from the rate.
  func publish(current: Double, duration: Double, rate: Float) {
    guard Self.owner === self else { return }
    var info: [String: Any] = [
      MPMediaItemPropertyTitle: title.isEmpty ? "Audio" : title,
      MPNowPlayingInfoPropertyElapsedPlaybackTime: current,
      MPNowPlayingInfoPropertyPlaybackRate: Double(rate),
      MPNowPlayingInfoPropertyDefaultPlaybackRate: 1.0,
      MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue,
    ]
    if !artist.isEmpty { info[MPMediaItemPropertyArtist] = artist }
    if duration > 0 { info[MPMediaItemPropertyPlaybackDuration] = duration }
    if let artwork { info[MPMediaItemPropertyArtwork] = artwork }
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    MPNowPlayingInfoCenter.default().playbackState = rate > 0 ? .playing : .paused
  }

  // MARK: - System buttons

  private func registerTargets() {
    let center = MPRemoteCommandCenter.shared()
    center.skipForwardCommand.preferredIntervals = [NSNumber(value: Self.skipSeconds)]
    center.skipBackwardCommand.preferredIntervals = [NSNumber(value: Self.skipSeconds)]
    let enabled: [MPRemoteCommand] = [
      center.playCommand, center.pauseCommand, center.togglePlayPauseCommand,
      center.skipForwardCommand, center.skipBackwardCommand, center.changePlaybackPositionCommand,
    ]
    enabled.forEach { $0.isEnabled = true }
    // same buttons as the card (−10 s · play/pause · +10 s): no next/previous track
    [center.nextTrackCommand, center.previousTrackCommand, center.seekForwardCommand, center.seekBackwardCommand]
      .forEach { $0.isEnabled = false }

    add(center.playCommand) { [commands] _ in commands.play(); return .success }
    add(center.pauseCommand) { [commands] _ in commands.pause(); return .success }
    add(center.togglePlayPauseCommand) { [commands] _ in
      MPNowPlayingInfoCenter.default().nowPlayingInfo?[MPNowPlayingInfoPropertyPlaybackRate] as? Double ?? 0 > 0
        ? commands.pause() : commands.play()
      return .success
    }
    add(center.skipForwardCommand) { [commands] _ in commands.skip(Self.skipSeconds); return .success }
    add(center.skipBackwardCommand) { [commands] _ in commands.skip(-Self.skipSeconds); return .success }
    add(center.changePlaybackPositionCommand) { [commands] event in
      guard let event = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
      commands.seek(event.positionTime)
      return .success
    }
  }

  private func add(_ command: MPRemoteCommand, _ handler: @escaping (MPRemoteCommandEvent) -> MPRemoteCommandHandlerStatus) {
    targets.append((command, command.addTarget(handler: handler)))
  }

  private func removeTargets() {
    targets.forEach { command, target in command.removeTarget(target) }
    targets = []
  }

  // MARK: - Cover

  private func loadArtwork(_ url: String) {
    guard url != artworkURL else { return }
    artworkURL = url
    artwork = nil
    guard !url.isEmpty, let address = URL(string: url) else { return }
    if let cached = Self.artworkCache.object(forKey: url as NSString) {
      artwork = Self.makeArtwork(cached)
      return
    }
    URLSession.shared.dataTask(with: address) { [weak self] data, _, _ in
      guard let data, let image = UIImage(data: data) else { return }
      Self.artworkCache.setObject(image, forKey: url as NSString)
      DispatchQueue.main.async {
        guard let self, self.artworkURL == url else { return }
        self.artwork = Self.makeArtwork(image)
        // refresh the lock screen with the cover that just arrived
        if Self.owner === self, var info = MPNowPlayingInfoCenter.default().nowPlayingInfo {
          info[MPMediaItemPropertyArtwork] = self.artwork
          MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        }
      }
    }.resume()
  }

  private static func makeArtwork(_ image: UIImage) -> MPMediaItemArtwork {
    MPMediaItemArtwork(boundsSize: image.size) { _ in image }
  }
}
