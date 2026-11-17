import AVFoundation
import UIKit

/// Events of the player, forwarded by the Fabric shell (`IsoAudioView.mm`) to JS.
@objc public protocol IsoAudioPlayerDelegate: AnyObject {
  func audioDidPlay()
  func audioDidPause()
  func audioDidEnd()
  func audioDidUpdateTime(_ currentTime: Double, duration: Double)
  func audioDidLoad(_ duration: Double)
  func audioDidFail(_ message: String)
  func audioDidSeek(from: Double, to: Double)
  func audioDidChangeBuffering(_ buffering: Bool)
  func audioDidChangeBuffered(_ buffered: Double)
  func audioDidChangeVolume(_ volume: Double, muted: Bool)
  func audioDidChangeRate(_ rate: Double)
  func audioDidPressPlaylist()
}

/// Audio player with Apple APIs: `AVPlayer` for playback and a UIKit card for the
/// controls (cover, title, artist, seek slider, ±10 s, play/pause, speed `UIMenu`
/// and mute). Colors are system colors, so it follows light/dark mode on its own.
/// On iOS 26 the buttons use the system Liquid Glass configurations.
@objc(IsoAudioPlayer)
public final class IsoAudioPlayer: UIView {
  @objc public weak var delegate: IsoAudioPlayerDelegate?

  private let player = AVPlayer()
  private let ui = IsoAudioCard()
  /// Lock screen controls (a no-op unless `modules.mediaSession` is on).
  private lazy var nowPlaying = IsoNowPlaying(commands: .init(
    play: { [weak self] in self?.play() },
    pause: { [weak self] in self?.pause() },
    skip: { [weak self] seconds in self?.skip(by: seconds) },
    seek: { [weak self] seconds in self?.seek(to: seconds) }
  ))
  private var title = ""
  private var artist = ""
  private var artwork = ""

  private var source: String?
  private var shouldAutoPlay = false
  private var shouldLoop = false
  private var playbackRate: Float = 1

  // last state reported to JS (avoids repeated events)
  private var isPlaying = false
  private var isBuffering = false
  private var lastTime: Double = 0
  private var lastBuffered: Double = 0
  private var lastRate: Float = 1
  private var lastVolume: (Float, Bool)?

  private var timeObserver: Any?
  private var observations: [NSKeyValueObservation] = []
  private var itemObservations: [NSKeyValueObservation] = []
  private var itemNotifications: [NSObjectProtocol] = []

  @objc public override init(frame: CGRect) {
    super.init(frame: frame)

    ui.frame = bounds
    ui.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    addSubview(ui)
    ui.actions = IsoAudioCard.Actions(
      togglePlay: { [weak self] in self?.togglePlay() },
      skip: { [weak self] seconds in self?.skip(by: seconds) },
      seek: { [weak self] seconds in self?.seek(to: seconds) },
      toggleMute: { [weak self] in self?.toggleMute() },
      selectRate: { [weak self] rate in self?.setRate(rate) },
      openPlaylist: { [weak self] in self?.delegate?.audioDidPressPlaylist() }
    )

    // Position every 250 ms (like the web `timeupdate`). It also keeps the
    // last position, which becomes the `from` of the next seek.
    timeObserver = player.addPeriodicTimeObserver(
      forInterval: CMTime(seconds: 0.25, preferredTimescale: 600),
      queue: .main
    ) { [weak self] time in
      guard let self else { return }
      self.lastTime = time.seconds
      self.ui.update(current: time.seconds, duration: self.duration)
      if self.isPlaying { self.delegate?.audioDidUpdateTime(time.seconds, duration: self.duration) }
    }

    observations = [
      player.observe(\.timeControlStatus, options: [.new]) { [weak self] player, _ in
        DispatchQueue.main.async { self?.timeControlChanged(player.timeControlStatus) }
      },
      player.observe(\.isMuted, options: [.new]) { [weak self] _, _ in
        DispatchQueue.main.async { self?.volumeChanged() }
      },
      player.observe(\.volume, options: [.new]) { [weak self] _, _ in
        DispatchQueue.main.async { self?.volumeChanged() }
      },
    ]
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  deinit {
    nowPlaying.deactivate()
    if let timeObserver { player.removeTimeObserver(timeObserver) }
    clearItemObservers()
    player.pause()
  }

  // MARK: - Props

  @objc public func setSource(_ value: String) {
    guard value != source else { return }
    source = value
    clearItemObservers()
    lastTime = 0
    lastBuffered = 0
    ui.update(current: 0, duration: 0, buffered: 0)

    guard !value.isEmpty, let url = URL(string: value) else {
      player.replaceCurrentItem(with: nil)
      return
    }

    let item = AVPlayerItem(url: url)
    itemObservations = [
      item.observe(\.status, options: [.new]) { [weak self] item, _ in
        DispatchQueue.main.async { self?.statusChanged(item) }
      },
      item.observe(\.loadedTimeRanges, options: [.new]) { [weak self] item, _ in
        DispatchQueue.main.async { self?.bufferedChanged(item) }
      },
    ]
    itemNotifications = [
      NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main) {
        [weak self] _ in self?.didPlayToEnd()
      },
      // seek (slider, ±10 s or `seekTo`): the position "jumped"
      NotificationCenter.default.addObserver(forName: AVPlayerItem.timeJumpedNotification, object: item, queue: .main) {
        [weak self] _ in self?.timeJumped()
      },
    ]
    player.replaceCurrentItem(with: item)
  }

  @objc public func setControls(_ value: Bool) { ui.isHidden = !value }
  @objc public func setTitle(_ value: String) { title = value; ui.setTitle(value); publishMetadata() }
  @objc public func setArtist(_ value: String) { artist = value; ui.setArtist(value); publishMetadata() }
  /// List position for the playlist button in the card (`count` 0 hides it).
  @objc public func setPlaylist(index: Int, count: Int) { ui.update(playlistIndex: index, count: count) }
  @objc public func setArtwork(_ value: String) { artwork = value; ui.setArtwork(value); publishMetadata() }
  @objc public func setAutoPlay(_ value: Bool) { shouldAutoPlay = value }
  @objc public func setLoop(_ value: Bool) { shouldLoop = value }

  @objc public func setMuted(_ value: Bool) {
    if player.isMuted != value { player.isMuted = value }
  }

  @objc public func setVolume(_ value: Float) {
    let volume = max(0, min(1, value))
    if player.volume != volume { player.volume = volume }
  }

  @objc public func setRate(_ value: Float) {
    let rate = value > 0 ? value : 1
    guard rate != playbackRate else { return }
    playbackRate = rate
    if #available(iOS 16.0, *) { player.defaultRate = rate }
    if isPlaying { player.rate = rate }
    ui.update(rate: rate)
    publishNowPlaying()
    delegate?.audioDidChangeRate(Double(rate))
  }

  // MARK: - Commands

  @objc public func play() {
    prepareAudio() // before playing: with sound it plays even in silent mode
    player.playImmediately(atRate: playbackRate)
  }

  @objc public func pause() {
    player.pause()
  }

  @objc public func seek(to seconds: Double) {
    let target = max(0, duration > 0 ? min(seconds, duration) : seconds)
    player.seek(to: CMTime(seconds: target, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
    ui.update(current: target, duration: duration)
  }

  /// Called when Fabric recycles the view for another `Audio`.
  @objc public func reset() {
    player.pause()
    player.replaceCurrentItem(with: nil)
    clearItemObservers()
    source = nil
    isPlaying = false
    isBuffering = false
    lastTime = 0
    lastBuffered = 0
    ui.update(current: 0, duration: 0, buffered: 0)
    ui.update(playing: false, buffering: false)
    nowPlaying.deactivate()
    IsoAudioSession.release()
  }

  // MARK: - Control actions

  private func togglePlay() {
    isPlaying ? pause() : play()
  }

  private func skip(by seconds: Double) {
    seek(to: player.currentTime().seconds + seconds)
  }

  private func toggleMute() {
    player.isMuted.toggle()
  }

  private func publishMetadata() {
    nowPlaying.setMetadata(title: title, artist: artist, artwork: artwork)
    publishNowPlaying()
  }

  /// Position, duration and speed for the lock screen (on every state change, not every tick).
  private func publishNowPlaying() {
    nowPlaying.publish(current: player.currentTime().seconds, duration: duration, rate: isPlaying ? playbackRate : 0)
  }

  /// Audio session according to the current sound (see `IsoAudioSession`).
  private func prepareAudio() {
    IsoAudioSession.prepare(muted: player.isMuted || player.volume == 0)
  }

  // MARK: - Events

  private func statusChanged(_ item: AVPlayerItem) {
    switch item.status {
    case .readyToPlay:
      ui.update(current: lastTime, duration: duration)
      publishNowPlaying()
      delegate?.audioDidLoad(duration)
      if shouldAutoPlay { play() }
    case .failed:
      delegate?.audioDidFail(item.error?.localizedDescription ?? "Failed to load the audio.")
    default:
      break
    }
  }

  private func timeControlChanged(_ status: AVPlayer.TimeControlStatus) {
    if status != .paused { prepareAudio() }
    let buffering = status == .waitingToPlayAtSpecifiedRate
    if buffering != isBuffering {
      isBuffering = buffering
      delegate?.audioDidChangeBuffering(buffering)
    }
    guard !buffering else { return ui.update(playing: isPlaying, buffering: true) }
    let playing = status == .playing
    ui.update(playing: playing, buffering: false)
    guard playing != isPlaying else { return }
    isPlaying = playing
    if playing { nowPlaying.activate() }
    publishNowPlaying()
    if playing { delegate?.audioDidPlay() } else { delegate?.audioDidPause() }
  }

  private func didPlayToEnd() {
    guard !shouldLoop else { return restart() }
    IsoAudioSession.release()
    publishNowPlaying()
    delegate?.audioDidEnd()
  }

  private func restart() {
    player.seek(to: .zero)
    play()
  }

  private func timeJumped() {
    let to = player.currentTime().seconds
    guard to.isFinite, abs(to - lastTime) > 0.5 else { return }
    delegate?.audioDidSeek(from: lastTime, to: to)
    lastTime = to
    publishNowPlaying()
  }

  private func bufferedChanged(_ item: AVPlayerItem) {
    let current = player.currentTime()
    let ranges = item.loadedTimeRanges.map { $0.timeRangeValue }
    let range = ranges.first { $0.containsTime(current) } ?? ranges.last
    guard let range else { return }
    let end = range.end.seconds
    guard end.isFinite else { return }
    ui.update(buffered: end)
    // only reported every new half second (like the web)
    guard abs(end - lastBuffered) >= 0.5 else { return }
    lastBuffered = end
    delegate?.audioDidChangeBuffered(end)
  }

  private func volumeChanged() {
    let current = (player.volume, player.isMuted)
    if let last = lastVolume, last == current { return }
    lastVolume = current
    ui.update(muted: player.isMuted || player.volume == 0)
    // turned the sound on in the middle of the audio: from now on it plays in silent mode
    if player.rate > 0 { prepareAudio() }
    delegate?.audioDidChangeVolume(Double(player.volume), muted: player.isMuted)
  }

  // MARK: - Utilities

  private func clearItemObservers() {
    itemObservations = []
    itemNotifications.forEach { NotificationCenter.default.removeObserver($0) }
    itemNotifications = []
  }

  private var duration: Double {
    guard let seconds = player.currentItem?.duration.seconds, seconds.isFinite else { return 0 }
    return seconds
  }
}
