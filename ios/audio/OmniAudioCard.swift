import UIKit

/// The card UI of `OmniAudioPlayer`, in UIKit with system colors and SF Symbols:
/// cover, title and artist, speed menu (`UIMenu`), seek slider with elapsed and
/// remaining time, −10 s · play/pause · +10 s and mute.
/// It knows nothing about `AVPlayer`: the player pushes state in through
/// `update(...)` and receives the user's intentions through `actions`.
final class OmniAudioCard: UIView {
  struct Actions {
    var togglePlay: () -> Void = {}
    var skip: (Double) -> Void = { _ in }
    var seek: (Double) -> Void = { _ in }
    var toggleMute: () -> Void = {}
    var selectRate: (Float) -> Void = { _ in }
  }

  var actions = Actions()

  private static let skipSeconds = 10.0
  private static let speeds: [Float] = [0.5, 0.75, 1, 1.25, 1.5, 2]
  private static let artworkCache = NSCache<NSString, UIImage>()

  private let artwork = OmniArtworkView()
  private let titleLabel = UILabel()
  private let artistLabel = UILabel()
  private let speedButton = UIButton(type: .system)
  private let seekBar = OmniSeekBar()
  private let elapsedLabel = UILabel()
  private let remainingLabel = UILabel()
  private let skipBackButton = UIButton(type: .system)
  private let playButton = UIButton(type: .system)
  private let skipForwardButton = UIButton(type: .system)
  private let muteButton = UIButton(type: .system)

  private var duration: Double = 0
  private var current: Double = 0
  private var rate: Float = 1
  private var isPlaying = false
  private var isMuted = false
  private var currentArtwork: String?

  override init(frame: CGRect) {
    super.init(frame: frame)
    configureCard()
    configureTexts()
    configureButtons()
    configureSeekBar()
    layoutContent()
    update(rate: 1)
    update(muted: false)
    update(playing: false, buffering: false)
    update(current: 0, duration: 0, buffered: 0)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  // MARK: - State coming from the player

  func update(current: Double? = nil, duration: Double? = nil, buffered: Double? = nil) {
    if let duration { self.duration = duration }
    if let current { self.current = current }
    seekBar.maximum = self.duration
    if !seekBar.isScrubbing { seekBar.seconds = self.current }
    if let buffered { seekBar.buffered = buffered }
    refreshTimes(shown: seekBar.isScrubbing ? seekBar.seconds : self.current)
  }

  func update(playing: Bool, buffering: Bool) {
    isPlaying = playing
    playButton.configuration?.image = UIImage(systemName: playing ? "pause.fill" : "play.fill")
    playButton.configuration?.showsActivityIndicator = buffering && playing
    playButton.accessibilityLabel = playing ? "Pause" : "Play"
  }

  func update(muted: Bool) {
    isMuted = muted
    muteButton.configuration?.image = UIImage(systemName: muted ? "speaker.slash.fill" : "speaker.wave.2.fill")
    muteButton.accessibilityLabel = muted ? "Unmute" : "Mute"
  }

  func update(rate: Float) {
    self.rate = rate
    speedButton.configuration?.title = Self.rateLabel(rate)
    speedButton.accessibilityLabel = "Speed: \(Self.rateLabel(rate))"
    speedButton.menu = makeSpeedMenu()
  }

  func setTitle(_ value: String) {
    titleLabel.text = value.isEmpty ? "Audio" : value
  }

  func setArtist(_ value: String) {
    artistLabel.text = value
    artistLabel.isHidden = value.isEmpty
  }

  func setArtwork(_ value: String) {
    guard value != currentArtwork else { return }
    currentArtwork = value
    artwork.image = nil
    guard !value.isEmpty, let url = URL(string: value) else { return }
    if let cached = Self.artworkCache.object(forKey: value as NSString) {
      artwork.image = cached
      return
    }
    URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
      guard let data, let image = UIImage(data: data) else { return }
      Self.artworkCache.setObject(image, forKey: value as NSString)
      DispatchQueue.main.async {
        // ignores an answer that arrives after the cover changed again
        guard self?.currentArtwork == value else { return }
        self?.artwork.image = image
      }
    }.resume()
  }

  // MARK: - Setup

  private func configureCard() {
    backgroundColor = .secondarySystemBackground
    layer.cornerRadius = 20
    layer.cornerCurve = .continuous
    clipsToBounds = true
    refreshBorder()
    // a CGColor does not follow light/dark by itself: redo it when the style changes
    if #available(iOS 17.0, *) {
      registerForTraitChanges([UITraitUserInterfaceStyle.self]) { (card: OmniAudioCard, _) in card.refreshBorder() }
    }
  }

  private func refreshBorder() {
    layer.borderWidth = 1 / max(traitCollection.displayScale, 1)
    layer.borderColor = UIColor.separator.resolvedColor(with: traitCollection).cgColor
  }

  private func configureTexts() {
    titleLabel.font = .systemFont(ofSize: 15, weight: .semibold)
    titleLabel.textColor = .label
    titleLabel.text = "Audio"
    artistLabel.font = .systemFont(ofSize: 13)
    artistLabel.textColor = .secondaryLabel
    artistLabel.isHidden = true
    for label in [elapsedLabel, remainingLabel] {
      label.font = .monospacedDigitSystemFont(ofSize: 12, weight: .regular)
      label.textColor = .secondaryLabel
    }
    remainingLabel.textAlignment = .right
  }

  private func configureButtons() {
    skipBackButton.configuration = Self.plainConfiguration(symbol: "gobackward.10", size: 20)
    skipBackButton.accessibilityLabel = "Back 10 seconds"
    skipBackButton.addAction(UIAction { [weak self] _ in self?.actions.skip(-Self.skipSeconds) }, for: .touchUpInside)

    skipForwardButton.configuration = Self.plainConfiguration(symbol: "goforward.10", size: 20)
    skipForwardButton.accessibilityLabel = "Forward 10 seconds"
    skipForwardButton.addAction(UIAction { [weak self] _ in self?.actions.skip(Self.skipSeconds) }, for: .touchUpInside)

    playButton.configuration = Self.playConfiguration()
    playButton.addAction(UIAction { [weak self] _ in self?.actions.togglePlay() }, for: .touchUpInside)

    muteButton.configuration = Self.plainConfiguration(symbol: "speaker.wave.2.fill", size: 16)
    muteButton.addAction(UIAction { [weak self] _ in self?.actions.toggleMute() }, for: .touchUpInside)

    speedButton.configuration = Self.pillConfiguration()
    speedButton.showsMenuAsPrimaryAction = true
    speedButton.setContentHuggingPriority(.required, for: .horizontal)
    speedButton.setContentCompressionResistancePriority(.required, for: .horizontal)
  }

  private func configureSeekBar() {
    seekBar.accessibilityLabel = "Progress"
    seekBar.onScrub = { [weak self] seconds in self?.refreshTimes(shown: seconds) }
    seekBar.onCommit = { [weak self] seconds in self?.actions.seek(seconds) }
  }

  private func layoutContent() {
    artwork.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([artwork.widthAnchor.constraint(equalToConstant: 56), artwork.heightAnchor.constraint(equalToConstant: 56)])

    let meta = UIStackView(arrangedSubviews: [titleLabel, artistLabel])
    meta.axis = .vertical
    meta.spacing = 2
    meta.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

    let head = UIStackView(arrangedSubviews: [artwork, meta, speedButton])
    head.axis = .horizontal
    head.alignment = .center
    head.spacing = 12

    let times = UIStackView(arrangedSubviews: [elapsedLabel, remainingLabel])
    times.distribution = .fillEqually
    let progress = UIStackView(arrangedSubviews: [seekBar, times])
    progress.axis = .vertical
    progress.spacing = 0

    // skip · play · skip centered; mute on the leading side, a same-size blank on the trailing one
    let transport = UIStackView(arrangedSubviews: [skipBackButton, playButton, skipForwardButton])
    transport.axis = .horizontal
    transport.alignment = .center
    transport.spacing = 14

    let leadingSpace = UIView()
    let trailingSpace = UIView()
    let balance = UIView()
    let controls = UIStackView(arrangedSubviews: [muteButton, leadingSpace, transport, trailingSpace, balance])
    controls.axis = .horizontal
    controls.alignment = .center
    controls.spacing = 0

    Self.pin(skipBackButton, size: Self.sideSize)
    Self.pin(skipForwardButton, size: Self.sideSize)
    Self.pin(muteButton, size: Self.sideSize)
    Self.pin(playButton, size: Self.playSize)
    Self.pin(balance, size: Self.sideSize)
    leadingSpace.widthAnchor.constraint(equalTo: trailingSpace.widthAnchor).isActive = true

    let content = UIStackView(arrangedSubviews: [head, progress, controls])
    content.axis = .vertical
    content.spacing = 8
    content.translatesAutoresizingMaskIntoConstraints = false
    addSubview(content)
    NSLayoutConstraint.activate([
      content.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
      content.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
      content.topAnchor.constraint(equalTo: topAnchor, constant: 12),
      content.bottomAnchor.constraint(lessThanOrEqualTo: bottomAnchor, constant: -12),
    ])
  }

  // MARK: - Pieces

  private func refreshTimes(shown: Double) {
    elapsedLabel.text = Self.clock(shown)
    remainingLabel.text = duration > 0 ? "−" + Self.clock(max(0, duration - shown)) : ""
    seekBar.accessibilityValue = "\(Self.clock(shown)) of \(Self.clock(duration))"
  }

  private func makeSpeedMenu() -> UIMenu {
    let items = Self.speeds.map { speed in
      UIAction(title: Self.rateLabel(speed), state: speed == rate ? .on : .off) { [weak self] _ in
        self?.actions.selectRate(speed)
      }
    }
    return UIMenu(title: "Speed", children: items)
  }

  private static func rateLabel(_ rate: Float) -> String {
    let text = rate == rate.rounded() ? String(Int(rate)) : String(rate)
    return text + "x"
  }

  /// 75 → "1:15"; 3725 → "1:02:05".
  private static func clock(_ seconds: Double) -> String {
    let total = Int(max(0, seconds.isFinite ? seconds : 0))
    let (h, m, s) = (total / 3600, total % 3600 / 60, total % 60)
    return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%d:%02d", m, s)
  }

  // MARK: - Button styles (system configurations, monochrome: plain icons, gray pill)

  /// Diameter of the play button and of the round side buttons (compact card; the touch area is the whole button).
  private static let playSize: CGFloat = 48
  private static let sideSize: CGFloat = 40

  /// Fixes a view to `size` × `size`, so a glyph change (play ↔ pause) never moves the layout.
  private static func pin(_ view: UIView, size: CGFloat) {
    view.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      view.widthAnchor.constraint(equalToConstant: size),
      view.heightAnchor.constraint(equalToConstant: size),
    ])
  }

  private static func plainConfiguration(symbol: String, size: CGFloat) -> UIButton.Configuration {
    var config = UIButton.Configuration.plain()
    config.image = UIImage(systemName: symbol)
    config.preferredSymbolConfigurationForImage = UIImage.SymbolConfiguration(pointSize: size, weight: .regular)
    config.baseForegroundColor = .label
    config.contentInsets = NSDirectionalEdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8)
    return config
  }

  /// Plain glyph in the label color, like the other controls, only bigger.
  private static func playConfiguration() -> UIButton.Configuration {
    var config = plainConfiguration(symbol: "play.fill", size: 30)
    config.preferredSymbolConfigurationForImage = UIImage.SymbolConfiguration(pointSize: 30, weight: .semibold)
    config.contentInsets = .zero
    return config
  }

  private static func pillConfiguration() -> UIButton.Configuration {
    var config = UIButton.Configuration.gray()
    config.cornerStyle = .capsule
    config.baseForegroundColor = .label
    config.contentInsets = NSDirectionalEdgeInsets(top: 6, leading: 12, bottom: 6, trailing: 12)
    config.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
      var outgoing = incoming
      outgoing.font = UIFont.monospacedDigitSystemFont(ofSize: 13, weight: .semibold)
      return outgoing
    }
    return config
  }

  // iOS 15–16 (from iOS 17 `registerForTraitChanges` above does this)
  override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
    super.traitCollectionDidChange(previousTraitCollection)
    if #unavailable(iOS 17.0) { refreshBorder() }
  }
}

// MARK: - Cover

/// The cover, or a neutral fill with a music note while there is none.
private final class OmniArtworkView: UIView {
  private let note = UIImageView(image: UIImage(systemName: "music.note"))
  private let picture = UIImageView()

  var image: UIImage? {
    get { picture.image }
    set { picture.image = newValue }
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    layer.cornerRadius = 12
    layer.cornerCurve = .continuous
    clipsToBounds = true
    backgroundColor = .tertiarySystemFill
    note.tintColor = .secondaryLabel
    note.contentMode = .center
    note.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 24, weight: .medium)
    addSubview(note)
    picture.contentMode = .scaleAspectFill
    picture.clipsToBounds = true
    addSubview(picture)
    isAccessibilityElement = false
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    note.frame = bounds
    picture.frame = bounds
  }
}

// MARK: - Seek bar

/// Thin slider (4 pt) with a buffered range, a small thumb that grows while dragging, and a plain-value API in seconds.
private final class OmniSeekBar: UISlider {
  var onScrub: ((Double) -> Void)?
  var onCommit: ((Double) -> Void)?
  private(set) var isScrubbing = false

  private let rail = UIView()
  private let bufferedRail = UIView()

  var maximum: Double {
    get { Double(maximumValue) }
    set {
      maximumValue = Float(max(newValue, 0.01))
      isEnabled = newValue > 0
      setNeedsLayout()
    }
  }

  /// Current position, in seconds.
  var seconds: Double {
    get { Double(value) }
    set { value = Float(newValue) }
  }

  var buffered: Double = 0 {
    didSet { setNeedsLayout() }
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    minimumTrackTintColor = .label
    maximumTrackTintColor = .clear
    rail.backgroundColor = .tertiarySystemFill
    bufferedRail.backgroundColor = .quaternaryLabel
    for view in [rail, bufferedRail] {
      view.isUserInteractionEnabled = false
      view.layer.cornerRadius = 2
      insertSubview(view, at: 0)
    }
    setThumbImage(Self.thumb(diameter: 12), for: .normal)
    setThumbImage(Self.thumb(diameter: 20), for: .highlighted)

    addAction(UIAction { [weak self] _ in self?.isScrubbing = true }, for: .touchDown)
    addAction(UIAction { [weak self] _ in
      guard let self else { return }
      self.onScrub?(self.seconds)
    }, for: .valueChanged)
    let finish = UIAction { [weak self] _ in
      guard let self else { return }
      self.isScrubbing = false
      self.onCommit?(self.seconds)
    }
    addAction(finish, for: [.touchUpInside, .touchUpOutside, .touchCancel])
    heightAnchor.constraint(equalToConstant: 24).isActive = true
    isAccessibilityElement = true
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  override func trackRect(forBounds bounds: CGRect) -> CGRect {
    CGRect(x: bounds.minX, y: bounds.midY - 2, width: bounds.width, height: 4)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    let track = trackRect(forBounds: bounds)
    rail.frame = track
    let fraction = maximum > 0 ? min(1, max(0, buffered / maximum)) : 0
    bufferedRail.frame = CGRect(x: track.minX, y: track.minY, width: track.width * CGFloat(fraction), height: track.height)
  }

  private static func thumb(diameter: CGFloat) -> UIImage {
    let size = CGSize(width: diameter, height: diameter)
    return UIGraphicsImageRenderer(size: size).image { context in
      UIColor.white.setFill()
      context.cgContext.setShadow(offset: CGSize(width: 0, height: 1), blur: 2, color: UIColor.black.withAlphaComponent(0.3).cgColor)
      context.cgContext.fillEllipse(in: CGRect(origin: .zero, size: size).insetBy(dx: 1.5, dy: 1.5))
    }
  }
}
