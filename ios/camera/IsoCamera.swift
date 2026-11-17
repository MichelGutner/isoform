import AVFoundation
import ImageIO
import UIKit

/// What the camera reports to the Fabric shell (which turns it into JS events).
@objc public protocol IsoCameraHostDelegate: AnyObject {
  func cameraDidBecomeReady()
  func cameraDidFail(message: String)
  /// `granted`, `undetermined` or `blocked` (iOS never asks twice: settings only).
  func cameraPermissionChanged(camera: String, microphone: String)
  /// Zoom changed by a pinch or the Camera Control (1 = the main lens).
  func cameraZoomChanged(zoom: Double)
  /// Codes in sight, as `["value": …, "type": …]`, only when they change.
  func cameraDidScanCodes(_ codes: [[String: String]])
  func cameraDidTakePhoto(requestId: Int, uri: String, width: Int, height: Int, error: String)
  func cameraDidStartRecording(requestId: Int, error: String)
  func cameraDidFinishRecording(requestId: Int, uri: String, duration: Double, error: String)
}

/// The preview: a view whose layer is the session's preview layer, filling (and cropping) the box.
final class IsoCameraPreviewView: UIView {
  override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
  var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }

  override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .black
    previewLayer.videoGravity = .resizeAspectFill
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }
}

/// The camera setup that needs a session reconfiguration when it changes.
private struct IsoCameraSetup: Equatable {
  var front = false
  var video = false
  var audio = false
  var codes: [String]? = nil
}

/// JS code kind → AVFoundation type (UPC-A is reported by iOS as EAN-13 with a leading zero).
private let codeTypes: [String: [AVMetadataObject.ObjectType]] = {
  var types: [String: [AVMetadataObject.ObjectType]] = [
    "qr": [.qr], "aztec": [.aztec], "data-matrix": [.dataMatrix], "pdf417": [.pdf417],
    "ean-13": [.ean13], "ean-8": [.ean8], "upc-a": [.ean13], "upc-e": [.upce],
    "code-128": [.code128], "code-39": [.code39, .code39Mod43], "code-93": [.code93],
    "itf": [.itf14, .interleaved2of5],
  ]
  if #available(iOS 15.4, *) { types["codabar"] = [.codabar] }
  return types
}()

private func codeName(_ type: AVMetadataObject.ObjectType) -> String? {
  codeTypes.first { $0.value.contains(type) && $0.key != "upc-a" }?.key
}

/// Bridge for the Fabric shell: owns the capture session (on its own queue), the preview,
/// the gestures, the permissions and the captures.
@objc public final class IsoCameraHost: NSObject {
  @objc public weak var delegate: IsoCameraHostDelegate?

  private let preview = IsoCameraPreviewView()
  /// The view Fabric puts on screen.
  @objc public var view: UIView { preview }

  private let session = AVCaptureSession()
  private let sessionQueue = DispatchQueue(label: "isoform.camera.session")
  private let photoOutput = AVCapturePhotoOutput()
  private var input: AVCaptureDeviceInput?
  private var audioInput: AVCaptureDeviceInput?
  private var applied: IsoCameraSetup?
  private var configuredOnce = false

  // props (main thread)
  private var setup = IsoCameraSetup()
  private var active = true
  private var attached = false
  private var wantsAudio = true
  private var flash = "off"
  private var torch = false
  private var zoom = 1.0
  @objc public var zoomGesture = true
  @objc public var focusGesture = true

  /// Device zoom factor that is "1×" for the user (2 on a back camera with an ultra wide).
  private var zoomBase = 1.0
  private var pinchStart = 1.0
  private var lastPermission = ""
  private var lastCodes: Set<String> = []
  /// Photos being taken (session queue only).
  private var photoRequests: [Int64: IsoPhotoRequest] = [:]
  private var rotation: AnyObject?
  private var observers: [NSObjectProtocol] = []

  #if ISO_CAMERA_VIDEO
  private let movieOutput = AVCaptureMovieFileOutput()
  private var recording: IsoRecording?
  #endif

  #if ISO_CAMERA_CODES
  private let metadataOutput = AVCaptureMetadataOutput()
  #endif

  @objc public override init() {
    super.init()
    preview.previewLayer.session = session
    let pinch = UIPinchGestureRecognizer(target: self, action: #selector(pinched(_:)))
    let tap = UITapGestureRecognizer(target: self, action: #selector(tapped(_:)))
    preview.addGestureRecognizer(pinch)
    preview.addGestureRecognizer(tap)
    observeSession()
  }

  deinit {
    observers.forEach(NotificationCenter.default.removeObserver)
  }

  // MARK: - Props

  @objc public func setFacing(_ value: String) { setup.front = value == "front"; refresh() }
  @objc public func setActive(_ value: Bool) { active = value; refresh() }
  @objc public func setVideo(_ value: Bool) { setup.video = value; refresh() }
  @objc public func setAudio(_ value: Bool) { wantsAudio = value; refresh() }
  @objc public func setFlash(_ value: String) { flash = value }

  @objc public func setCodeScanner(_ on: Bool, types: [String]) {
    setup.codes = on ? (types.isEmpty ? ["qr"] : types) : nil
    refresh()
  }

  @objc public func setTorch(_ value: Bool) {
    torch = value
    sessionQueue.async { self.applyTorch() }
  }

  @objc public func setZoom(_ value: Double) {
    zoom = value
    sessionQueue.async { self.applyZoom() }
  }

  /// The view entered (`true`) or left (`false`) a window.
  @objc public func setAttached(_ value: Bool) {
    attached = value
    refresh()
  }

  // MARK: - Run state

  private var needsMicrophone: Bool { setup.video && wantsAudio }

  /// Applies the current state: permissions, then whether the session runs and with what.
  private func refresh() {
    reportPermission()
    guard attached, active else { return stop() }
    switch AVCaptureDevice.authorizationStatus(for: .video) {
    case .authorized: break
    case .notDetermined: return ask(.video)
    default: return stop()
    }
    if needsMicrophone, AVCaptureDevice.authorizationStatus(for: .audio) == .notDetermined { return ask(.audio) }
    var next = setup
    next.audio = needsMicrophone && AVCaptureDevice.authorizationStatus(for: .audio) == .authorized
    start(next)
  }

  /// The system dialog (its text is `NSCameraUsageDescription` / `NSMicrophoneUsageDescription`).
  private func ask(_ media: AVMediaType) {
    AVCaptureDevice.requestAccess(for: media) { _ in
      DispatchQueue.main.async { self.refresh() }
    }
  }

  /// `requestPermission` command: iOS only asks once, so a refused permission opens nothing here (JS opens Settings).
  @objc public func requestPermission() { refresh() }

  private static func status(_ media: AVMediaType) -> String {
    switch AVCaptureDevice.authorizationStatus(for: media) {
    case .authorized: return "granted"
    case .notDetermined: return "undetermined"
    default: return "blocked"
    }
  }

  private func reportPermission() {
    let camera = Self.status(.video)
    let microphone = needsMicrophone ? Self.status(.audio) : "undetermined"
    let key = "\(camera)/\(microphone)"
    guard key != lastPermission else { return }
    lastPermission = key
    delegate?.cameraPermissionChanged(camera: camera, microphone: microphone)
  }

  private func start(_ next: IsoCameraSetup) {
    sessionQueue.async {
      if next != self.applied { self.configure(next) }
      if !self.session.isRunning { self.session.startRunning() }
      DispatchQueue.main.async { self.startRotation() }
    }
  }

  private func stop() {
    sessionQueue.async {
      if self.session.isRunning { self.session.stopRunning() }
    }
  }

  /// Stops for good (the view was recycled or dropped).
  @objc public func shutdown() {
    attached = false
    rotation = nil
    #if ISO_CAMERA_VIDEO
    sessionQueue.async { if self.movieOutput.isRecording { self.movieOutput.stopRecording() } }
    #endif
    stop()
  }

  // MARK: - Session (session queue)

  private func configure(_ next: IsoCameraSetup) {
    session.beginConfiguration()
    defer { session.commitConfiguration() }
    session.sessionPreset = next.video ? .high : .photo

    if next.front != applied?.front || input == nil {
      if let input { session.removeInput(input) }
      input = nil
      guard let device = Self.camera(front: next.front) else {
        DispatchQueue.main.async { self.delegate?.cameraDidFail(message: next.front ? "No front camera" : "No back camera") }
        return
      }
      do {
        let newInput = try AVCaptureDeviceInput(device: device)
        if session.canAddInput(newInput) { session.addInput(newInput) }
        input = newInput
        zoomBase = Self.zoomBase(of: device)
        DispatchQueue.main.async {
          // a new camera: a new rotation coordinator (started right after) and Camera Control
          self.rotation = nil
          self.addCameraControl(device)
        }
      } catch {
        DispatchQueue.main.async { self.delegate?.cameraDidFail(message: error.localizedDescription) }
        return
      }
    }

    if !configuredOnce, session.canAddOutput(photoOutput) {
      session.addOutput(photoOutput)
      photoOutput.maxPhotoQualityPrioritization = .balanced
      configuredOnce = true
    }
    if #available(iOS 17.0, *) {
      // capture again while the last photo is still processing, and favor speed for bursts
      if photoOutput.isResponsiveCaptureSupported { photoOutput.isResponsiveCaptureEnabled = true }
      if photoOutput.isFastCapturePrioritizationSupported { photoOutput.isFastCapturePrioritizationEnabled = true }
    }

    configureAudio(next.audio)
    configureVideo(next.video)
    configureCodes(next.codes)
    applied = next
    applyZoom()
    applyTorch()
  }

  private func configureAudio(_ on: Bool) {
    if !on, let audioInput {
      session.removeInput(audioInput)
      self.audioInput = nil
    }
    guard on, audioInput == nil, let mic = AVCaptureDevice.default(for: .audio), let newInput = try? AVCaptureDeviceInput(device: mic) else { return }
    if session.canAddInput(newInput) {
      session.addInput(newInput)
      audioInput = newInput
    }
  }

  private func configureVideo(_ on: Bool) {
    #if ISO_CAMERA_VIDEO
    let added = session.outputs.contains(movieOutput)
    if on, !added, session.canAddOutput(movieOutput) { session.addOutput(movieOutput) }
    if !on, added { session.removeOutput(movieOutput) }
    #endif
  }

  private func configureCodes(_ kinds: [String]?) {
    #if ISO_CAMERA_CODES
    let added = session.outputs.contains(metadataOutput)
    guard let kinds else {
      if added { session.removeOutput(metadataOutput) }
      return
    }
    if !added, session.canAddOutput(metadataOutput) {
      session.addOutput(metadataOutput)
      metadataOutput.setMetadataObjectsDelegate(self, queue: .main)
    }
    let wanted = Set(kinds.flatMap { codeTypes[$0] ?? [] })
    metadataOutput.metadataObjectTypes = metadataOutput.availableMetadataObjectTypes.filter(wanted.contains)
    #endif
  }

  /// The back camera that can switch lenses while zooming (triple, dual wide, dual), else the wide one.
  private static func camera(front: Bool) -> AVCaptureDevice? {
    let types: [AVCaptureDevice.DeviceType] = front
      ? [.builtInTrueDepthCamera, .builtInWideAngleCamera]
      : [.builtInTripleCamera, .builtInDualWideCamera, .builtInDualCamera, .builtInWideAngleCamera]
    let position: AVCaptureDevice.Position = front ? .front : .back
    return AVCaptureDevice.DiscoverySession(deviceTypes: types, mediaType: .video, position: position).devices.first
  }

  /// On a camera with an ultra wide, device zoom 1 is the ultra wide: the main lens ("1×") starts at the first switch-over.
  private static func zoomBase(of device: AVCaptureDevice) -> Double {
    guard [.builtInTripleCamera, .builtInDualWideCamera].contains(device.deviceType) else { return 1 }
    return device.virtualDeviceSwitchOverVideoZoomFactors.first?.doubleValue ?? 1
  }

  private func applyZoom() {
    guard let device = input?.device, (try? device.lockForConfiguration()) != nil else { return }
    device.videoZoomFactor = clampedZoom(zoom * zoomBase, device)
    device.unlockForConfiguration()
  }

  private func clampedZoom(_ factor: Double, _ device: AVCaptureDevice) -> CGFloat {
    // beyond 10× the main lens the picture is mostly digital noise
    let upper = min(device.maxAvailableVideoZoomFactor, CGFloat(zoomBase * 10))
    return min(max(CGFloat(factor), device.minAvailableVideoZoomFactor), upper)
  }

  private func applyTorch() {
    guard let device = input?.device, device.hasTorch, device.isTorchModeSupported(.on), (try? device.lockForConfiguration()) != nil else { return }
    device.torchMode = torch ? .on : .off
    device.unlockForConfiguration()
  }

  // MARK: - Rotation

  /// iOS 17+: the rotation coordinator keeps the preview level and tells the angle for captures.
  private func startRotation() {
    guard rotation == nil, let device = input?.device else { return }
    if #available(iOS 17.0, *) {
      let coordinator = AVCaptureDevice.RotationCoordinator(device: device, previewLayer: preview.previewLayer)
      preview.previewLayer.connection?.videoRotationAngle = coordinator.videoRotationAngleForHorizonLevelPreview
      let observation = coordinator.observe(\.videoRotationAngleForHorizonLevelPreview, options: [.new]) { [weak self] coordinator, _ in
        DispatchQueue.main.async { self?.preview.previewLayer.connection?.videoRotationAngle = coordinator.videoRotationAngleForHorizonLevelPreview }
      }
      rotation = IsoRotation(coordinator: coordinator, observation: observation)
    }
  }

  /// Angle for a photo or video taken now, so it comes out upright.
  private func captureAngle() -> CGFloat? {
    if #available(iOS 17.0, *), let rotation = rotation as? IsoRotation {
      return rotation.coordinator.videoRotationAngleForHorizonLevelCapture
    }
    return nil
  }

  /// iOS 15–16: the device orientation as the old `videoOrientation`.
  private static func legacyOrientation() -> AVCaptureVideoOrientation {
    switch UIDevice.current.orientation {
    case .landscapeLeft: return .landscapeRight
    case .landscapeRight: return .landscapeLeft
    case .portraitUpsideDown: return .portraitUpsideDown
    default: return .portrait
    }
  }

  /// What a capture taken now needs to come out upright (read on the main thread).
  private struct CaptureRotation {
    var angle: CGFloat?
    var legacy: AVCaptureVideoOrientation
  }

  private func captureRotation() -> CaptureRotation {
    CaptureRotation(angle: captureAngle(), legacy: Self.legacyOrientation())
  }

  private func orient(_ connection: AVCaptureConnection?, _ rotation: CaptureRotation) {
    guard let connection else { return }
    if #available(iOS 17.0, *) {
      if let angle = rotation.angle, connection.isVideoRotationAngleSupported(angle) { connection.videoRotationAngle = angle }
    } else if connection.isVideoOrientationSupported {
      connection.videoOrientation = rotation.legacy
    }
  }

  // MARK: - Gestures

  @objc private func pinched(_ gesture: UIPinchGestureRecognizer) {
    guard zoomGesture else { return }
    if gesture.state == .began { pinchStart = zoom }
    guard gesture.state == .changed, let device = input?.device else { return }
    let next = Double(clampedZoom(pinchStart * Double(gesture.scale) * zoomBase, device)) / zoomBase
    zoom = next
    sessionQueue.async { self.applyZoom() }
    delegate?.cameraZoomChanged(zoom: (next * 100).rounded() / 100)
  }

  @objc private func tapped(_ gesture: UITapGestureRecognizer) {
    guard focusGesture, let device = input?.device else { return }
    let point = gesture.location(in: preview)
    let devicePoint = preview.previewLayer.captureDevicePointConverted(fromLayerPoint: point)
    sessionQueue.async {
      guard (try? device.lockForConfiguration()) != nil else { return }
      if device.isFocusPointOfInterestSupported, device.isFocusModeSupported(.autoFocus) {
        device.focusPointOfInterest = devicePoint
        device.focusMode = .autoFocus
      }
      if device.isExposurePointOfInterestSupported, device.isExposureModeSupported(.autoExpose) {
        device.exposurePointOfInterest = devicePoint
        device.exposureMode = .autoExpose
      }
      // back to continuous focus when the scene changes
      device.isSubjectAreaChangeMonitoringEnabled = true
      device.unlockForConfiguration()
    }
    showFocusRing(at: point)
  }

  @objc private func subjectAreaChanged() {
    sessionQueue.async {
      guard let device = self.input?.device, (try? device.lockForConfiguration()) != nil else { return }
      if device.isFocusModeSupported(.continuousAutoFocus) { device.focusMode = .continuousAutoFocus }
      if device.isExposureModeSupported(.continuousAutoExposure) { device.exposureMode = .continuousAutoExposure }
      device.isSubjectAreaChangeMonitoringEnabled = false
      device.unlockForConfiguration()
    }
  }

  /// The ring drawn where the user tapped: it shrinks in, then fades out.
  private func showFocusRing(at point: CGPoint) {
    let ring = UIView(frame: CGRect(x: 0, y: 0, width: 72, height: 72))
    ring.center = point
    ring.layer.borderColor = UIColor.white.cgColor
    ring.layer.borderWidth = 1.5
    ring.layer.cornerRadius = 36
    ring.isUserInteractionEnabled = false
    ring.transform = CGAffineTransform(scaleX: 1.4, y: 1.4)
    preview.addSubview(ring)
    UIView.animate(withDuration: 0.2, animations: { ring.transform = .identity }) { _ in
      UIView.animate(withDuration: 0.6, delay: 0.7, options: [], animations: { ring.alpha = 0 }) { _ in ring.removeFromSuperview() }
    }
  }

  // MARK: - Camera Control (iPhone 16+, iOS 18)

  private func addCameraControl(_ device: AVCaptureDevice) {
    guard #available(iOS 18.0, *) else { return }
    sessionQueue.async {
      guard self.session.supportsControls else { return }
      self.session.beginConfiguration()
      self.session.controls.forEach(self.session.removeControl)
      let slider = AVCaptureSystemZoomSlider(device: device) { [weak self] factor in
        guard let self else { return }
        let zoom = Double(factor) / self.zoomBase
        DispatchQueue.main.async {
          self.zoom = zoom
          self.delegate?.cameraZoomChanged(zoom: (zoom * 100).rounded() / 100)
        }
      }
      if self.session.canAddControl(slider) { self.session.addControl(slider) }
      self.session.setControlsDelegate(self, queue: self.sessionQueue)
      self.session.commitConfiguration()
    }
  }

  // MARK: - Notifications

  private func observeSession() {
    let center = NotificationCenter.default
    observers.append(center.addObserver(forName: AVCaptureSession.didStartRunningNotification, object: session, queue: .main) { [weak self] _ in
      self?.delegate?.cameraDidBecomeReady()
    })
    observers.append(center.addObserver(forName: AVCaptureSession.runtimeErrorNotification, object: session, queue: .main) { [weak self] note in
      guard let self else { return }
      let error = note.userInfo?[AVCaptureSessionErrorKey] as? AVError
      // media services were reset: the session can simply run again
      if error?.code == .mediaServicesWereReset { return self.refresh() }
      self.delegate?.cameraDidFail(message: error?.localizedDescription ?? "The camera stopped")
    })
    observers.append(center.addObserver(forName: AVCaptureDevice.subjectAreaDidChangeNotification, object: nil, queue: .main) { [weak self] _ in
      self?.subjectAreaChanged()
    })
  }

  // MARK: - Photo

  @objc public func takePhoto(requestId: Int, flash flashOverride: String) {
    guard session.isRunning, photoOutput.connection(with: .video) != nil else {
      delegate?.cameraDidTakePhoto(requestId: requestId, uri: "", width: 0, height: 0, error: "Camera is not ready")
      return
    }
    let mode = flashOverride.isEmpty ? flash : flashOverride
    let turn = captureRotation()
    sessionQueue.async {
      let settings = self.photoOutput.availablePhotoCodecTypes.contains(.jpeg)
        ? AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
        : AVCapturePhotoSettings()
      let flashMode = Self.flashMode(mode)
      if self.photoOutput.supportedFlashModes.contains(flashMode) { settings.flashMode = flashMode }
      settings.photoQualityPrioritization = .balanced
      self.orient(self.photoOutput.connection(with: .video), turn)
      // the photo output does not keep its delegate: the request lives here until it is done
      let id = settings.uniqueID
      let request = IsoPhotoRequest { [weak self] uri, width, height, error in
        self?.sessionQueue.async { self?.photoRequests[id] = nil }
        DispatchQueue.main.async {
          self?.delegate?.cameraDidTakePhoto(requestId: requestId, uri: uri, width: width, height: height, error: error)
        }
      }
      self.photoRequests[id] = request
      self.photoOutput.capturePhoto(with: settings, delegate: request)
    }
  }

  private static func flashMode(_ value: String) -> AVCaptureDevice.FlashMode {
    switch value {
    case "on": return .on
    case "auto": return .auto
    default: return .off
    }
  }

  // MARK: - Video

  @objc public func startRecording(requestId: Int) {
    #if ISO_CAMERA_VIDEO
    let turn = captureRotation()
    sessionQueue.async {
      guard self.session.outputs.contains(self.movieOutput), !self.movieOutput.isRecording else {
        let message = self.movieOutput.isRecording ? "Camera is already recording" : "Camera is not ready to record"
        return DispatchQueue.main.async { self.delegate?.cameraDidStartRecording(requestId: requestId, error: message) }
      }
      self.orient(self.movieOutput.connection(with: .video), turn)
      let recording = IsoRecording(startRequest: requestId, host: self)
      self.recording = recording
      self.movieOutput.startRecording(to: outputURL(kind: "video", extension: "mov"), recordingDelegate: recording)
    }
    #else
    delegate?.cameraDidStartRecording(requestId: requestId, error: "Video recording is off: set camera.video in isoform.config.json")
    #endif
  }

  @objc public func stopRecording(requestId: Int) {
    #if ISO_CAMERA_VIDEO
    sessionQueue.async {
      guard let recording = self.recording, self.movieOutput.isRecording else {
        return DispatchQueue.main.async { self.delegate?.cameraDidFinishRecording(requestId: requestId, uri: "", duration: 0, error: "Camera is not recording") }
      }
      recording.stopRequest = requestId
      self.movieOutput.stopRecording()
    }
    #else
    delegate?.cameraDidFinishRecording(requestId: requestId, uri: "", duration: 0, error: "Camera is not recording")
    #endif
  }

  #if ISO_CAMERA_VIDEO
  fileprivate func recordingStarted(_ recording: IsoRecording) {
    DispatchQueue.main.async { self.delegate?.cameraDidStartRecording(requestId: recording.startRequest, error: "") }
  }

  fileprivate func recordingFinished(_ recording: IsoRecording, url: URL, error: Error?) {
    // an "error" can still mean a complete file (e.g. the maximum duration was reached)
    let finished = (error as NSError?)?.userInfo[AVErrorRecordingSuccessfullyFinishedKey] as? Bool ?? (error == nil)
    let duration = movieOutput.recordedDuration.seconds
    sessionQueue.async { if self.recording === recording { self.recording = nil } }
    DispatchQueue.main.async {
      self.delegate?.cameraDidFinishRecording(
        requestId: recording.stopRequest,
        uri: finished ? url.absoluteString : "",
        duration: duration.isFinite ? duration : 0,
        error: finished ? "" : (error?.localizedDescription ?? "Recording failed")
      )
    }
  }
  #endif
}

// MARK: - Codes

#if ISO_CAMERA_CODES
extension IsoCameraHost: AVCaptureMetadataOutputObjectsDelegate {
  public func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput objects: [AVMetadataObject], from connection: AVCaptureConnection) {
    let codes: [[String: String]] = objects.compactMap { object in
      guard let code = object as? AVMetadataMachineReadableCodeObject, let value = code.stringValue, let type = codeName(code.type) else { return nil }
      return ["value": value, "type": type]
    }
    let seen = Set(codes.map { "\($0["type"]!):\($0["value"]!)" })
    guard seen != lastCodes else { return }
    lastCodes = seen
    delegate?.cameraDidScanCodes(codes)
  }
}
#endif

// MARK: - Camera Control delegate

@available(iOS 18.0, *)
extension IsoCameraHost: AVCaptureSessionControlsDelegate {
  public func sessionControlsDidBecomeActive(_ session: AVCaptureSession) {}
  public func sessionControlsWillEnterFullscreenAppearance(_ session: AVCaptureSession) {}
  public func sessionControlsWillExitFullscreenAppearance(_ session: AVCaptureSession) {}
  public func sessionControlsDidBecomeInactive(_ session: AVCaptureSession) {}
}

// MARK: - Helpers

/// Keeps the rotation coordinator (iOS 17+) and its observation alive.
@available(iOS 17.0, *)
private final class IsoRotation {
  let coordinator: AVCaptureDevice.RotationCoordinator
  let observation: NSKeyValueObservation

  init(coordinator: AVCaptureDevice.RotationCoordinator, observation: NSKeyValueObservation) {
    self.coordinator = coordinator
    self.observation = observation
  }
}

/// A new file in the caches folder (`isoform-camera/`): the app moves it if it wants to keep it.
private func outputURL(kind: String, extension ext: String) -> URL {
  let folder = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("isoform-camera", isDirectory: true)
  try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
  return folder.appendingPathComponent("\(kind)-\(Int(Date().timeIntervalSince1970 * 1000)).\(ext)")
}

/// One photo being taken: writes the JPEG and reports its upright size.
private final class IsoPhotoRequest: NSObject, AVCapturePhotoCaptureDelegate {
  private let done: (String, Int, Int, String) -> Void

  init(done: @escaping (String, Int, Int, String) -> Void) {
    self.done = done
  }

  func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
    if let error { return done("", 0, 0, error.localizedDescription) }
    guard let data = photo.fileDataRepresentation() else { return done("", 0, 0, "Photo failed") }
    let url = outputURL(kind: "photo", extension: "jpg")
    do {
      try data.write(to: url)
    } catch {
      return done("", 0, 0, error.localizedDescription)
    }
    let (width, height) = Self.uprightSize(data)
    done(url.absoluteString, width, height, "")
  }

  /// Pixel size with the EXIF orientation applied (5–8 are the turned ones).
  private static func uprightSize(_ data: Data) -> (Int, Int) {
    guard let source = CGImageSourceCreateWithData(data as CFData, nil),
          let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any] else { return (0, 0) }
    let width = properties[kCGImagePropertyPixelWidth] as? Int ?? 0
    let height = properties[kCGImagePropertyPixelHeight] as? Int ?? 0
    let orientation = properties[kCGImagePropertyOrientation] as? Int ?? 1
    return orientation >= 5 ? (height, width) : (width, height)
  }
}

#if ISO_CAMERA_VIDEO
/// One recording: tells the host when it starts and when the file is complete.
private final class IsoRecording: NSObject, AVCaptureFileOutputRecordingDelegate {
  let startRequest: Int
  /// Request id of the `stopRecording` waiting for the file (`-1`: the recording ended by itself).
  var stopRequest = -1
  private weak var host: IsoCameraHost?

  init(startRequest: Int, host: IsoCameraHost) {
    self.startRequest = startRequest
    self.host = host
  }

  func fileOutput(_ output: AVCaptureFileOutput, didStartRecordingTo fileURL: URL, from connections: [AVCaptureConnection]) {
    host?.recordingStarted(self)
  }

  func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo outputFileURL: URL, from connections: [AVCaptureConnection], error: Error?) {
    host?.recordingFinished(self, url: outputFileURL, error: error)
  }
}
#endif
