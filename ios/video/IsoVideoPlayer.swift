import AVFoundation
import AVKit
import UIKit

/// Eventos do player, repassados pela casca Fabric (`IsoVideoView.mm`) ao JS.
@objc public protocol IsoVideoPlayerDelegate: AnyObject {
  func playerDidPlay()
  func playerDidPause()
  func playerDidEnd()
  func playerDidUpdateTime(_ currentTime: Double, duration: Double)
  func playerDidLoad(_ duration: Double, width: Double, height: Double)
  func playerDidFail(_ message: String)
  func playerDidSeek(from: Double, to: Double)
  func playerDidChangeBuffering(_ buffering: Bool)
  func playerDidChangeBuffered(_ buffered: Double)
  func playerDidChangeFullscreen(_ fullscreen: Bool)
  func playerDidChangeVolume(_ volume: Double, muted: Bool)
  func playerDidChangeRate(_ rate: Double)
  func playerDidPressPlaylist()
  func playerDidSelectPlaylistItem(_ index: Int)
}

/// The video picture: a view whose own layer is an `AVPlayerLayer`, so resizing the
/// view (also inside animations, like the fullscreen zoom) resizes the video with it.
final class IsoVideoSurface: UIView {
  override class var layerClass: AnyClass { AVPlayerLayer.self }
  var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
}

/// Player de vídeo com as APIs da Apple: `AVPlayer` para reprodução, `AVPlayerLayer`
/// para a imagem e os controles da própria lib (`IsoVideoControls`, iguais aos do
/// Android e da web): play, ±10 s, barra, velocidade, mudo, tela cheia com a transição
/// de zoom da Apple (`IsoVideoFullscreen`), picture-in-picture, AirPlay e playlist.
@objc(IsoVideoPlayer)
public final class IsoVideoPlayer: UIView {
  @objc public weak var delegate: IsoVideoPlayerDelegate?

  private let player = AVPlayer()
  /// Picture + controls: this is what travels to fullscreen and back.
  private let content = UIView()
  private let surface = IsoVideoSurface()
  private let controls = IsoVideoControls()
  private let fullscreen = IsoVideoFullscreen()
  /// The list's carousel inside the fullscreen (inline, the React Native panel is used).
  private let playlistPanel = IsoVideoPlaylistPanel()
  private var pictureInPicture: AVPictureInPictureController?
  private var pipObservations: [NSKeyValueObservation] = []

  private var source: String?
  private var shouldAutoPlay = false
  private var shouldLoop = false
  private var playbackRate: Float = 1

  // último estado avisado ao JS (evita eventos repetidos)
  private var isPlaying = false
  private var isBuffering = false
  private var isFullscreen = false
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
    // clear until the first frame: the poster sits under this view and the controls draw over it
    backgroundColor = .clear

    surface.playerLayer.player = player
    surface.playerLayer.videoGravity = .resizeAspect
    surface.backgroundColor = .clear
    content.backgroundColor = .clear
    content.clipsToBounds = true
    content.frame = bounds
    content.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    [surface, controls].forEach {
      $0.frame = content.bounds
      $0.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      content.addSubview($0)
    }
    playlistPanel.translatesAutoresizingMaskIntoConstraints = false
    content.addSubview(playlistPanel)
    NSLayoutConstraint.activate([
      playlistPanel.leadingAnchor.constraint(equalTo: content.leadingAnchor),
      playlistPanel.trailingAnchor.constraint(equalTo: content.trailingAnchor),
      playlistPanel.bottomAnchor.constraint(equalTo: content.bottomAnchor),
    ])
    playlistPanel.onSelect = { [weak self] index in self?.delegate?.playerDidSelectPlaylistItem(index) }
    addSubview(content)
    configureControls()
    configurePictureInPicture()
    fullscreen.onClosed = { [weak self] in self?.fullscreenChanged(false) }

    // Posição a cada 250 ms (como o `timeupdate` da web). Também guarda a
    // última posição, que vira o `from` do próximo seek.
    timeObserver = player.addPeriodicTimeObserver(
      forInterval: CMTime(seconds: 0.25, preferredTimescale: 600),
      queue: .main
    ) { [weak self] time in
      guard let self else { return }
      self.lastTime = time.seconds
      self.controls.update(current: time.seconds, duration: self.duration, buffered: self.lastBuffered)
      if self.isPlaying { self.delegate?.playerDidUpdateTime(time.seconds, duration: self.duration) }
    }

    observations = [
      // tocando / pausado / esperando dados, a partir do estado real do player
      player.observe(\.timeControlStatus, options: [.new]) { [weak self] player, _ in
        DispatchQueue.main.async { self?.timeControlChanged(player.timeControlStatus) }
      },
      // velocidade: o menu de velocidade do AVKit (iOS 16+) muda o `rate`; 0 é só "pausado"
      player.observe(\.rate, options: [.new]) { [weak self] player, _ in
        DispatchQueue.main.async {
          guard let self, player.rate > 0, player.rate != self.lastRate else { return }
          self.lastRate = player.rate
          self.playbackRate = player.rate
          self.controls.update(rate: player.rate)
          self.delegate?.playerDidChangeRate(Double(player.rate))
        }
      },
      // volume e mudo (o botão de som do AVKit muda o `isMuted`)
      player.observe(\.isMuted, options: [.new]) { [weak self] _, _ in
        DispatchQueue.main.async { self?.volumeChanged() }
      },
      player.observe(\.volume, options: [.new]) { [weak self] _, _ in
        DispatchQueue.main.async { self?.volumeChanged() }
      },
    ]
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) não é suportado")
  }

  deinit {
    if let timeObserver { player.removeTimeObserver(timeObserver) }
    clearItemObservers()
    player.pause()
  }

  // MARK: - Controls

  private func configureControls() {
    controls.actions = IsoVideoControls.Actions(
      togglePlay: { [weak self] in self?.togglePlay() },
      skip: { [weak self] seconds in self.map { $0.seek(to: max(0, $0.player.currentTime().seconds + seconds)) } },
      seek: { [weak self] seconds in self?.seek(to: seconds) },
      toggleMute: { [weak self] in self.map { $0.player.isMuted.toggle() } },
      selectRate: { [weak self] rate in self?.setRate(rate) },
      toggleFullscreen: { [weak self] in self.map { $0.setFullscreen(!$0.isFullscreen) } },
      togglePictureInPicture: { [weak self] in self?.togglePictureInPicture() },
      openPlaylist: { [weak self] in
        guard let self else { return }
        // fullscreen: our own carousel; inline: the React Native panel
        guard !self.isFullscreen else { return self.playlistPanel.show() }
        self.delegate?.playerDidPressPlaylist()
      }
    )
    controls.update(rate: playbackRate)
    controls.update(muted: player.isMuted)
    controls.update(fullscreen: false)
  }

  private func togglePlay() {
    let ended = duration > 0 && player.currentTime().seconds >= duration - 0.25
    if ended { player.seek(to: .zero) }
    player.timeControlStatus == .paused ? play() : pause()
  }

  /// List position for the playlist pill (`count` 0 hides it).
  @objc public func setPlaylist(index: Int, count: Int) {
    controls.update(playlistIndex: index, count: count)
    playlistPanel.set(index: index)
  }

  /// The entries (`[{ title, image }]` as JSON) for the fullscreen carousel.
  @objc public func setPlaylistItems(_ json: String) {
    playlistPanel.set(json: json)
  }

  // MARK: - Picture in picture

  private func configurePictureInPicture() {
    let supported = AVPictureInPictureController.isPictureInPictureSupported()
    controls.update(pictureInPictureSupported: supported, active: false)
    guard supported, let pip = AVPictureInPictureController(playerLayer: surface.playerLayer) else { return }
    pictureInPicture = pip
    pip.canStartPictureInPictureAutomaticallyFromInline = false
    pipObservations = [
      pip.observe(\.isPictureInPictureActive, options: [.new]) { [weak self] pip, _ in
        DispatchQueue.main.async { self?.controls.update(pictureInPictureSupported: true, active: pip.isPictureInPictureActive) }
      },
    ]
  }

  private func togglePictureInPicture() {
    guard let pip = pictureInPicture else { return }
    pip.isPictureInPictureActive ? pip.stopPictureInPicture() : pip.startPictureInPicture()
  }

  // MARK: - Hierarquia de view controllers

  /// O view controller que mostra o player (apresenta a tela cheia).
  private var parentViewController: UIViewController? {
    var responder: UIResponder? = self
    while let next = responder?.next {
      if let viewController = next as? UIViewController { return viewController }
      responder = next
    }
    return nil
  }

  // MARK: - Props

  @objc public func setSource(_ value: String) {
    guard value != source else { return }
    source = value
    clearItemObservers()
    lastTime = 0
    lastBuffered = 0

    guard !value.isEmpty, let url = URL(string: value) else {
      player.replaceCurrentItem(with: nil)
      return
    }

    let item = AVPlayerItem(url: url)
    itemObservations = [
      item.observe(\.status, options: [.new]) { [weak self] item, _ in
        DispatchQueue.main.async { self?.statusChanged(item) }
      },
      // até onde já foi baixado
      item.observe(\.loadedTimeRanges, options: [.new]) { [weak self] item, _ in
        DispatchQueue.main.async { self?.bufferedChanged(item) }
      },
    ]
    itemNotifications = [
      NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main) {
        [weak self] _ in self?.didPlayToEnd()
      },
      // seek (barra, ±15 s do AVKit ou `seekTo`): a posição "pulou"
      NotificationCenter.default.addObserver(forName: AVPlayerItem.timeJumpedNotification, object: item, queue: .main) {
        [weak self] _ in self?.timeJumped()
      },
    ]
    player.replaceCurrentItem(with: item)
  }

  @objc public func setControls(_ value: Bool) {
    controls.enabled = value
  }

  @objc public func setAutoPlay(_ value: Bool) {
    shouldAutoPlay = value
  }

  @objc public func setLoop(_ value: Bool) {
    shouldLoop = value
  }

  @objc public func setMuted(_ value: Bool) {
    if player.isMuted != value { player.isMuted = value }
    controls.update(muted: player.isMuted)
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
    controls.update(rate: rate)
  }

  // MARK: - Comandos

  @objc public func play() {
    prepareAudio() // antes de tocar: com som, toca mesmo no modo silencioso
    player.playImmediately(atRate: playbackRate)
  }

  @objc public func pause() {
    player.pause()
  }

  @objc public func seek(to seconds: Double) {
    player.seek(to: CMTime(seconds: max(0, seconds), preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
  }

  /// Fullscreen with Apple's zoom transition (`IsoVideoFullscreen`): the player itself
  /// grows from its place to the whole screen, and a landscape video turns to landscape.
  @objc public func setFullscreen(_ value: Bool) {
    guard value != isFullscreen else { return }
    guard value else { return fullscreen.dismiss() }
    guard let presenter = parentViewController else { return }
    let size = player.currentItem?.presentationSize ?? .zero
    fullscreen.present(content, from: self, landscape: size.width > size.height, presenter: presenter)
    fullscreenChanged(true)
  }

  /// Chamado quando o Fabric recicla a view para outro `Video`.
  @objc public func reset() {
    player.pause()
    player.replaceCurrentItem(with: nil)
    if isFullscreen { fullscreen.dismiss() }
    clearItemObservers()
    source = nil
    isPlaying = false
    isBuffering = false
    isFullscreen = false
    lastTime = 0
    lastBuffered = 0
    IsoAudioSession.release()
  }

  /// Sessão de áudio conforme o som atual (ver `IsoAudioSession`).
  private func prepareAudio() {
    IsoAudioSession.prepare(muted: player.isMuted || player.volume == 0)
  }

  // MARK: - Eventos

  private func statusChanged(_ item: AVPlayerItem) {
    switch item.status {
    case .readyToPlay:
      let size = item.presentationSize
      delegate?.playerDidLoad(duration, width: Double(size.width), height: Double(size.height))
      if shouldAutoPlay { play() }
    case .failed:
      delegate?.playerDidFail(item.error?.localizedDescription ?? "Falha ao carregar o vídeo.")
    default:
      break
    }
  }

  private func timeControlChanged(_ status: AVPlayer.TimeControlStatus) {
    // play pelos controles nativos do AVKit não passa pelo nosso `play()`
    if status != .paused { prepareAudio() }
    let buffering = status == .waitingToPlayAtSpecifiedRate
    controls.update(playing: status == .playing, buffering: buffering)
    if buffering != isBuffering {
      isBuffering = buffering
      delegate?.playerDidChangeBuffering(buffering)
    }
    guard !buffering else { return } // esperando dados não é "pausou"
    let playing = status == .playing
    guard playing != isPlaying else { return }
    isPlaying = playing
    if playing { delegate?.playerDidPlay() } else { delegate?.playerDidPause() }
  }

  private func didPlayToEnd() {
    guard !shouldLoop else { return restart() }
    IsoAudioSession.release()
    delegate?.playerDidEnd()
  }

  private func restart() {
    player.seek(to: .zero)
    play()
  }

  private func timeJumped() {
    let to = player.currentTime().seconds
    guard to.isFinite, abs(to - lastTime) > 0.5 else { return } // ignora ajustes mínimos do próprio player
    delegate?.playerDidSeek(from: lastTime, to: to)
    lastTime = to
  }

  private func bufferedChanged(_ item: AVPlayerItem) {
    let current = player.currentTime()
    let ranges = item.loadedTimeRanges.map { $0.timeRangeValue }
    let range = ranges.first { $0.containsTime(current) } ?? ranges.last
    guard let range else { return }
    let end = range.end.seconds
    // só avisa a cada meio segundo novo (como na web)
    guard end.isFinite, abs(end - lastBuffered) >= 0.5 else { return }
    lastBuffered = end
    delegate?.playerDidChangeBuffered(end)
  }

  private func volumeChanged() {
    let current = (player.volume, player.isMuted)
    if let last = lastVolume, last == current { return }
    lastVolume = current
    controls.update(muted: player.isMuted)
    // ligou o som no meio do vídeo: passa a tocar mesmo no modo silencioso
    if player.rate > 0 { prepareAudio() }
    delegate?.playerDidChangeVolume(Double(player.volume), muted: player.isMuted)
  }

  private func fullscreenChanged(_ value: Bool) {
    guard value != isFullscreen else { return }
    isFullscreen = value
    controls.update(fullscreen: value)
    if !value { playlistPanel.hide() }
    delegate?.playerDidChangeFullscreen(value)
  }

  // MARK: - Utilitários

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
