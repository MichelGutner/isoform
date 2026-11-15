import AVKit
import UIKit

/// The lib's own video controls on iOS (in place of `AVPlayerViewController`'s), in
/// UIKit, matching the Android and web players:
///  · top left: fullscreen, picture-in-picture, AirPlay;
///  · top right: playlist (with a list), speed menu, mute;
///  · center: −10 s · play/pause (spinner while loading) · +10 s;
///  · bottom: seek bar with elapsed and remaining time;
///  · tap shows/hides, double tap on a side skips 10 s, hides itself after 3 s while playing.
/// Buttons are glass (Liquid Glass on iOS 26, a dark blur before).
/// It knows nothing about `AVPlayer`: the player pushes state in and gets intentions through `actions`.
final class OmniVideoControls: UIView, UIGestureRecognizerDelegate {
  struct Actions {
    var togglePlay: () -> Void = {}
    var skip: (Double) -> Void = { _ in }
    var seek: (Double) -> Void = { _ in }
    var toggleMute: () -> Void = {}
    var selectRate: (Float) -> Void = { _ in }
    var toggleFullscreen: () -> Void = {}
    var togglePictureInPicture: () -> Void = {}
    var openPlaylist: () -> Void = {}
  }

  var actions = Actions()

  /// Turns the whole UI off (`controls={false}`): taps then do nothing.
  var enabled = true {
    didSet {
      isHidden = !enabled
      isUserInteractionEnabled = enabled
    }
  }

  private static let skipSeconds = 10.0
  private static let hideAfter: TimeInterval = 3
  private static let speeds: [Float] = [0.5, 0.75, 1, 1.25, 1.5, 2]

  private let layer0 = UIView() // everything that fades in and out
  private let topScrim = CAGradientLayer()
  private let bottomScrim = CAGradientLayer()

  private let fullscreenButton = OmniGlassButton(diameter: 36, symbol: "arrow.up.left.and.arrow.down.right", pointSize: 14)
  private let pipButton = OmniGlassButton(diameter: 36, symbol: "pip.enter", pointSize: 15)
  private let routeButton = AVRoutePickerView()
  private let playlistButton = OmniGlassButton(pill: "")
  private let speedButton = OmniGlassButton(pill: "1x")
  private let muteButton = OmniGlassButton(diameter: 36, symbol: "speaker.wave.2.fill", pointSize: 15)
  private let backButton = OmniGlassButton(diameter: 48, symbol: "gobackward.10", pointSize: 21)
  private let playButton = OmniGlassButton(diameter: 68, symbol: "play.fill", pointSize: 27)
  private let forwardButton = OmniGlassButton(diameter: 48, symbol: "goforward.10", pointSize: 21)
  private let spinner = UIActivityIndicatorView(style: .large)
  private let scrubber = OmniVideoScrubber()
  private let feedback = OmniSkipFeedback()

  private var playing = false
  private var buffering = false
  private var scrubbing = false
  private var visible = true
  private var rate: Float = 1
  private var hideTimer: Timer?

  override init(frame: CGRect) {
    super.init(frame: frame)
    // the controls always sit on video: dark glass and white icons, in light or dark mode;
    // and no "dimmed" tint while another screen (the fullscreen) is presented
    overrideUserInterfaceStyle = .dark
    tintAdjustmentMode = .normal
    buildScrims()
    buildButtons()
    layoutControls()
    buildGestures()
    update(playing: false, buffering: false)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    topScrim.frame = CGRect(x: 0, y: 0, width: bounds.width, height: min(110, bounds.height / 2))
    bottomScrim.frame = CGRect(x: 0, y: bounds.height - min(130, bounds.height / 2), width: bounds.width, height: min(130, bounds.height / 2))
    CATransaction.commit()
  }

  // MARK: - State from the player

  func update(playing: Bool, buffering: Bool) {
    self.playing = playing
    self.buffering = buffering
    let loading = buffering && !playing
    playButton.symbol = playing ? "pause.fill" : "play.fill"
    playButton.accessibilityLabel = playing ? "Pause" : "Play"
    playButton.iconHidden = loading
    loading ? spinner.startAnimating() : spinner.stopAnimating()
    scheduleHide()
  }

  func update(current: Double, duration: Double, buffered: Double) {
    scrubber.update(current: current, duration: duration, buffered: buffered)
  }

  func update(rate: Float) {
    self.rate = rate
    speedButton.title = Self.rateLabel(rate)
    speedButton.accessibilityLabel = "Speed: \(Self.rateLabel(rate))"
    speedButton.menu = speedMenu()
  }

  func update(muted: Bool) {
    muteButton.symbol = muted ? "speaker.slash.fill" : "speaker.wave.2.fill"
    muteButton.accessibilityLabel = muted ? "Unmute" : "Mute"
  }

  func update(fullscreen: Bool) {
    fullscreenButton.symbol = fullscreen ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right"
    fullscreenButton.accessibilityLabel = fullscreen ? "Exit fullscreen" : "Fullscreen"
  }

  func update(pictureInPictureSupported supported: Bool, active: Bool) {
    pipButton.isHidden = !supported
    pipButton.symbol = active ? "pip.exit" : "pip.enter"
    pipButton.accessibilityLabel = active ? "Exit picture in picture" : "Picture in picture"
  }

  /// Shows the playlist pill ("☰ 2/4") with a list, hides it without (`count` 0).
  func update(playlistIndex index: Int, count: Int) {
    playlistButton.isHidden = count == 0 || index < 0
    playlistButton.title = "\(index + 1)/\(count)"
    playlistButton.accessibilityLabel = "Playlist, item \(index + 1) of \(count)"
  }

  // MARK: - Showing and hiding

  private func setVisible(_ value: Bool, animated: Bool = true) {
    visible = value
    let changes = { self.layer0.alpha = value ? 1 : 0 }
    animated ? UIView.animate(withDuration: value ? 0.2 : 0.3, delay: 0, options: [.beginFromCurrentState, .allowUserInteraction], animations: changes) : changes()
    scheduleHide()
  }

  /// While playing (and not dragging the bar), the controls hide after a few seconds.
  private func scheduleHide() {
    hideTimer?.invalidate()
    guard visible, playing, !scrubbing else { return }
    hideTimer = Timer.scheduledTimer(withTimeInterval: Self.hideAfter, repeats: false) { [weak self] _ in
      self?.setVisible(false)
    }
  }

  /// Any use of a control keeps them on screen a bit longer.
  private func touched() {
    scheduleHide()
  }

  // MARK: - Gestures

  private func buildGestures() {
    let double = UITapGestureRecognizer(target: self, action: #selector(doubleTapped(_:)))
    double.numberOfTapsRequired = 2
    double.delegate = self
    let single = UITapGestureRecognizer(target: self, action: #selector(tapped))
    single.require(toFail: double)
    single.delegate = self
    addGestureRecognizer(double)
    addGestureRecognizer(single)
  }

  @objc private func tapped() {
    setVisible(!visible)
  }

  /// Double tap on the left half goes back 10 s, on the right half forward (like YouTube).
  @objc private func doubleTapped(_ gesture: UITapGestureRecognizer) {
    let forward = gesture.location(in: self).x > bounds.width / 2
    actions.skip(forward ? Self.skipSeconds : -Self.skipSeconds)
    feedback.show(forward: forward, in: self)
  }

  /// Taps on buttons and on the bar are theirs, not "show/hide".
  func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
    !(touch.view is UIControl) && !(touch.view?.isDescendant(of: scrubber) ?? false) && !(touch.view?.isDescendant(of: routeButton) ?? false)
  }

  // MARK: - Building

  private func buildScrims() {
    let clear = UIColor.black.withAlphaComponent(0).cgColor
    let dark = UIColor.black.withAlphaComponent(0.55).cgColor
    topScrim.colors = [dark, clear]
    bottomScrim.colors = [clear, dark]
    layer0.layer.addSublayer(topScrim)
    layer0.layer.addSublayer(bottomScrim)
  }

  private func buildButtons() {
    fullscreenButton.accessibilityLabel = "Fullscreen"
    fullscreenButton.addAction(UIAction { [weak self] _ in self?.actions.toggleFullscreen(); self?.touched() }, for: .touchUpInside)
    pipButton.addAction(UIAction { [weak self] _ in self?.actions.togglePictureInPicture(); self?.touched() }, for: .touchUpInside)
    pipButton.isHidden = true
    routeButton.tintColor = .white
    routeButton.activeTintColor = .systemBlue
    routeButton.prioritizesVideoDevices = true

    playlistButton.leadingSymbol = "list.bullet"
    playlistButton.isHidden = true
    playlistButton.addAction(UIAction { [weak self] _ in self?.actions.openPlaylist(); self?.touched() }, for: .touchUpInside)
    speedButton.showsMenuAsPrimaryAction = true
    speedButton.menu = speedMenu()
    muteButton.addAction(UIAction { [weak self] _ in self?.actions.toggleMute(); self?.touched() }, for: .touchUpInside)

    backButton.accessibilityLabel = "Back 10 seconds"
    backButton.addAction(UIAction { [weak self] _ in
      self?.actions.skip(-Self.skipSeconds)
      self?.backButton.spin(clockwise: false)
      self?.touched()
    }, for: .touchUpInside)
    forwardButton.accessibilityLabel = "Forward 10 seconds"
    forwardButton.addAction(UIAction { [weak self] _ in
      self?.actions.skip(Self.skipSeconds)
      self?.forwardButton.spin(clockwise: true)
      self?.touched()
    }, for: .touchUpInside)
    playButton.addAction(UIAction { [weak self] _ in self?.actions.togglePlay(); self?.touched() }, for: .touchUpInside)

    spinner.color = .white
    spinner.hidesWhenStopped = true

    scrubber.onScrubbing = { [weak self] active in
      self?.scrubbing = active
      self?.scheduleHide()
    }
    scrubber.onSeek = { [weak self] seconds in self?.actions.seek(seconds) }
  }

  private func layoutControls() {
    layer0.frame = bounds
    layer0.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    addSubview(layer0)

    let left = UIStackView(arrangedSubviews: [fullscreenButton, pipButton, routeButton])
    left.spacing = 8
    left.alignment = .center
    let right = UIStackView(arrangedSubviews: [playlistButton, speedButton, muteButton])
    right.spacing = 8
    right.alignment = .center
    let center = UIStackView(arrangedSubviews: [backButton, playButton, forwardButton])
    center.spacing = 36
    center.alignment = .center

    [left, right, center, scrubber, spinner].forEach {
      $0.translatesAutoresizingMaskIntoConstraints = false
      layer0.addSubview($0)
    }
    // the spinner shows even with the controls hidden (it lives outside the fading layer)
    spinner.removeFromSuperview()
    addSubview(spinner)

    let guide = layer0.safeAreaLayoutGuide
    NSLayoutConstraint.activate([
      routeButton.widthAnchor.constraint(equalToConstant: 32),
      routeButton.heightAnchor.constraint(equalToConstant: 32),
      left.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 12),
      left.topAnchor.constraint(equalTo: guide.topAnchor, constant: 12),
      right.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -12),
      right.topAnchor.constraint(equalTo: guide.topAnchor, constant: 12),
      right.leadingAnchor.constraint(greaterThanOrEqualTo: left.trailingAnchor, constant: 8),
      center.centerXAnchor.constraint(equalTo: centerXAnchor),
      center.centerYAnchor.constraint(equalTo: centerYAnchor),
      spinner.centerXAnchor.constraint(equalTo: centerXAnchor),
      spinner.centerYAnchor.constraint(equalTo: centerYAnchor),
      scrubber.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 16),
      scrubber.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -16),
      scrubber.bottomAnchor.constraint(equalTo: guide.bottomAnchor, constant: -8),
    ])
  }

  private func speedMenu() -> UIMenu {
    let items = Self.speeds.map { speed in
      UIAction(title: Self.rateLabel(speed), state: speed == rate ? .on : .off) { [weak self] _ in
        self?.actions.selectRate(speed)
        self?.touched()
      }
    }
    return UIMenu(title: "Speed", children: items)
  }

  private static func rateLabel(_ rate: Float) -> String {
    (rate == rate.rounded() ? String(Int(rate)) : String(rate)) + "x"
  }
}

// MARK: - Glass button

/// A round (or pill) button on glass: Liquid Glass on iOS 26, a dark blur before.
final class OmniGlassButton: UIButton {
  private let glass: UIVisualEffectView
  private let pointSize: CGFloat

  /// Round icon button.
  init(diameter: CGFloat, symbol: String, pointSize: CGFloat) {
    glass = UIVisualEffectView(effect: Self.glassEffect())
    self.pointSize = pointSize
    super.init(frame: .zero)
    var config = UIButton.Configuration.plain()
    config.baseForegroundColor = .white
    config.image = UIImage(systemName: symbol)
    config.preferredSymbolConfigurationForImage = UIImage.SymbolConfiguration(pointSize: pointSize, weight: .semibold)
    config.contentInsets = .zero
    configuration = config
    install(cornerRadius: diameter / 2)
    NSLayoutConstraint.activate([widthAnchor.constraint(equalToConstant: diameter), heightAnchor.constraint(equalToConstant: diameter)])
  }

  /// Pill with a text (speed, playlist position).
  init(pill title: String) {
    glass = UIVisualEffectView(effect: Self.glassEffect())
    pointSize = 12
    super.init(frame: .zero)
    var config = UIButton.Configuration.plain()
    config.baseForegroundColor = .white
    config.title = title
    config.contentInsets = NSDirectionalEdgeInsets(top: 0, leading: 12, bottom: 0, trailing: 12)
    config.imagePadding = 5
    config.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
      var outgoing = incoming
      outgoing.font = UIFont.monospacedDigitSystemFont(ofSize: 14, weight: .semibold)
      return outgoing
    }
    configuration = config
    install(cornerRadius: 16)
    NSLayoutConstraint.activate([heightAnchor.constraint(equalToConstant: 32), widthAnchor.constraint(greaterThanOrEqualToConstant: 44)])
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  var symbol: String? {
    get { nil }
    set { configuration?.image = newValue.flatMap { UIImage(systemName: $0) } }
  }

  /// Symbol before the title of a pill.
  var leadingSymbol: String? {
    get { nil }
    set {
      configuration?.image = newValue.flatMap { UIImage(systemName: $0) }
      configuration?.preferredSymbolConfigurationForImage = UIImage.SymbolConfiguration(pointSize: 12, weight: .bold)
    }
  }

  var title: String? {
    get { configuration?.title }
    set { configuration?.title = newValue }
  }

  /// Hides only the icon (the spinner takes its place while loading).
  var iconHidden = false {
    didSet { imageView?.alpha = iconHidden ? 0 : 1 }
  }

  /// The ±10 s arrow turns once in the direction of the jump.
  func spin(clockwise: Bool) {
    guard let imageView else { return }
    let turn = CABasicAnimation(keyPath: "transform.rotation.z")
    turn.fromValue = 0
    turn.toValue = (clockwise ? 1 : -1) * 2 * Double.pi
    turn.duration = 0.5
    turn.timingFunction = CAMediaTimingFunction(name: .easeOut)
    imageView.layer.add(turn, forKey: "spin")
  }

  override var isHighlighted: Bool {
    didSet {
      UIView.animate(withDuration: 0.15, delay: 0, options: [.beginFromCurrentState, .allowUserInteraction]) {
        self.transform = self.isHighlighted ? CGAffineTransform(scaleX: 0.9, y: 0.9) : .identity
      }
    }
  }

  private func install(cornerRadius: CGFloat) {
    translatesAutoresizingMaskIntoConstraints = false
    glass.isUserInteractionEnabled = false
    glass.clipsToBounds = true
    glass.layer.cornerRadius = cornerRadius
    glass.layer.cornerCurve = .continuous
    glass.translatesAutoresizingMaskIntoConstraints = false
    insertSubview(glass, at: 0)
    NSLayoutConstraint.activate([
      glass.leadingAnchor.constraint(equalTo: leadingAnchor),
      glass.trailingAnchor.constraint(equalTo: trailingAnchor),
      glass.topAnchor.constraint(equalTo: topAnchor),
      glass.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    sendSubviewToBack(glass)
  }

  private static func glassEffect() -> UIVisualEffect {
    #if compiler(>=6.2)
    if #available(iOS 26.0, *) {
      let glass = UIGlassEffect()
      glass.isInteractive = true
      return glass
    }
    #endif
    return UIBlurEffect(style: .systemUltraThinMaterialDark)
  }
}

// MARK: - Seek bar

/// Seek bar with the elapsed time on the left and the remaining on the right.
/// While dragging, the times follow the finger; the seek happens on release.
final class OmniVideoScrubber: UIView {
  var onSeek: (Double) -> Void = { _ in }
  var onScrubbing: (Bool) -> Void = { _ in }

  private let slider = UISlider()
  private let elapsed = UILabel()
  private let remaining = UILabel()
  private var duration: Double = 0
  private var dragging = false

  override init(frame: CGRect) {
    super.init(frame: frame)
    slider.minimumTrackTintColor = .white
    slider.maximumTrackTintColor = UIColor.white.withAlphaComponent(0.3)
    slider.setThumbImage(Self.thumb(diameter: 12), for: .normal)
    slider.setThumbImage(Self.thumb(diameter: 18), for: .highlighted)
    slider.accessibilityLabel = "Progress"
    slider.addTarget(self, action: #selector(began), for: .touchDown)
    slider.addTarget(self, action: #selector(moved), for: .valueChanged)
    slider.addTarget(self, action: #selector(ended), for: [.touchUpInside, .touchUpOutside, .touchCancel])
    [elapsed, remaining].forEach {
      $0.font = UIFont.monospacedDigitSystemFont(ofSize: 12, weight: .medium)
      $0.textColor = .white
      $0.setContentHuggingPriority(.required, for: .horizontal)
      $0.setContentCompressionResistancePriority(.required, for: .horizontal)
    }
    let row = UIStackView(arrangedSubviews: [elapsed, slider, remaining])
    row.spacing = 10
    row.alignment = .center
    row.translatesAutoresizingMaskIntoConstraints = false
    addSubview(row)
    NSLayoutConstraint.activate([
      row.leadingAnchor.constraint(equalTo: leadingAnchor),
      row.trailingAnchor.constraint(equalTo: trailingAnchor),
      row.topAnchor.constraint(equalTo: topAnchor),
      row.bottomAnchor.constraint(equalTo: bottomAnchor),
      heightAnchor.constraint(equalToConstant: 34),
    ])
    update(current: 0, duration: 0, buffered: 0)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  func update(current: Double, duration: Double, buffered: Double) {
    self.duration = duration
    slider.maximumValue = Float(max(duration, 0.01))
    slider.isEnabled = duration > 0
    guard !dragging else { return }
    slider.value = Float(current)
    show(current)
  }

  private func show(_ seconds: Double) {
    elapsed.text = Self.clock(seconds)
    remaining.text = duration > 0 ? "−" + Self.clock(max(0, duration - seconds)) : "−:--"
    slider.accessibilityValue = "\(Self.clock(seconds)) of \(Self.clock(duration))"
  }

  @objc private func began() {
    dragging = true
    onScrubbing(true)
  }

  @objc private func moved() {
    show(Double(slider.value))
  }

  @objc private func ended() {
    dragging = false
    onSeek(Double(slider.value))
    onScrubbing(false)
  }

  private static func thumb(diameter: CGFloat) -> UIImage {
    let size = CGSize(width: diameter + 4, height: diameter + 4)
    return UIGraphicsImageRenderer(size: size).image { context in
      context.cgContext.setShadow(offset: CGSize(width: 0, height: 1), blur: 2, color: UIColor.black.withAlphaComponent(0.35).cgColor)
      UIColor.white.setFill()
      UIBezierPath(ovalIn: CGRect(x: 2, y: 2, width: diameter, height: diameter)).fill()
    }
  }

  /// 75 → "1:15"; 3725 → "1:02:05".
  static func clock(_ seconds: Double) -> String {
    let total = Int(max(0, seconds.isFinite ? seconds : 0))
    let (h, m, s) = (total / 3600, total % 3600 / 60, total % 60)
    return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%d:%02d", m, s)
  }
}

// MARK: - Double-tap feedback

/// "−10 s" / "+10 s" bubble on the side that was double-tapped.
final class OmniSkipFeedback: UIView {
  private let label = UILabel()
  private var sideConstraint: NSLayoutConstraint?

  override init(frame: CGRect) {
    super.init(frame: frame)
    let glass = UIVisualEffectView(effect: UIBlurEffect(style: .systemUltraThinMaterialDark))
    glass.layer.cornerRadius = 22
    glass.clipsToBounds = true
    glass.translatesAutoresizingMaskIntoConstraints = false
    addSubview(glass)
    label.font = .systemFont(ofSize: 15, weight: .semibold)
    label.textColor = .white
    label.translatesAutoresizingMaskIntoConstraints = false
    addSubview(label)
    NSLayoutConstraint.activate([
      glass.leadingAnchor.constraint(equalTo: leadingAnchor),
      glass.trailingAnchor.constraint(equalTo: trailingAnchor),
      glass.topAnchor.constraint(equalTo: topAnchor),
      glass.bottomAnchor.constraint(equalTo: bottomAnchor),
      label.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
      label.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
      label.centerYAnchor.constraint(equalTo: centerYAnchor),
      heightAnchor.constraint(equalToConstant: 44),
    ])
    alpha = 0
    isUserInteractionEnabled = false
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  func show(forward: Bool, in host: UIView) {
    if superview !== host {
      translatesAutoresizingMaskIntoConstraints = false
      host.addSubview(self)
      centerYAnchor.constraint(equalTo: host.centerYAnchor).isActive = true
    }
    sideConstraint?.isActive = false
    sideConstraint = forward
      ? trailingAnchor.constraint(equalTo: host.trailingAnchor, constant: -32)
      : leadingAnchor.constraint(equalTo: host.leadingAnchor, constant: 32)
    sideConstraint?.isActive = true
    label.text = forward ? "+10 s" : "−10 s"
    host.layoutIfNeeded()
    layer.removeAllAnimations()
    alpha = 1
    transform = CGAffineTransform(scaleX: 0.85, y: 0.85)
    UIView.animate(withDuration: 0.2) { self.transform = .identity }
    UIView.animate(withDuration: 0.3, delay: 0.6, options: [.beginFromCurrentState]) { self.alpha = 0 }
  }
}
