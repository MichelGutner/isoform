import UIKit

/// `modules.mediaSession` off: no lock screen controls (it does nothing).
@objc(OmniNowPlaying)
public final class OmniNowPlaying: NSObject {
  struct Commands {
    var play: () -> Void
    var pause: () -> Void
    var skip: (Double) -> Void
    var seek: (Double) -> Void
  }

  init(commands: Commands) {}
  func setMetadata(title: String, artist: String, artwork url: String) {}
  func activate() {}
  func deactivate() {}
  func publish(current: Double, duration: Double, rate: Float) {}
}
