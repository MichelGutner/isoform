import ObjectiveC
import UIKit

/// Fullscreen of the iOS `Video`, with the same feel as Apple's player:
///  · opening: the video grows from where it is on the page to the whole screen
///    (spring), over a black backdrop that fades in; from then on the screen follows
///    the device (portrait or landscape, either side), even in a portrait-only app;
///  · closing (button or `setFullscreen(false)`): it shrinks back to its place;
///  · swipe down: the video follows the finger and shrinks, the backdrop fades;
///    released far enough (or fast) it closes, otherwise it springs back.
/// The player's own view moves (not a copy), so playback never stops.
final class IsoVideoFullscreen: NSObject, UIViewControllerTransitioningDelegate {
  /// Called when the fullscreen finished closing (by the button, the swipe or the system).
  var onClosed: () -> Void = {}

  private weak var content: UIView?
  private weak var home: UIView?
  private let controller = IsoFullscreenController()
  private var landscape = false

  var isPresented: Bool { controller.presentingViewController != nil }

  /// Shows `content` (taken out of `home`) over the whole screen.
  func present(_ content: UIView, from home: UIView, landscape: Bool, presenter: UIViewController) {
    guard !isPresented else { return }
    IsoOrientation.install()
    IsoOrientation.fullscreen = true
    self.content = content
    self.home = home
    self.landscape = landscape
    controller.wantsLandscape = landscape
    controller.modalPresentationStyle = .custom
    controller.transitioningDelegate = self
    controller.modalPresentationCapturesStatusBarAppearance = true
    controller.onSwipeClose = { [weak self] in self?.dismiss() }
    presenter.present(controller, animated: true) { [weak self] in
      self?.controller.followDevice()
    }
  }

  /// Puts the video back in its place, turning the screen back to portrait first if needed.
  func dismiss() {
    guard isPresented else { return }
    let turned = controller.view.bounds.width > controller.view.bounds.height
    guard turned else { return close() }
    // back to portrait first, then the video shrinks to its place
    controller.rotate(toLandscape: false)
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { [weak self] in self?.close() }
  }

  private func close() {
    controller.dismiss(animated: true) { [weak self] in
      IsoOrientation.fullscreen = false
      self?.onClosed()
    }
  }

  // MARK: - Transitions

  /// A full-screen presentation: the fullscreen screen (not the page under it) decides the orientation.
  func presentationController(forPresented presented: UIViewController, presenting: UIViewController?, source: UIViewController) -> UIPresentationController? {
    IsoFullscreenPresentation(presentedViewController: presented, presenting: presenting)
  }

  func animationController(forPresented presented: UIViewController, presenting: UIViewController, source: UIViewController) -> UIViewControllerAnimatedTransitioning? {
    IsoZoomAnimator(opening: true, content: content, home: home)
  }

  func animationController(forDismissed dismissed: UIViewController) -> UIViewControllerAnimatedTransitioning? {
    IsoZoomAnimator(opening: false, content: content, home: home)
  }
}

/// Presents like `.fullScreen` (the screen under it leaves the window), so the system
/// takes the supported orientations from the fullscreen screen.
final class IsoFullscreenPresentation: UIPresentationController {
  override var shouldRemovePresentersView: Bool { true }
}

/**
 * Lets the app turn to landscape while a video is in fullscreen, even when the app
 * is portrait-only (Expo's `"orientation": "portrait"`, or the Info.plist). It wraps
 * the app delegate's `application(_:supportedInterfaceOrientationsFor:)` once: in
 * fullscreen it answers portrait + landscape; otherwise it answers what the app did.
 */
enum IsoOrientation {
  /// Whether a video fullscreen is open (set by `IsoVideoFullscreen`).
  static var fullscreen = false
  private static var installed = false

  static func install() {
    guard !installed, let delegate = UIApplication.shared.delegate else { return }
    installed = true
    let type: AnyClass = Swift.type(of: delegate)
    let selector = #selector(UIApplicationDelegate.application(_:supportedInterfaceOrientationsFor:))
    typealias Answer = @convention(c) (AnyObject, Selector, UIApplication, UIWindow?) -> UInt
    let method = class_getInstanceMethod(type, selector)
    let original = method.map { unsafeBitCast(method_getImplementation($0), to: Answer.self) }
    let wrapper: @convention(block) (AnyObject, UIApplication, UIWindow?) -> UInt = { app, application, window in
      guard !fullscreen else { return UIInterfaceOrientationMask.allButUpsideDown.rawValue }
      return original?(app, selector, application, window) ?? infoPlistMask().rawValue
    }
    let implementation = imp_implementationWithBlock(wrapper)
    // the method exists (Expo, most apps): replace it; otherwise add it ("Q@:@@" = mask (self, _cmd, app, window))
    guard let method else {
      class_addMethod(type, selector, implementation, "Q@:@@")
      return
    }
    method_setImplementation(method, implementation)
  }

  /// The orientations listed in the app's Info.plist (what the system uses without the delegate method).
  private static func infoPlistMask() -> UIInterfaceOrientationMask {
    let names = Bundle.main.object(forInfoDictionaryKey: "UISupportedInterfaceOrientations") as? [String] ?? []
    let masks: [String: UIInterfaceOrientationMask] = [
      "UIInterfaceOrientationPortrait": .portrait,
      "UIInterfaceOrientationPortraitUpsideDown": .portraitUpsideDown,
      "UIInterfaceOrientationLandscapeLeft": .landscapeLeft,
      "UIInterfaceOrientationLandscapeRight": .landscapeRight,
    ]
    return names.compactMap { masks[$0] }.reduce(into: []) { $0.formUnion($1) }
  }
}

/// The screen that holds the video in fullscreen: black, no status bar, the home
/// indicator hides itself, and it can turn to landscape. Swiping down closes it.
final class IsoFullscreenController: UIViewController {
  var wantsLandscape = false
  var onSwipeClose: () -> Void = {}
  private let backdrop = UIView()
  private var allowLandscape = false

  override func viewDidLoad() {
    super.viewDidLoad()
    // same look as inline: the video controls are dark whatever the app's appearance
    overrideUserInterfaceStyle = .dark
    view.tintAdjustmentMode = .normal
    view.backgroundColor = .clear
    backdrop.backgroundColor = .black
    backdrop.frame = view.bounds
    backdrop.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    view.addSubview(backdrop)
    let pan = UIPanGestureRecognizer(target: self, action: #selector(panned(_:)))
    pan.delegate = self
    view.addGestureRecognizer(pan)
  }

  override var prefersStatusBarHidden: Bool { true }
  override var prefersHomeIndicatorAutoHidden: Bool { true }
  override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
    allowLandscape ? .allButUpsideDown : .portrait
  }

  /// Black behind the video (the animator fades it).
  var backdropAlpha: CGFloat {
    get { backdrop.alpha }
    set { backdrop.alpha = newValue }
  }

  /// Lets the screen follow the device: the system turns it to how the phone is held now,
  /// and keeps turning with it (portrait, and landscape to either side).
  func followDevice() {
    allowLandscape = true
    refreshOrientations()
  }

  /// Back to portrait (before the video returns to its place on a portrait page).
  func rotate(toLandscape value: Bool) {
    allowLandscape = value
    refreshOrientations()
    guard #available(iOS 16.0, *), let scene = view.window?.windowScene, !value else { return }
    scene.requestGeometryUpdate(.iOS(interfaceOrientations: .portrait)) { _ in }
  }

  /// Asks the system to read the supported orientations again (and rotate to the device if allowed).
  private func refreshOrientations() {
    guard #available(iOS 16.0, *) else { return UIViewController.attemptRotationToDeviceOrientation() }
    setNeedsUpdateOfSupportedInterfaceOrientations()
    view.window?.windowScene?.windows.first { $0.isKeyWindow }?.rootViewController?.setNeedsUpdateOfSupportedInterfaceOrientations()
  }

  // MARK: - Swipe down to close

  private var video: UIView? { view.subviews.last { $0 !== backdrop } }

  @objc private func panned(_ pan: UIPanGestureRecognizer) {
    guard let video else { return }
    let drag = pan.translation(in: view)
    let progress = min(1, max(0, drag.y / max(view.bounds.height, 1)))
    let handlers: [UIGestureRecognizer.State: () -> Void] = [
      .changed: {
        let scale = 1 - progress * 0.45
        video.transform = CGAffineTransform(translationX: drag.x * 0.6, y: max(0, drag.y)).scaledBy(x: scale, y: scale)
        self.backdrop.alpha = 1 - progress * 1.3
      },
      .ended: { self.finishSwipe(progress: progress, speed: pan.velocity(in: self.view).y) },
      .cancelled: { self.finishSwipe(progress: 0, speed: 0) },
    ]
    handlers[pan.state]?()
  }

  private func finishSwipe(progress: CGFloat, speed: CGFloat) {
    guard progress > 0.18 || speed > 900 else {
      return UIView.animate(withDuration: 0.4, delay: 0, usingSpringWithDamping: 0.82, initialSpringVelocity: 0) {
        self.video?.transform = .identity
        self.backdrop.alpha = 1
      }
    }
    onSwipeClose()
  }
}

extension IsoFullscreenController: UIGestureRecognizerDelegate {
  /// Only a mostly vertical drag downward closes (horizontal drags are the seek bar's).
  func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
    guard let pan = gestureRecognizer as? UIPanGestureRecognizer else { return true }
    let velocity = pan.velocity(in: view)
    return velocity.y > 0 && abs(velocity.y) > abs(velocity.x) * 1.5 && !(pan.view?.hitTest(pan.location(in: view), with: nil) is UIControl)
  }
}

/// Zoom from the video's place on the page to the whole screen (and back), like AVKit.
final class IsoZoomAnimator: NSObject, UIViewControllerAnimatedTransitioning {
  private let opening: Bool
  private weak var content: UIView?
  private weak var home: UIView?

  init(opening: Bool, content: UIView?, home: UIView?) {
    self.opening = opening
    self.content = content
    self.home = home
  }

  func transitionDuration(using transitionContext: UIViewControllerContextTransitioning?) -> TimeInterval { 0.42 }

  func animateTransition(using context: UIViewControllerContextTransitioning) {
    let container = context.containerView
    guard let content, let home else { return context.completeTransition(true) }
    let screen = context.viewController(forKey: opening ? .to : .from) as? IsoFullscreenController
    if opening, let toView = context.view(forKey: .to) {
      toView.frame = context.finalFrame(for: screen ?? UIViewController())
      container.addSubview(toView)
    }
    // full-screen presentation: closing, the page comes back under the video first
    if !opening, let page = context.view(forKey: .to), let presenter = context.viewController(forKey: .to) {
      page.frame = context.finalFrame(for: presenter)
      container.insertSubview(page, at: 0)
      page.layoutIfNeeded()
    }
    let place = home.convert(home.bounds, to: container)
    let full = container.bounds

    // the video itself travels: from its place (opening) or from where the swipe left it (closing).
    // If the page is not on screen (rare), the video just fades in its final place.
    let start = opening ? place : content.convert(content.bounds, to: container)
    content.transform = .identity
    content.removeFromSuperview()
    content.frame = start
    container.addSubview(content)
    content.layoutIfNeeded()
    screen?.backdropAlpha = opening ? 0 : (screen?.backdropAlpha ?? 1)

    let animations = {
      content.frame = self.opening ? full : place
      content.layoutIfNeeded()
      screen?.backdropAlpha = self.opening ? 1 : 0
    }
    UIView.animate(withDuration: transitionDuration(using: context), delay: 0, usingSpringWithDamping: 0.88, initialSpringVelocity: 0, options: [.curveEaseOut]) {
      animations()
    } completion: { _ in
      content.removeFromSuperview()
      let destination = self.opening ? screen?.view : home
      content.frame = destination?.bounds ?? .zero
      content.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      destination?.addSubview(content)
      if !self.opening { context.view(forKey: .from)?.removeFromSuperview() }
      context.completeTransition(!context.transitionWasCancelled)
    }
  }
}
