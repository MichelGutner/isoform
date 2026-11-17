import UIKit

/// Events of the modal, sent to the Fabric shell (`IsoModalView.mm`) and from there to JS.
@objc public protocol IsoModalHostDelegate: AnyObject {
  /// The content area: the card's width and tallest height (dialog), or the safe area (full screen).
  func modalDidLayout(width: Double, height: Double)
  /// The user closed it (backdrop tap, VoiceOver escape gesture).
  func modalDidDismiss()
  /// The closing animation ended.
  func modalDidClose()
}

/// Space kept around a dialog (the same as `DIALOG_MARGIN` in JS).
private let dialogMargin: CGFloat = 24
/// Default dialog corner radius (`DIALOG_RADIUS` in JS).
private let dialogRadius: CGFloat = 20

/// Default card color: white, or the dark elevated gray in dark mode (the same as Android).
private let defaultSurface = UIColor { traits in
  traits.userInterfaceStyle == .dark ? UIColor(red: 0x1C / 255, green: 0x1C / 255, blue: 0x1E / 255, alpha: 1) : .white
}

/// Props of one modal, set by the Fabric shell.
struct IsoModalConfig: Equatable {
  var presentation = "dialog"
  var animation = "scale"
  var dismissible = true
  var backdrop = UIColor(white: 0, alpha: 0.4)
  var surface: UIColor?
  var cornerRadius: CGFloat = -1
  var maxWidth: CGFloat = 420
  var contentHeight: CGFloat = 0

  var isDialog: Bool { presentation != "fullScreen" }
}

/**
 What the modal draws, inside its own view (which JS puts in a transparent React Native
 `Modal`, like on Android: that window already routes touches and the keyboard to React
 Native views): a backdrop, the card (shadow + clipped surface) and the React children
 inside it. It lays the card out (centered dialog or full screen, above the keyboard),
 runs the enter/exit animations and reports the content area.
 */
final class IsoModalStage: UIView {
  let content: UIView
  var config = IsoModalConfig() {
    didSet { if config != oldValue { apply() } }
  }
  var onLayout: ((CGSize) -> Void)?
  var onDismiss: (() -> Void)?

  private let backdrop = UIView()
  /// Carries the shadow (it cannot clip).
  private let shell = UIView()
  /// Clips the content to the corners.
  private let surface = UIView()
  private var keyboard: CGFloat = 0
  private var reported = CGSize.zero
  private(set) var shown = false
  private(set) var closing = false

  init(content: UIView) {
    self.content = content
    super.init(frame: .zero)
    backgroundColor = .clear
    backdrop.alpha = 0
    backdrop.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(backdropTapped)))
    addSubview(backdrop)
    shell.addSubview(surface)
    surface.addSubview(content)
    surface.clipsToBounds = true
    surface.layer.cornerCurve = .continuous
    shell.accessibilityViewIsModal = true
    shell.alpha = 0
    addSubview(shell)
    NotificationCenter.default.addObserver(self, selector: #selector(keyboardChanged(_:)), name: UIResponder.keyboardWillChangeFrameNotification, object: nil)
    NotificationCenter.default.addObserver(self, selector: #selector(keyboardChanged(_:)), name: UIResponder.keyboardWillHideNotification, object: nil)
    apply()
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

  /// Colors, corners and shadow from `config`.
  private func apply() {
    backdrop.backgroundColor = config.isDialog ? config.backdrop : .clear
    surface.backgroundColor = config.surface ?? defaultSurface
    surface.layer.cornerRadius = config.isDialog ? (config.cornerRadius >= 0 ? config.cornerRadius : dialogRadius) : 0
    shell.layer.shadowColor = UIColor.black.cgColor
    shell.layer.shadowOpacity = config.isDialog ? 0.18 : 0
    shell.layer.shadowRadius = 24
    shell.layer.shadowOffset = CGSize(width: 0, height: 8)
    setNeedsLayout()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    layoutCard()
  }

  override func safeAreaInsetsDidChange() {
    super.safeAreaInsetsDidChange()
    setNeedsLayout()
  }

  private func layoutCard() {
    guard bounds.width > 0, bounds.height > 0 else { return }
    let safe = safeAreaInsets
    let bottom = max(safe.bottom, keyboard)
    backdrop.frame = bounds
    // the transform of an animation must not distort the frames
    let transform = shell.transform
    shell.transform = .identity
    defer { shell.transform = transform }

    if config.isDialog {
      let width = max(0, min(bounds.width - safe.left - safe.right - 2 * dialogMargin, config.maxWidth))
      let tallest = max(0, bounds.height - safe.top - bottom - 2 * dialogMargin)
      let height = config.contentHeight > 0 ? min(config.contentHeight, tallest) : tallest
      let top = safe.top + (bounds.height - safe.top - bottom - height) / 2
      shell.frame = CGRect(x: (bounds.width - width) / 2, y: top, width: width, height: height)
      surface.frame = shell.bounds
      content.frame = surface.bounds
      shell.layer.shadowPath = UIBezierPath(roundedRect: shell.bounds, cornerRadius: surface.layer.cornerRadius).cgPath
      report(CGSize(width: width, height: tallest))
    } else {
      shell.frame = bounds
      surface.frame = bounds
      content.frame = CGRect(x: safe.left, y: safe.top, width: bounds.width - safe.left - safe.right, height: bounds.height - safe.top - bottom)
      shell.layer.shadowPath = nil
      report(content.frame.size)
    }
  }

  private func report(_ size: CGSize) {
    guard size.width > 0, size.height > 0, abs(size.width - reported.width) > 0.5 || abs(size.height - reported.height) > 0.5 else { return }
    reported = size
    onLayout?(size)
  }

  // MARK: - Animations

  /// Where the card starts (and ends when closing) for each animation.
  private func hiddenState() -> (CGAffineTransform, CGFloat) {
    let states: [String: (CGAffineTransform, CGFloat)] = [
      "scale": (CGAffineTransform(scaleX: 0.92, y: 0.92), 0),
      "slide": (CGAffineTransform(translationX: 0, y: bounds.height), 1),
      "fade": (.identity, 0),
    ]
    return states[config.animation] ?? (.identity, 0)
  }

  private var instant: Bool { config.animation == "none" || UIAccessibility.isReduceMotionEnabled }

  func animateIn() {
    shown = true
    closing = false
    layoutIfNeeded()
    let (transform, alpha) = hiddenState()
    shell.transform = transform
    shell.alpha = alpha
    guard !instant else {
      shell.transform = .identity
      shell.alpha = 1
      backdrop.alpha = 1
      return focusContent()
    }
    UIView.animate(withDuration: 0.42, delay: 0, usingSpringWithDamping: 0.86, initialSpringVelocity: 0, options: [.allowUserInteraction]) {
      self.shell.transform = .identity
      self.shell.alpha = 1
    } completion: { _ in self.focusContent() }
    UIView.animate(withDuration: 0.25) { self.backdrop.alpha = 1 }
  }

  func animateOut(completion: @escaping () -> Void) {
    guard shown, !closing else { return }
    closing = true
    endEditing(true)
    let (transform, alpha) = hiddenState()
    let done = { [self] in
      shown = false
      closing = false
      completion()
    }
    guard !instant else {
      shell.transform = transform
      shell.alpha = alpha
      backdrop.alpha = 0
      return done()
    }
    UIView.animate(withDuration: 0.22, delay: 0, options: [.curveEaseIn, .beginFromCurrentState]) {
      self.shell.transform = transform
      self.shell.alpha = alpha
      self.backdrop.alpha = 0
    } completion: { _ in done() }
  }

  /// Gone at once (the view left the window).
  func hide() {
    shown = false
    closing = false
    shell.alpha = 0
    backdrop.alpha = 0
  }

  private func focusContent() {
    UIAccessibility.post(notification: .screenChanged, argument: shell)
  }

  // MARK: - Dismissal and keyboard

  @objc private func backdropTapped() {
    if config.dismissible, shown, !closing { onDismiss?() }
  }

  override func accessibilityPerformEscape() -> Bool {
    guard config.dismissible, shown, !closing else { return false }
    onDismiss?()
    return true
  }

  @objc private func keyboardChanged(_ note: Notification) {
    guard let window, let end = (note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?.cgRectValue else { return }
    let frame = convert(end, from: window.screen.coordinateSpace)
    keyboard = note.name == UIResponder.keyboardWillHideNotification ? 0 : max(0, bounds.maxY - frame.minY)
    let duration = note.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double ?? 0.25
    UIView.animate(withDuration: duration, delay: 0, options: [.beginFromCurrentState, .allowUserInteraction]) {
      self.layoutCard()
    }
  }
}

/// Bridge for the Fabric shell: owns the stage (the view Fabric shows) and the content view.
@objc public final class IsoModalHost: NSObject {
  @objc public weak var delegate: IsoModalHostDelegate?

  /// Where Fabric mounts the React children.
  @objc public let contentView = UIView()

  private let stage: IsoModalStage
  private var config = IsoModalConfig()
  private var open = false
  private var attached = false

  /// The view Fabric shows (its `contentView`): backdrop, card and children.
  @objc public var view: UIView { stage }

  @objc public override init() {
    stage = IsoModalStage(content: contentView)
    super.init()
    contentView.backgroundColor = .clear
    stage.onLayout = { [weak self] size in self?.delegate?.modalDidLayout(width: Double(size.width), height: Double(size.height)) }
    stage.onDismiss = { [weak self] in self?.delegate?.modalDidDismiss() }
  }

  @objc public func setPresentation(_ presentation: String, animation: String, dismissible: Bool) {
    config.presentation = presentation
    config.animation = animation
    config.dismissible = dismissible
  }

  @objc public func setColors(backdrop: UIColor?, surface: UIColor?, cornerRadius: Double) {
    config.backdrop = backdrop ?? UIColor(white: 0, alpha: 0.4)
    config.surface = surface
    config.cornerRadius = CGFloat(cornerRadius)
  }

  @objc public func setSize(maxWidth: Double, contentHeight: Double) {
    config.maxWidth = CGFloat(maxWidth)
    config.contentHeight = CGFloat(contentHeight)
  }

  @objc public func setOpen(_ value: Bool) {
    open = value
    sync()
  }

  @objc public func setAttached(_ value: Bool) {
    attached = value
    if !value { stage.hide() }
    sync()
  }

  /// Shows, updates or hides the card to match the props.
  private func sync() {
    stage.config = config
    // a dialog opens once its content was measured, at the right height
    let ready = !config.isDialog || config.contentHeight > 0
    let wanted = open && attached && ready
    if wanted, !stage.shown {
      stage.animateIn()
    } else if !open, stage.shown {
      stage.animateOut { [weak self] in
        guard let self else { return }
        // opened again while it was closing: show it again instead
        if self.open { return self.sync() }
        self.delegate?.modalDidClose()
      }
    }
  }
}
