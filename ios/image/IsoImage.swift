import UIKit

/// Events of the image, sent to the Fabric shell (`IsoImageView.mm`) and from there to JS.
@objc public protocol IsoImageHostDelegate: AnyObject {
  func imageDidStart()
  func imageDidProgress(loaded: Double, total: Double)
  /// `cacheType`: `memory`, `disk` or `none`.
  func imageDidLoad(width: Double, height: Double, cacheType: String)
  func imageDidFail(message: String)
  /// Zoom, offset (points, from the centered position) and rotation (degrees).
  func imageDidZoom(scale: Double, x: Double, y: Double, rotation: Double)
}

/// The view's root: clips the picture to the view (and its corner radius) and reports its size.
final class IsoImageContainer: UIView {
  var onLayout: (() -> Void)?

  override func layoutSubviews() {
    super.layoutSubviews()
    onLayout?()
  }
}

/// Calls a closure on every screen refresh without retaining its owner.
private final class IsoDisplayTarget: NSObject {
  let tick: (CADisplayLink) -> Void
  init(_ tick: @escaping (CADisplayLink) -> Void) { self.tick = tick }
  @objc func step(_ link: CADisplayLink) { tick(link) }
}

/// Plays the frames of an animated picture with their own delays (UIKit's animated images use one delay for all).
final class IsoFramePlayer {
  weak var target: UIImageView?
  private var frames: [UIImage] = []
  private var delays: [Double] = []
  private var index = 0
  private var elapsed = 0.0
  private var last: CFTimeInterval = 0
  private var link: CADisplayLink?

  var isPlaying: Bool { link != nil }

  /// Shows the first frame, and plays when `play` (and there is more than one frame).
  func set(_ frames: [UIImage], delays: [Double], play: Bool) {
    stop()
    self.frames = frames
    self.delays = delays
    index = 0
    elapsed = 0
    target?.image = frames.first
    if play { start() }
  }

  func start() {
    guard link == nil, frames.count > 1 else { return }
    last = 0
    let link = CADisplayLink(target: IsoDisplayTarget { [weak self] link in self?.step(link) }, selector: #selector(IsoDisplayTarget.step(_:)))
    link.add(to: .main, forMode: .common)
    self.link = link
  }

  /// Stays on the current frame.
  func stop() {
    link?.invalidate()
    link = nil
  }

  private func step(_ link: CADisplayLink) {
    if last == 0 { last = link.timestamp }
    elapsed += link.timestamp - last
    last = link.timestamp
    var moved = false
    while elapsed >= delays[index] {
      elapsed -= delays[index]
      index = (index + 1) % frames.count
      moved = true
    }
    if moved { target?.image = frames[index] }
  }
}

/**
 The lib's image view: loads through `IsoImagePipeline`, draws the picture with
 `contentFit`/position (the same rule as `fitRect` in JS), crossfades from a blurhash or
 placeholder picture, tints, plays animations and handles the viewer gestures (pinch,
 drag while zoomed, double tap, rotation).
 */
@objc public final class IsoImageHost: NSObject, UIGestureRecognizerDelegate {
  @objc public weak var delegate: IsoImageHostDelegate?

  private let container = IsoImageContainer()
  /// Holds both pictures; zoom, offset and rotation transform it.
  private let canvas = UIView()
  private let placeholderView = UIImageView()
  private let imageView = UIImageView()
  private let player = IsoFramePlayer()

  /// The view Fabric shows (its `contentView`).
  @objc public var view: UIView { container }

  // props
  private var uri = ""
  private var cacheKey = ""
  private var headers: [String: String] = [:]
  private var placeholderUri = ""
  private var blurhash = ""
  private var fit = "cover"
  private var position = CGPoint(x: 0.5, y: 0.5)
  private var transition = 0.25
  private var tint: UIColor?
  private var blurRadius: CGFloat = 0
  private var cachePolicy = "memoryDisk"
  private var priority = "normal"
  private var autoplay = true
  private var zoomable = false
  private var maxZoom: CGFloat = 4
  private var doubleTapZoom: CGFloat = 2.5
  private var rotatable = false

  // state
  private var sourceChanged = false
  private var placeholderChanged = false
  private var decoded: IsoDecodedImage?
  private var placeholderImage: UIImage?
  private var ticket: IsoImageTicket?
  private var placeholderTicket: IsoImageTicket?
  private var attached = false
  private var scale: CGFloat = 1
  private var offset = CGPoint.zero
  private var rotation: CGFloat = 0

  private lazy var pinch = UIPinchGestureRecognizer(target: self, action: #selector(onPinch(_:)))
  private lazy var pan = UIPanGestureRecognizer(target: self, action: #selector(onPan(_:)))
  private lazy var doubleTap: UITapGestureRecognizer = {
    let tap = UITapGestureRecognizer(target: self, action: #selector(onDoubleTap(_:)))
    tap.numberOfTapsRequired = 2
    return tap
  }()
  private lazy var rotate = UIRotationGestureRecognizer(target: self, action: #selector(onRotate(_:)))

  @objc public override init() {
    super.init()
    container.clipsToBounds = true
    container.addSubview(canvas)
    [placeholderView, imageView].forEach {
      $0.contentMode = .scaleToFill
      $0.clipsToBounds = true
      canvas.addSubview($0)
    }
    player.target = imageView
    container.onLayout = { [weak self] in self?.layout() }
    [pinch, pan, doubleTap, rotate].forEach {
      $0.delegate = self
      $0.isEnabled = false
      container.addGestureRecognizer($0)
    }
  }

  // MARK: - Props (applied by `commit`)

  @objc public func setSource(_ uri: String, cacheKey: String, headers: [String]) {
    let next = IsoImageCache.headers(headers)
    guard uri != self.uri || cacheKey != self.cacheKey || next != self.headers else { return }
    self.uri = uri
    self.cacheKey = cacheKey
    self.headers = next
    sourceChanged = true
  }

  @objc public func setPlaceholder(_ uri: String, blurhash: String) {
    guard uri != placeholderUri || blurhash != self.blurhash else { return }
    placeholderUri = uri
    self.blurhash = blurhash
    placeholderChanged = true
  }

  @objc public func setFit(_ value: String, positionX: Double, positionY: Double) {
    fit = value
    position = CGPoint(x: positionX, y: positionY)
  }

  @objc public func setTransition(_ milliseconds: Double) { transition = max(0, milliseconds) / 1000 }

  @objc public func setTint(_ color: UIColor?) {
    guard color != tint else { return }
    tint = color
    showFrames(play: player.isPlaying)
  }

  @objc public func setBlurRadius(_ value: Double) {
    guard CGFloat(value) != blurRadius else { return }
    blurRadius = CGFloat(value)
    sourceChanged = true
  }

  @objc public func setCachePolicy(_ value: String, priority: String) {
    cachePolicy = value
    self.priority = priority
  }

  @objc public func setAutoplay(_ value: Bool) {
    guard value != autoplay else { return }
    autoplay = value
    value ? player.start() : player.stop()
  }

  @objc public func setZoom(_ zoomable: Bool, maxZoom: Double, doubleTapZoom: Double, rotatable: Bool) {
    self.zoomable = zoomable
    self.maxZoom = max(1, CGFloat(maxZoom))
    self.doubleTapZoom = max(1, CGFloat(doubleTapZoom))
    self.rotatable = rotatable
    pinch.isEnabled = zoomable
    pan.isEnabled = zoomable
    doubleTap.isEnabled = zoomable
    rotate.isEnabled = zoomable && rotatable
    if scale > self.maxZoom { zoom(to: self.maxZoom, focus: .zero, animated: false) }
  }

  @objc public func setCornerRadius(_ value: Double) {
    container.layer.cornerRadius = CGFloat(value)
    container.layer.cornerCurve = .continuous
  }

  /// Applies the props set since the last call (Fabric calls it once per update).
  @objc public func commit() {
    if placeholderChanged { loadPlaceholder() }
    if sourceChanged { load(reload: false) }
    layout()
  }

  // MARK: - Lifecycle

  @objc public func setAttached(_ value: Bool) {
    attached = value
    if value, autoplay {
      player.start()
    } else {
      player.stop()
    }
  }

  /// The view is recycled: drop everything.
  @objc public func reset() {
    ticket?.cancel()
    placeholderTicket?.cancel()
    ticket = nil
    placeholderTicket = nil
    decoded = nil
    placeholderImage = nil
    player.set([], delays: [], play: false)
    placeholderView.image = nil
    uri = ""
    cacheKey = ""
    placeholderUri = ""
    blurhash = ""
    scale = 1
    offset = .zero
    rotation = 0
    applyTransform()
  }

  // MARK: - Loading

  private func request(reload: Bool) -> IsoImageRequest {
    let priorities: [String: Float] = ["low": URLSessionTask.lowPriority, "high": URLSessionTask.highPriority]
    var request = IsoImageRequest(uri: uri)
    request.cacheKey = cacheKey
    request.headers = headers
    request.memory = cachePolicy == "memoryDisk" || cachePolicy == "memory"
    request.disk = cachePolicy == "memoryDisk" || cachePolicy == "disk"
    request.priority = priorities[priority] ?? URLSessionTask.defaultPriority
    request.viewSize = container.bounds.size
    request.fit = fit
    request.zoom = zoomable ? maxZoom : 1
    request.blurRadius = blurRadius
    request.reload = reload || cachePolicy == "none"
    return request
  }

  /// Starts loading `uri` (it waits for a size: the picture is decoded for it).
  private func load(reload: Bool) {
    guard container.bounds.width > 0, container.bounds.height > 0 else { return }
    sourceChanged = false
    ticket?.cancel()
    guard !uri.isEmpty else {
      clearImage()
      return
    }
    let request = request(reload: reload)
    // a sharper version of the same picture keeps the current one on screen meanwhile
    let samePicture = decoded != nil && !reload && sameKey
    if !samePicture { clearImage() }
    loadedKey = request.memoryKey
    if IsoImagePipeline.shared.cached(request) == nil { delegate?.imageDidStart() }
    ticket = IsoImagePipeline.shared.load(
      request,
      progress: { [weak self] loaded, total in self?.delegate?.imageDidProgress(loaded: Double(loaded), total: Double(total)) },
      completion: { [weak self] result in
        guard let self else { return }
        self.ticket = nil
        switch result {
        case .success(let (image, cacheType)): self.show(image, cacheType: cacheType, fade: !samePicture)
        case .failure(let error): self.delegate?.imageDidFail(message: error.localizedDescription)
        }
      }
    )
  }

  /// Key of the picture on screen (to tell a sharper version of it from another picture).
  private var loadedKey = ""
  private var sameKey: Bool { loadedKey == request(reload: false).memoryKey }

  private func clearImage() {
    decoded = nil
    player.set([], delays: [], play: false)
    imageView.alpha = 0
    placeholderView.alpha = 1
  }

  private func show(_ image: IsoDecodedImage, cacheType: IsoCacheType, fade: Bool) {
    decoded = image
    showFrames(play: autoplay && attached)
    layout()
    let reveal = { [self] in
      imageView.alpha = 1
      placeholderView.alpha = 0
    }
    if fade, cacheType != .memory, transition > 0 {
      UIView.animate(withDuration: transition, delay: 0, options: [.curveEaseOut, .allowUserInteraction, .beginFromCurrentState], animations: reveal)
    } else {
      reveal()
    }
    delegate?.imageDidLoad(width: Double(image.pixelWidth), height: Double(image.pixelHeight), cacheType: cacheType.rawValue)
  }

  /// Puts the frames in the image view (tinted when there is a tint color).
  private func showFrames(play: Bool) {
    guard let decoded else { return }
    let frames = tint == nil ? decoded.frames : decoded.frames.map { $0.withRenderingMode(.alwaysTemplate) }
    imageView.tintColor = tint
    player.set(frames, delays: decoded.delays, play: play)
  }

  private func loadPlaceholder() {
    placeholderChanged = false
    placeholderTicket?.cancel()
    placeholderTicket = nil
    if !blurhash.isEmpty {
      setPlaceholderImage(IsoBlurhash.image(blurhash))
      return
    }
    setPlaceholderImage(nil)
    guard !placeholderUri.isEmpty else { return }
    var request = IsoImageRequest(uri: placeholderUri)
    request.priority = URLSessionTask.highPriority
    placeholderTicket = IsoImagePipeline.shared.load(request) { [weak self] result in
      guard let self else { return }
      self.placeholderTicket = nil
      if case .success(let (image, _)) = result { self.setPlaceholderImage(image.frames.first) }
    }
  }

  private func setPlaceholderImage(_ image: UIImage?) {
    placeholderImage = image
    placeholderView.image = image
    layout()
  }

  // MARK: - Layout

  private func layout() {
    let box = container.bounds.size
    guard box.width > 0, box.height > 0 else { return }
    canvas.transform = .identity
    canvas.frame = CGRect(origin: .zero, size: box)
    if let decoded {
      imageView.frame = Self.fitRect(fit, position, box, decoded.pointSize)
    }
    if let placeholderImage {
      // a blurhash has no real size: it covers the box
      placeholderView.frame = blurhash.isEmpty ? Self.fitRect(fit, position, box, placeholderImage.size) : Self.fitRect("cover", CGPoint(x: 0.5, y: 0.5), box, placeholderImage.size)
    }
    applyTransform()
    // the first size, or a size the decoded picture is too small for
    if sourceChanged {
      load(reload: false)
    } else if let decoded, ticket == nil {
      let need = IsoImagePipeline.neededLongSide(decoded.pixelWidth, decoded.pixelHeight, request(reload: false))
      if !decoded.covers(need) { load(reload: false) }
    }
  }

  /// Where the picture is drawn in the box (the same rule as `fitRect` in `src/core/image.ts`).
  static func fitRect(_ fit: String, _ position: CGPoint, _ box: CGSize, _ image: CGSize) -> CGRect {
    guard image.width > 0, image.height > 0 else { return CGRect(origin: .zero, size: box) }
    if fit == "fill" { return CGRect(origin: .zero, size: box) }
    let scaleX = box.width / image.width
    let scaleY = box.height / image.height
    let scales: [String: CGFloat] = ["contain": min(scaleX, scaleY), "none": 1, "scaleDown": min(1, scaleX, scaleY)]
    let scale = scales[fit] ?? max(scaleX, scaleY)
    let size = CGSize(width: image.width * scale, height: image.height * scale)
    return CGRect(x: (box.width - size.width) * position.x, y: (box.height - size.height) * position.y, width: size.width, height: size.height)
  }

  // MARK: - Zoom

  private func applyTransform() {
    canvas.transform = CGAffineTransform(translationX: offset.x, y: offset.y).rotated(by: rotation).scaledBy(x: scale, y: scale)
  }

  /// Largest offset on each axis: the part of the zoomed (and rotated) canvas that overflows the box.
  private func offsetLimit(scale: CGFloat, rotation: CGFloat) -> CGPoint {
    let box = container.bounds.size
    let cosine = abs(cos(rotation))
    let sine = abs(sin(rotation))
    let width = (box.width * cosine + box.height * sine) * scale
    let height = (box.width * sine + box.height * cosine) * scale
    return CGPoint(x: max(0, (width - box.width) / 2), y: max(0, (height - box.height) / 2))
  }

  private func clamped(_ point: CGPoint, scale: CGFloat, rotation: CGFloat) -> CGPoint {
    let limit = offsetLimit(scale: scale, rotation: rotation)
    return CGPoint(x: max(-limit.x, min(limit.x, point.x)), y: max(-limit.y, min(limit.y, point.y)))
  }

  private func emitZoom() {
    delegate?.imageDidZoom(scale: Double(scale), x: Double(offset.x), y: Double(offset.y), rotation: Double(rotation * 180 / .pi))
  }

  private func animate(_ changes: @escaping () -> Void) {
    UIView.animate(withDuration: 0.35, delay: 0, usingSpringWithDamping: 0.9, initialSpringVelocity: 0, options: [.allowUserInteraction, .beginFromCurrentState]) {
      changes()
      self.applyTransform()
    }
  }

  /// Zooms keeping `focus` (from the box's center) still.
  private func zoom(to target: CGFloat, focus: CGPoint, animated: Bool) {
    let next = max(1, min(maxZoom, target))
    let moved = CGPoint(x: focus.x - (focus.x - offset.x) * next / scale, y: focus.y - (focus.y - offset.y) * next / scale)
    let change = { [self] in
      offset = clamped(moved, scale: next, rotation: rotation)
      scale = next
    }
    animated ? animate(change) : { change(); applyTransform() }()
    emitZoom()
  }

  private func center(of gesture: UIGestureRecognizer) -> CGPoint {
    let point = gesture.location(in: container)
    return CGPoint(x: point.x - container.bounds.midX, y: point.y - container.bounds.midY)
  }

  private var pinchFocus = CGPoint.zero

  @objc private func onPinch(_ gesture: UIPinchGestureRecognizer) {
    let focus = center(of: gesture)
    switch gesture.state {
    case .began:
      pinchFocus = focus
    case .changed:
      // a little past the limits while pinching (it springs back on release)
      let next = max(0.8, min(maxZoom * 1.2, scale * gesture.scale))
      gesture.scale = 1
      offset = CGPoint(
        x: focus.x - (pinchFocus.x - offset.x) * next / scale,
        y: focus.y - (pinchFocus.y - offset.y) * next / scale
      )
      scale = next
      pinchFocus = focus
      applyTransform()
      emitZoom()
    case .ended, .cancelled, .failed:
      zoom(to: scale, focus: focus, animated: true)
    default:
      break
    }
  }

  @objc private func onPan(_ gesture: UIPanGestureRecognizer) {
    let delta = gesture.translation(in: container)
    gesture.setTranslation(.zero, in: container)
    switch gesture.state {
    case .changed:
      offset = clamped(CGPoint(x: offset.x + delta.x, y: offset.y + delta.y), scale: scale, rotation: rotation)
      applyTransform()
      emitZoom()
    case .ended:
      // keeps gliding a little, like a scroll view
      let velocity = gesture.velocity(in: container)
      let target = clamped(CGPoint(x: offset.x + velocity.x * 0.12, y: offset.y + velocity.y * 0.12), scale: scale, rotation: rotation)
      animate { self.offset = target }
      emitZoom()
    default:
      break
    }
  }

  @objc private func onDoubleTap(_ gesture: UITapGestureRecognizer) {
    if scale > 1.01 {
      resetZoom(animated: true)
    } else {
      zoom(to: doubleTapZoom, focus: center(of: gesture), animated: true)
    }
  }

  @objc private func onRotate(_ gesture: UIRotationGestureRecognizer) {
    switch gesture.state {
    case .changed:
      rotation += gesture.rotation
      gesture.rotation = 0
      applyTransform()
      emitZoom()
    case .ended, .cancelled, .failed:
      rotate(to: (rotation / (.pi / 2)).rounded() * (.pi / 2), animated: true)
    default:
      break
    }
  }

  private func rotate(to radians: CGFloat, animated: Bool) {
    let change = { [self] in
      rotation = radians
      offset = clamped(offset, scale: scale, rotation: radians)
    }
    animated ? animate(change) : { change(); applyTransform() }()
    emitZoom()
  }

  // the drag only while zoomed (or rotated), so the scroll view around keeps its scrolling
  public func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
    guard gestureRecognizer === pan else { return true }
    let limit = offsetLimit(scale: scale, rotation: rotation)
    return limit.x > 0.5 || limit.y > 0.5
  }

  public func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
    [pinch, pan, rotate].contains { $0 === gestureRecognizer } && [pinch, pan, rotate].contains { $0 === other }
  }

  // MARK: - Commands (the `ref`)

  @objc public func zoomTo(_ value: Double, focusX: Double, focusY: Double, animated: Bool) {
    let box = container.bounds
    let focus = focusX < 0 || focusY < 0 ? CGPoint.zero : CGPoint(x: CGFloat(focusX) - box.midX, y: CGFloat(focusY) - box.midY)
    zoom(to: CGFloat(value), focus: focus, animated: animated)
  }

  @objc public func resetZoom(animated: Bool) {
    let change = { [self] in
      scale = 1
      offset = .zero
      rotation = 0
    }
    animated ? animate(change) : { change(); applyTransform() }()
    emitZoom()
  }

  @objc public func rotateTo(_ degrees: Double, animated: Bool) {
    rotate(to: CGFloat(degrees) * .pi / 180, animated: animated)
  }

  @objc public func play() { player.start() }

  @objc public func pause() { player.stop() }

  @objc public func reload() { load(reload: true) }
}
