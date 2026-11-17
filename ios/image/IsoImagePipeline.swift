import CoreImage
import CryptoKit
import ImageIO
import UIKit

/// A decoded picture: one frame, or the frames of an animation with their delays.
final class IsoDecodedImage {
  /// The frames, already decoded (drawing them costs nothing more).
  let frames: [UIImage]
  /// Seconds each frame stays on screen (one entry per frame).
  let delays: [Double]
  /// Width of the file's picture, in pixels (after the EXIF orientation).
  let pixelWidth: Int
  /// Height of the file's picture, in pixels.
  let pixelHeight: Int
  /// Long side of the decoded frames, in pixels.
  let decodedLongSide: CGFloat
  /// Decoded at the file's own size (no bigger version exists).
  let full: Bool

  init(frames: [UIImage], delays: [Double], pixelWidth: Int, pixelHeight: Int, decodedLongSide: CGFloat, full: Bool) {
    self.frames = frames
    self.delays = delays
    self.pixelWidth = pixelWidth
    self.pixelHeight = pixelHeight
    self.decodedLongSide = decodedLongSide
    self.full = full
  }

  /// Bytes in memory (for the memory cache's budget).
  var cost: Int {
    frames.reduce(0) { total, frame in total + Int(frame.size.width * frame.scale * frame.size.height * frame.scale * 4) }
  }

  /// Size of the picture in points, as `contentFit: none` draws it.
  var pointSize: CGSize {
    let scale = UIScreen.main.scale
    return CGSize(width: CGFloat(pixelWidth) / scale, height: CGFloat(pixelHeight) / scale)
  }

  /// Whether this version is sharp enough for `need` pixels on the long side.
  func covers(_ need: CGFloat) -> Bool { full || decodedLongSide >= need - 1 }
}

/// Where a loaded picture came from (`onLoad`'s `cacheType`).
enum IsoCacheType: String {
  case memory, disk, none
}

/// One picture to load.
struct IsoImageRequest {
  var uri: String
  var cacheKey = ""
  var headers: [String: String] = [:]
  /// Keep it in (and read it from) the memory cache.
  var memory = true
  /// Keep the file in (and read it from) the disk cache.
  var disk = true
  /// `URLSessionTask.priority`.
  var priority: Float = URLSessionTask.defaultPriority
  /// Size of the view, in points (`.zero` = decode at full size).
  var viewSize: CGSize = .zero
  /// `contentFit` (`cover`, `contain`, `fill`, `none`, `scaleDown`).
  var fit = "cover"
  /// Largest zoom the view allows (a zoomable view decodes a sharper version).
  var zoom: CGFloat = 1
  /// Gaussian blur radius, in points.
  var blurRadius: CGFloat = 0
  /// Skip the caches (`reload()`).
  var reload = false

  var key: String { cacheKey.isEmpty ? uri : cacheKey }
  var memoryKey: String { blurRadius > 0 ? "\(key)#blur\(blurRadius)" : key }
}

/// Handle of a load: cancel it when the view shows something else.
final class IsoImageTicket {
  fileprivate let id = UUID()
  private let lock = NSLock()
  private var _cancelled = false
  fileprivate var onCancel: (() -> Void)?

  var cancelled: Bool {
    lock.lock(); defer { lock.unlock() }
    return _cancelled
  }

  func cancel() {
    lock.lock()
    let run = _cancelled ? nil : onCancel
    _cancelled = true
    onCancel = nil
    lock.unlock()
    run?()
  }
}

enum IsoImageError: LocalizedError {
  case badSource(String)
  case http(Int)
  case decode

  var errorDescription: String? {
    switch self {
    case .badSource(let uri): return "Unsupported image source: \(uri)"
    case .http(let status): return "HTTP \(status)"
    case .decode: return "The file is not a picture this device can decode"
    }
  }
}

/// A download shared by every view that waits for the same picture.
private final class IsoDownload {
  struct Waiter {
    let progress: (Int64, Int64) -> Void
    let completion: (Result<Data, Error>) -> Void
  }

  let key: String
  let task: URLSessionDataTask
  var data = Data()
  var expected: Int64 = 0
  var status = 200
  var waiters: [UUID: Waiter] = [:]

  init(key: String, task: URLSessionDataTask) {
    self.key = key
    self.task = task
  }
}

/**
 The lib's image pipeline, shared by every `IsoImageHost`:
  · memory cache of decoded pictures (`NSCache`, a share of the device memory, emptied on memory warnings);
  · disk cache of the files (Caches/isoform-images, trimmed to 300 MB, oldest first);
  · one download per picture however many views wait for it, with progress, cancelled when nobody waits;
  · decoding off the main thread, at the size the view needs (ImageIO thumbnails, EXIF orientation applied),
    animated GIF/APNG/WebP with their frame delays, and an optional Gaussian blur.
 */
final class IsoImagePipeline: NSObject, URLSessionDataDelegate {
  static let shared = IsoImagePipeline()

  /// The disk cache stays under this size.
  private static let diskLimit = 300 * 1024 * 1024
  /// Longest side decoded for a zoomable view.
  private static let zoomLimit: CGFloat = 4096
  /// Most frames kept of an animation.
  private static let frameLimit = 400

  private let memory = NSCache<NSString, IsoDecodedImage>()
  private let work = DispatchQueue(label: "isoform.image", qos: .userInitiated, attributes: .concurrent)
  private let lock = NSLock()
  private var downloads: [String: IsoDownload] = [:]
  private var byTask: [Int: IsoDownload] = [:]
  private var writes = 0
  private let directory: URL
  private static let blurContext = CIContext(options: [.cacheIntermediates: false])

  private lazy var session: URLSession = {
    let configuration = URLSessionConfiguration.default
    // the disk cache is ours: URLCache would keep a second copy
    configuration.urlCache = nil
    configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
    configuration.httpMaximumConnectionsPerHost = 6
    let queue = OperationQueue()
    queue.maxConcurrentOperationCount = 1
    return URLSession(configuration: configuration, delegate: self, delegateQueue: queue)
  }()

  private override init() {
    let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
    directory = caches.appendingPathComponent("isoform-images", isDirectory: true)
    super.init()
    try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    memory.totalCostLimit = Int(min(ProcessInfo.processInfo.physicalMemory / 8, 256 * 1024 * 1024))
    NotificationCenter.default.addObserver(self, selector: #selector(memoryWarning), name: UIApplication.didReceiveMemoryWarningNotification, object: nil)
    work.asyncAfter(deadline: .now() + 5) { [weak self] in self?.trimDisk() }
  }

  @objc private func memoryWarning() { memory.removeAllObjects() }

  // MARK: - Loading

  /// Decoded picture for `request`, from the memory cache when it is sharp enough (called on the main thread).
  func cached(_ request: IsoImageRequest) -> IsoDecodedImage? {
    guard request.memory, !request.reload, let hit = memory.object(forKey: request.memoryKey as NSString) else { return nil }
    return hit.covers(Self.neededLongSide(hit.pixelWidth, hit.pixelHeight, request)) ? hit : nil
  }

  /**
   Loads, decodes and caches a picture. `progress` and `completion` run on the main thread,
   and never after the ticket is cancelled.
   */
  @discardableResult
  func load(
    _ request: IsoImageRequest,
    progress: @escaping (Int64, Int64) -> Void = { _, _ in },
    completion: @escaping (Result<(IsoDecodedImage, IsoCacheType), Error>) -> Void
  ) -> IsoImageTicket {
    let ticket = IsoImageTicket()
    if let hit = cached(request) {
      completion(.success((hit, .memory)))
      return ticket
    }
    let deliver: (Result<(IsoDecodedImage, IsoCacheType), Error>) -> Void = { result in
      DispatchQueue.main.async { if !ticket.cancelled { completion(result) } }
    }
    fetchData(request, ticket: ticket, progress: { loaded, total in
      DispatchQueue.main.async { if !ticket.cancelled { progress(loaded, total) } }
    }) { [weak self] result in
      guard let self, !ticket.cancelled else { return }
      self.work.async {
        switch result {
        case .failure(let error):
          deliver(.failure(error))
        case .success(let (data, type)):
          guard var image = Self.decode(data, request: request) else { return deliver(.failure(IsoImageError.decode)) }
          if request.blurRadius > 0 { image = Self.blurred(image, radius: request.blurRadius * UIScreen.main.scale) }
          if request.memory { self.memory.setObject(image, forKey: request.memoryKey as NSString, cost: image.cost) }
          deliver(.success((image, type)))
        }
      }
    }
    return ticket
  }

  /// The file's bytes: a local source, the disk cache or the network (then written to the disk cache).
  private func fetchData(
    _ request: IsoImageRequest,
    ticket: IsoImageTicket,
    progress: @escaping (Int64, Int64) -> Void,
    completion: @escaping (Result<(Data, IsoCacheType), Error>) -> Void
  ) {
    work.async { [self] in
      guard !ticket.cancelled else { return }
      let uri = request.uri
      if let local = Self.localData(uri) {
        return local.map { completion(.success(($0, .disk))) } ?? completion(.failure(IsoImageError.badSource(uri)))
      }
      guard let url = URL(string: uri), let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https" else {
        return completion(.failure(IsoImageError.badSource(uri)))
      }
      if request.disk, !request.reload, let data = readDisk(request.key) {
        return completion(.success((data, .disk)))
      }
      download(url, request: request, ticket: ticket, progress: progress) { [self] result in
        if case .success(let data) = result, request.disk {
          work.async { self.writeDisk(data, key: request.key) }
        }
        completion(result.map { ($0, .none) })
      }
    }
  }

  /// `file://`, `data:` and plain paths. `nil` for remote sources; `.some(nil)` for a local one that cannot be read.
  private static func localData(_ uri: String) -> Data?? {
    if uri.hasPrefix("data:") {
      guard let comma = uri.firstIndex(of: ",") else { return .some(nil) }
      let header = uri[..<comma]
      let body = String(uri[uri.index(after: comma)...])
      return .some(header.hasSuffix(";base64") ? Data(base64Encoded: body, options: .ignoreUnknownCharacters) : body.removingPercentEncoding?.data(using: .utf8))
    }
    if uri.hasPrefix("file://"), let url = URL(string: uri) { return .some(try? Data(contentsOf: url)) }
    if uri.hasPrefix("/") { return .some(FileManager.default.contents(atPath: uri)) }
    // a name in the app bundle (assets of a release build without a scheme)
    if !uri.contains("://"), let url = Bundle.main.url(forResource: uri, withExtension: nil) { return .some(try? Data(contentsOf: url)) }
    return nil
  }

  private func download(
    _ url: URL,
    request: IsoImageRequest,
    ticket: IsoImageTicket,
    progress: @escaping (Int64, Int64) -> Void,
    completion: @escaping (Result<Data, Error>) -> Void
  ) {
    let waiter = IsoDownload.Waiter(progress: progress, completion: completion)
    lock.lock()
    let key = request.reload ? "\(request.key)#\(ticket.id)" : request.key
    let shared = downloads[key] ?? {
      var urlRequest = URLRequest(url: url)
      request.headers.forEach { urlRequest.setValue($0.value, forHTTPHeaderField: $0.key) }
      let task = session.dataTask(with: urlRequest)
      let created = IsoDownload(key: key, task: task)
      downloads[key] = created
      byTask[task.taskIdentifier] = created
      return created
    }()
    shared.waiters[ticket.id] = waiter
    // the most urgent view decides
    shared.task.priority = max(shared.task.priority, request.priority)
    let start = shared.task.state == .suspended
    lock.unlock()

    ticket.onCancel = { [weak self, weak shared] in
      guard let self, let shared else { return }
      self.lock.lock()
      shared.waiters[ticket.id] = nil
      let idle = shared.waiters.isEmpty
      if idle { self.forget(shared) }
      self.lock.unlock()
      if idle { shared.task.cancel() }
    }
    // cancelled before the hook was set: run it now
    if ticket.cancelled { ticket.onCancel?(); ticket.onCancel = nil }
    if start { shared.task.resume() }
  }

  /// Removes a download from the tables (call with the lock held).
  private func forget(_ download: IsoDownload) {
    downloads[download.key] = nil
    byTask[download.task.taskIdentifier] = nil
  }

  private func download(for task: URLSessionTask) -> IsoDownload? {
    lock.lock(); defer { lock.unlock() }
    return byTask[task.taskIdentifier]
  }

  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
    guard let shared = download(for: dataTask) else { return completionHandler(.cancel) }
    shared.status = (response as? HTTPURLResponse)?.statusCode ?? 200
    shared.expected = max(0, response.expectedContentLength)
    completionHandler(.allow)
  }

  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    guard let shared = download(for: dataTask) else { return }
    shared.data.append(data)
    lock.lock()
    let waiters = Array(shared.waiters.values)
    lock.unlock()
    let loaded = Int64(shared.data.count)
    waiters.forEach { $0.progress(loaded, shared.expected) }
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    lock.lock()
    guard let shared = byTask[task.taskIdentifier] else { return lock.unlock() }
    forget(shared)
    let waiters = Array(shared.waiters.values)
    lock.unlock()
    let result: Result<Data, Error> = error.map { .failure($0) }
      ?? (shared.status >= 400 ? .failure(IsoImageError.http(shared.status)) : .success(shared.data))
    waiters.forEach { $0.completion(result) }
  }

  // MARK: - Decoding

  /// Pixels the long side needs to look sharp in the view (`0` = the full size).
  static func neededLongSide(_ width: Int, _ height: Int, _ request: IsoImageRequest) -> CGFloat {
    let long = CGFloat(max(width, height))
    guard request.viewSize.width > 0, request.viewSize.height > 0, width > 0, height > 0 else { return long }
    let screen = UIScreen.main.scale
    let boxW = request.viewSize.width * screen
    let boxH = request.viewSize.height * screen
    let scaleX = boxW / CGFloat(width)
    let scaleY = boxH / CGFloat(height)
    let scales: [String: CGFloat] = [
      "cover": max(scaleX, scaleY),
      "fill": max(scaleX, scaleY),
      "contain": min(scaleX, scaleY),
      "scaleDown": min(1, scaleX, scaleY),
      "none": 1,
    ]
    let need = long * min(1, (scales[request.fit] ?? max(scaleX, scaleY)) * request.zoom)
    return request.zoom > 1 ? min(max(need, min(long, zoomLimit)), long) : need
  }

  /// Decodes `data` at the size `request` needs (all the frames of an animation).
  static func decode(_ data: Data, request: IsoImageRequest) -> IsoDecodedImage? {
    guard let source = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary) else { return nil }
    let count = CGImageSourceGetCount(source)
    guard count > 0 else { return nil }
    let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any] ?? [:]
    var width = properties[kCGImagePropertyPixelWidth] as? Int ?? 0
    var height = properties[kCGImagePropertyPixelHeight] as? Int ?? 0
    // EXIF orientations 5…8 turn the picture sideways
    if (properties[kCGImagePropertyOrientation] as? Int ?? 1) >= 5 { swap(&width, &height) }
    let long = CGFloat(max(width, height))
    let need = neededLongSide(width, height, request)
    let full = long == 0 || need >= long
    let options: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceShouldCacheImmediately: true,
      kCGImageSourceThumbnailMaxPixelSize: max(1, Int((full ? (long > 0 ? long : 8192) : need).rounded(.up))),
    ]
    var frames: [UIImage] = []
    var delays: [Double] = []
    for index in 0..<min(count, frameLimit) {
      guard let frame = CGImageSourceCreateThumbnailAtIndex(source, index, options as CFDictionary) else { continue }
      frames.append(UIImage(cgImage: frame, scale: 1, orientation: .up))
      delays.append(delay(source, index))
    }
    guard let first = frames.first else { return nil }
    if width == 0 || height == 0 {
      width = Int(first.size.width)
      height = Int(first.size.height)
    }
    return IsoDecodedImage(
      frames: frames,
      delays: delays,
      pixelWidth: width,
      pixelHeight: height,
      decodedLongSide: max(first.size.width, first.size.height),
      full: full
    )
  }

  /// Seconds a frame stays on screen (GIF, APNG or WebP), at least 20 ms like the browsers.
  private static func delay(_ source: CGImageSource, _ index: Int) -> Double {
    guard let properties = CGImageSourceCopyPropertiesAtIndex(source, index, nil) as? [CFString: Any] else { return 0.1 }
    let formats: [(CFString, CFString, CFString)] = [
      (kCGImagePropertyGIFDictionary, kCGImagePropertyGIFUnclampedDelayTime, kCGImagePropertyGIFDelayTime),
      (kCGImagePropertyPNGDictionary, kCGImagePropertyAPNGUnclampedDelayTime, kCGImagePropertyAPNGDelayTime),
      (kCGImagePropertyWebPDictionary, kCGImagePropertyWebPUnclampedDelayTime, kCGImagePropertyWebPDelayTime),
    ]
    for (dictionary, unclamped, clamped) in formats {
      guard let values = properties[dictionary] as? [CFString: Any] else { continue }
      let seconds = (values[unclamped] as? Double) ?? (values[clamped] as? Double) ?? 0.1
      return seconds < 0.02 ? 0.1 : seconds
    }
    return 0.1
  }

  /// The frames with a Gaussian blur (`radius` in pixels), edges kept opaque.
  private static func blurred(_ image: IsoDecodedImage, radius: CGFloat) -> IsoDecodedImage {
    let frames = image.frames.map { frame -> UIImage in
      guard let cg = frame.cgImage, let filter = CIFilter(name: "CIGaussianBlur") else { return frame }
      let input = CIImage(cgImage: cg)
      filter.setValue(input.clampedToExtent(), forKey: kCIInputImageKey)
      filter.setValue(radius, forKey: kCIInputRadiusKey)
      guard let output = filter.outputImage?.cropped(to: input.extent), let result = blurContext.createCGImage(output, from: input.extent) else { return frame }
      return UIImage(cgImage: result, scale: 1, orientation: .up)
    }
    return IsoDecodedImage(
      frames: frames,
      delays: image.delays,
      pixelWidth: image.pixelWidth,
      pixelHeight: image.pixelHeight,
      decodedLongSide: image.decodedLongSide,
      full: image.full
    )
  }

  // MARK: - Disk cache

  private func file(_ key: String) -> URL {
    let name = SHA256.hash(data: Data(key.utf8)).map { String(format: "%02x", $0) }.joined()
    return directory.appendingPathComponent(name)
  }

  private func readDisk(_ key: String) -> Data? {
    let url = file(key)
    guard let data = try? Data(contentsOf: url) else { return nil }
    // most recently used: trimmed last
    try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: url.path)
    return data
  }

  private func writeDisk(_ data: Data, key: String) {
    try? data.write(to: file(key), options: .atomic)
    lock.lock()
    writes += 1
    let trim = writes % 50 == 0
    lock.unlock()
    if trim { trimDisk() }
  }

  /// Deletes the least recently used files until the cache is under its limit.
  private func trimDisk() {
    let keys: [URLResourceKey] = [.contentModificationDateKey, .totalFileAllocatedSizeKey]
    guard let urls = try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: keys) else { return }
    let files = urls.compactMap { url -> (URL, Date, Int)? in
      guard let values = try? url.resourceValues(forKeys: Set(keys)) else { return nil }
      return (url, values.contentModificationDate ?? .distantPast, values.totalFileAllocatedSize ?? 0)
    }
    var total = files.reduce(0) { $0 + $1.2 }
    for (url, _, size) in files.sorted(by: { $0.1 < $1.1 }) where total > Self.diskLimit {
      try? FileManager.default.removeItem(at: url)
      total -= size
    }
  }

  // MARK: - prefetch / clear

  /// Downloads the pictures (and decodes them when `memory`). `completion(allLoaded)` runs on the main thread.
  func prefetch(_ uris: [String], headers: [String: String], memory: Bool, disk: Bool, completion: @escaping (Bool) -> Void) {
    let group = DispatchGroup()
    let lock = NSLock()
    var ok = true
    let fail = { lock.lock(); ok = false; lock.unlock() }
    for uri in uris {
      group.enter()
      let request = IsoImageRequest(uri: uri, headers: headers, memory: memory, disk: disk, priority: URLSessionTask.lowPriority)
      if memory {
        load(request) { result in
          if case .failure = result { fail() }
          group.leave()
        }
      } else {
        fetchData(request, ticket: IsoImageTicket(), progress: { _, _ in }) { result in
          if case .failure = result { fail() }
          group.leave()
        }
      }
    }
    group.notify(queue: .main) { completion(ok) }
  }

  /// Empties the caches. `completion` runs on the main thread.
  func clear(memory clearMemory: Bool, disk clearDisk: Bool, completion: @escaping () -> Void) {
    if clearMemory { memory.removeAllObjects() }
    guard clearDisk else { return completion() }
    work.async(flags: .barrier) { [directory] in
      try? FileManager.default.removeItem(at: directory)
      try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      DispatchQueue.main.async(execute: completion)
    }
  }
}

/// `prefetchImages` and `clearImageCache` for the TurboModule (`IsoImageModule.mm`).
@objc public final class IsoImageCache: NSObject {
  @objc public static func prefetch(_ uris: [String], headers: [String], memory: Bool, disk: Bool, completion: @escaping (Bool) -> Void) {
    IsoImagePipeline.shared.prefetch(uris, headers: IsoImageCache.headers(headers), memory: memory, disk: disk, completion: completion)
  }

  @objc public static func clear(memory: Bool, disk: Bool, completion: @escaping () -> Void) {
    IsoImagePipeline.shared.clear(memory: memory, disk: disk, completion: completion)
  }

  /// `[name, value, name, value…]` → a dictionary.
  static func headers(_ flat: [String]) -> [String: String] {
    stride(from: 0, to: flat.count - 1, by: 2).reduce(into: [:]) { out, index in out[flat[index]] = flat[index + 1] }
  }
}

/// Decodes [blurhash](https://blurha.sh) strings (the same algorithm as the JS and Android versions).
enum IsoBlurhash {
  private static let digits = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~")
  private static let values: [Character: Int] = Dictionary(uniqueKeysWithValues: digits.enumerated().map { ($1, $0) })

  private static func decode83<S: Sequence>(_ text: S) -> Int? where S.Element == Character {
    text.reduce(Optional(0)) { value, char in value.flatMap { total in values[char].map { total * 83 + $0 } } }
  }

  private static func linear(_ value: Int) -> Double {
    let v = Double(value) / 255
    return v <= 0.04045 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4)
  }

  private static func srgb(_ value: Double) -> UInt8 {
    let v = max(0, min(1, value))
    return UInt8(v <= 0.0031308 ? (v * 12.92 * 255 + 0.5) : ((1.055 * pow(v, 1 / 2.4) - 0.055) * 255 + 0.5))
  }

  private static func signPow(_ value: Double, _ exponent: Double) -> Double {
    copysign(pow(abs(value), exponent), value)
  }

  /// The blurred picture, `width`×`height` pixels, or `nil` for an invalid hash.
  static func image(_ hash: String, width: Int = 32, height: Int = 32, punch: Double = 1) -> UIImage? {
    let chars = Array(hash)
    guard chars.count >= 6, let size = decode83(chars[0...0]) else { return nil }
    let countY = size / 9 + 1
    let countX = size % 9 + 1
    guard chars.count == 4 + 2 * countX * countY, let quantised = decode83(chars[1...1]), let dc = decode83(chars[2..<6]) else { return nil }
    let maximum = Double(quantised + 1) / 166 * punch

    var colors: [(Double, Double, Double)] = [(linear(dc >> 16), linear((dc >> 8) & 255), linear(dc & 255))]
    for index in 1..<(countX * countY) {
      guard let value = decode83(chars[(4 + index * 2)..<(6 + index * 2)]) else { return nil }
      colors.append((
        signPow(Double(value / (19 * 19) - 9) / 9, 2) * maximum,
        signPow(Double((value / 19) % 19 - 9) / 9, 2) * maximum,
        signPow(Double(value % 19 - 9) / 9, 2) * maximum
      ))
    }

    var pixels = [UInt8](repeating: 255, count: width * height * 4)
    for y in 0..<height {
      for x in 0..<width {
        var r = 0.0, g = 0.0, b = 0.0
        for j in 0..<countY {
          for i in 0..<countX {
            let basis = cos(Double.pi * Double(x * i) / Double(width)) * cos(Double.pi * Double(y * j) / Double(height))
            let color = colors[i + j * countX]
            r += color.0 * basis
            g += color.1 * basis
            b += color.2 * basis
          }
        }
        let at = 4 * (x + y * width)
        pixels[at] = srgb(r)
        pixels[at + 1] = srgb(g)
        pixels[at + 2] = srgb(b)
      }
    }

    guard
      let provider = CGDataProvider(data: Data(pixels) as CFData),
      let cg = CGImage(
        width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: width * 4,
        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue),
        provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent
      )
    else { return nil }
    return UIImage(cgImage: cg)
  }
}
