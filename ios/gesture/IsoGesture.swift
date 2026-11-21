import UIKit

/// What the gesture view sends to JS (through the Fabric shell, `IsoGestureView.mm`).
/// `state`: 0 start, 1 move, 2 end, 3 cancel. Distances in points, speeds per second.
@objc public protocol IsoGestureHostDelegate: AnyObject {
  func gesturePan(state: Int, translationX: Double, translationY: Double, velocityX: Double, velocityY: Double, x: Double, y: Double)
  func gesturePinch(state: Int, scale: Double, velocity: Double, focalX: Double, focalY: Double)
  func gestureRotate(state: Int, rotation: Double, velocity: Double)
  /// `kind`: 0 double tap, 1 long press.
  func gestureTap(kind: Int, x: Double, y: Double)
}

/// UIKit recognizers attached to a React Native view. Each one is off until
/// `configure` turns it on. Pan, pinch and rotation run together (move while
/// pinching); a pan limited to one axis only starts on a movement along it, so a
/// parent scroll view keeps the other axis.
@objc public final class IsoGestureHost: NSObject, UIGestureRecognizerDelegate {
  @objc public weak var delegate: IsoGestureHostDelegate?

  private weak var view: UIView?
  private let pan = UIPanGestureRecognizer()
  private let pinch = UIPinchGestureRecognizer()
  private let rotation = UIRotationGestureRecognizer()
  private let doubleTap = UITapGestureRecognizer()
  private let longPress = UILongPressGestureRecognizer()
  private var axis = "none"
  private var simultaneous = true

  /// Recognizer states → the `state` codes JS understands (`possible` sends nothing).
  private static let codes: [UIGestureRecognizer.State: Int] = [
    .began: 0, .changed: 1, .ended: 2, .cancelled: 3, .failed: 3,
  ]

  private var all: [UIGestureRecognizer] { [pan, pinch, rotation, doubleTap, longPress] }

  @objc public init(view: UIView) {
    super.init()
    self.view = view
    pan.addTarget(self, action: #selector(handlePan(_:)))
    pinch.addTarget(self, action: #selector(handlePinch(_:)))
    rotation.addTarget(self, action: #selector(handleRotation(_:)))
    doubleTap.addTarget(self, action: #selector(handleDoubleTap(_:)))
    longPress.addTarget(self, action: #selector(handleLongPress(_:)))
    doubleTap.numberOfTapsRequired = 2
    // taps must not take the touches away from Pressables inside the view
    doubleTap.cancelsTouchesInView = false
    longPress.cancelsTouchesInView = false
    for recognizer in all {
      recognizer.delegate = self
      recognizer.isEnabled = false
      view.addGestureRecognizer(recognizer)
    }
  }

  /// Turns each recognizer on or off (`panAxis`: `none`, `x`, `y` or `both`).
  @objc public func configure(panAxis: String, pinch pinchOn: Bool, rotate rotateOn: Bool, doubleTap doubleTapOn: Bool, longPress longPressOn: Bool, longPressDuration: Double, simultaneous together: Bool) {
    axis = panAxis
    simultaneous = together
    pan.isEnabled = panAxis != "none"
    pinch.isEnabled = pinchOn
    rotation.isEnabled = rotateOn
    doubleTap.isEnabled = doubleTapOn
    longPress.isEnabled = longPressOn
    longPress.minimumPressDuration = max(0, longPressDuration) / 1000
  }

  /// Everything off (the view is about to be recycled).
  @objc public func reset() {
    for recognizer in all { recognizer.isEnabled = false }
  }

  // MARK: - Delegate

  public func gestureRecognizerShouldBegin(_ recognizer: UIGestureRecognizer) -> Bool {
    guard recognizer === pan, let view else { return true }
    // the distance moved so far says the direction better than the speed at this instant (often near zero)
    let space = view.superview ?? view
    let moved = pan.translation(in: space)
    let direction = moved == .zero ? pan.velocity(in: space) : moved
    return IsoGestureHost.movesAlong(axis, dx: direction.x, dy: direction.y)
  }

  /// The element's own recognizers run together, except the pan with pinch/rotation when `simultaneous` is off.
  public func gestureRecognizer(_ recognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
    guard all.contains(where: { $0 === other }) else { return false }
    let twoFingers: [UIGestureRecognizer] = [pinch, rotation]
    let panWithTwoFingers =
      (recognizer === pan && twoFingers.contains { $0 === other }) || (other === pan && twoFingers.contains { $0 === recognizer })
    return simultaneous || !panWithTwoFingers
  }

  /// Pans around the element wait for its pan: a parent scroll view (it scrolls only when the pan fails, a move
  /// along the other axis with `axis` `x` or `y`) and a parent element with `.gesture()` (the innermost wins).
  /// Without this rule the pans race for the same touch.
  public func gestureRecognizer(_ recognizer: UIGestureRecognizer, shouldBeRequiredToFailBy other: UIGestureRecognizer) -> Bool {
    guard recognizer === pan, let view, let otherView = other.view, otherView !== view, view.isDescendant(of: otherView) else { return false }
    if let scrollView = otherView as? UIScrollView { return other === scrollView.panGestureRecognizer }
    return other is UIPanGestureRecognizer && other.delegate is IsoGestureHost
  }

  /// Plays a device tap: 0 light (snap, bounds), 1 medium (swipe, long press).
  @objc public func haptic(kind: Int) {
    let style: UIImpactFeedbackGenerator.FeedbackStyle = kind == 0 ? .light : .medium
    UIImpactFeedbackGenerator(style: style).impactOccurred()
  }

  private static func movesAlong(_ axis: String, dx: CGFloat, dy: CGFloat) -> Bool {
    let along: [String: Bool] = ["x": abs(dx) > abs(dy), "y": abs(dy) > abs(dx)]
    return along[axis] ?? true
  }

  // MARK: - Handlers

  @objc private func handlePan(_ recognizer: UIPanGestureRecognizer) {
    guard let view, let code = start(recognizer) else { return }
    let space = view.superview ?? view
    let translation = recognizer.translation(in: space)
    let velocity = recognizer.velocity(in: space)
    let point = recognizer.location(in: view)
    delegate?.gesturePan(
      state: code, translationX: translation.x, translationY: translation.y,
      velocityX: velocity.x, velocityY: velocity.y, x: point.x, y: point.y)
  }

  @objc private func handlePinch(_ recognizer: UIPinchGestureRecognizer) {
    guard let view, let code = start(recognizer) else { return }
    let focal = recognizer.location(in: view)
    delegate?.gesturePinch(state: code, scale: recognizer.scale, velocity: recognizer.velocity, focalX: focal.x, focalY: focal.y)
  }

  @objc private func handleRotation(_ recognizer: UIRotationGestureRecognizer) {
    guard let code = start(recognizer) else { return }
    delegate?.gestureRotate(state: code, rotation: recognizer.rotation, velocity: recognizer.velocity)
  }

  @objc private func handleDoubleTap(_ recognizer: UITapGestureRecognizer) {
    guard recognizer.state == .ended, let view else { return }
    let point = recognizer.location(in: view)
    delegate?.gestureTap(kind: 0, x: point.x, y: point.y)
  }

  @objc private func handleLongPress(_ recognizer: UILongPressGestureRecognizer) {
    guard recognizer.state == .began, let view else { return }
    let point = recognizer.location(in: view)
    delegate?.gestureTap(kind: 1, x: point.x, y: point.y)
  }

  /// The state code of a continuous gesture; at its start, React Native's own touch
  /// is cancelled so a Pressable inside does not also fire.
  private func start(_ recognizer: UIGestureRecognizer) -> Int? {
    guard let code = IsoGestureHost.codes[recognizer.state] else { return nil }
    if code == 0 { cancelReactTouches() }
    return code
  }

  /// React Native's touch handler is a recognizer on the surface's root view. It is
  /// not prevented by recognizers inside the surface, so turning it off and on is
  /// what cancels its touch (JS gets `touchcancel`).
  private func cancelReactTouches() {
    guard let handlerClass = NSClassFromString("RCTSurfaceTouchHandler") else { return }
    var current = view?.superview
    while let ancestor = current {
      for recognizer in ancestor.gestureRecognizers ?? [] where recognizer.isKind(of: handlerClass) && recognizer.isEnabled {
        recognizer.isEnabled = false
        recognizer.isEnabled = true
      }
      current = ancestor.superview
    }
  }
}
