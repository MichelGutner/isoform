import AVFoundation
import AVKit
import UIKit

/// Eventos do player, repassados pela casca Fabric (`OmniVideoView.mm`) ao JS.
@objc public protocol OmniVideoPlayerDelegate: AnyObject {
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
}

/// Player de vídeo com as APIs da Apple: `AVPlayer` para reprodução e
/// `AVPlayerViewController` para os controles nativos (play, barra, velocidade,
/// tela cheia, AirPlay, PiP).
@objc(OmniVideoPlayer)
public final class OmniVideoPlayer: UIView {
  @objc public weak var delegate: OmniVideoPlayerDelegate?

  private let player = AVPlayer()
  private let controller = AVPlayerViewController()

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

  /// Tela cheia aberta por comando (`setFullscreen(true)`).
  private var presentedController: AVPlayerViewController?

  private var timeObserver: Any?
  private var observations: [NSKeyValueObservation] = []
  private var itemObservations: [NSKeyValueObservation] = []
  private var itemNotifications: [NSObjectProtocol] = []

  @objc public override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .black

    controller.player = player
    controller.delegate = self
    controller.videoGravity = .resizeAspect
    controller.view.frame = bounds
    controller.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    controller.view.backgroundColor = .black
    addSubview(controller.view)

    // Posição a cada 250 ms (como o `timeupdate` da web). Também guarda a
    // última posição, que vira o `from` do próximo seek.
    timeObserver = player.addPeriodicTimeObserver(
      forInterval: CMTime(seconds: 0.25, preferredTimescale: 600),
      queue: .main
    ) { [weak self] time in
      guard let self else { return }
      self.lastTime = time.seconds
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

  // MARK: - Hierarquia de view controllers

  /// O `AVPlayerViewController` precisa de um pai para a tela cheia funcionar.
  public override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil, controller.parent == nil, let parent = parentViewController {
      parent.addChild(controller)
      controller.didMove(toParent: parent)
    } else if window == nil, controller.parent != nil {
      controller.willMove(toParent: nil)
      controller.removeFromParent()
    }
  }

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
    controller.showsPlaybackControls = value
  }

  @objc public func setAutoPlay(_ value: Bool) {
    shouldAutoPlay = value
  }

  @objc public func setLoop(_ value: Bool) {
    shouldLoop = value
  }

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

  /// O AVKit não tem API pública para abrir a própria tela cheia: apresentamos um
  /// segundo `AVPlayerViewController` em tela cheia com o MESMO `AVPlayer`.
  @objc public func setFullscreen(_ value: Bool) {
    // referência antiga de uma tela cheia que já foi fechada
    if presentedController?.presentingViewController == nil { presentedController = nil }

    if value {
      guard presentedController == nil, !isFullscreen, let parent = parentViewController else { return }
      let fullscreen = AVPlayerViewController()
      fullscreen.player = player
      fullscreen.delegate = self // avisa quando o usuário fecha (botão ou gesto)
      fullscreen.modalPresentationStyle = .fullScreen
      presentedController = fullscreen
      parent.present(fullscreen, animated: true) { [weak self] in self?.fullscreenChanged(true) }
    } else if let presentedController {
      presentedController.dismiss(animated: true) { [weak self] in
        self?.presentedController = nil
        self?.fullscreenChanged(false)
      }
    }
  }

  /// Chamado quando o Fabric recicla a view para outro `Video`.
  @objc public func reset() {
    player.pause()
    player.replaceCurrentItem(with: nil)
    presentedController?.dismiss(animated: false)
    presentedController = nil
    clearItemObservers()
    source = nil
    isPlaying = false
    isBuffering = false
    isFullscreen = false
    lastTime = 0
    lastBuffered = 0
    OmniAudioSession.release()
  }

  /// Sessão de áudio conforme o som atual (ver `OmniAudioSession`).
  private func prepareAudio() {
    OmniAudioSession.prepare(muted: player.isMuted || player.volume == 0)
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
    OmniAudioSession.release()
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
    // ligou o som no meio do vídeo: passa a tocar mesmo no modo silencioso
    if player.rate > 0 { prepareAudio() }
    delegate?.playerDidChangeVolume(Double(player.volume), muted: player.isMuted)
  }

  private func fullscreenChanged(_ value: Bool) {
    guard value != isFullscreen else { return }
    isFullscreen = value
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

// MARK: - Tela cheia (botão nativo do AVKit ou a aberta por `setFullscreen`)

extension OmniVideoPlayer: AVPlayerViewControllerDelegate {
  public func playerViewController(
    _ playerViewController: AVPlayerViewController,
    willBeginFullScreenPresentationWithAnimationCoordinator coordinator: UIViewControllerTransitionCoordinator
  ) {
    coordinator.animate(alongsideTransition: nil) { [weak self] context in
      if !context.isCancelled { self?.fullscreenChanged(true) }
    }
  }

  public func playerViewController(
    _ playerViewController: AVPlayerViewController,
    willEndFullScreenPresentationWithAnimationCoordinator coordinator: UIViewControllerTransitionCoordinator
  ) {
    coordinator.animate(alongsideTransition: nil) { [weak self] context in
      guard let self, !context.isCancelled else { return }
      if playerViewController === self.presentedController { self.presentedController = nil }
      self.fullscreenChanged(false)
    }
  }
}
