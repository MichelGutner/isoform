import PDFKit
import UIKit

/// What the viewer tells the Fabric shell (`IsoPdfView.mm`), which forwards it to JS.
@objc public protocol IsoPdfViewerDelegate: AnyObject {
  @objc(pdfDidLoadWithPageCount:) func pdfDidLoad(pageCount: Int)
  @objc(pdfDidChangePage:pageCount:) func pdfDidChangePage(_ page: Int, pageCount: Int)
  @objc(pdfDidSearch:total:current:) func pdfDidSearch(_ query: String, total: Int, current: Int)
  @objc(pdfDidFail:) func pdfDidFail(_ message: String)
  @objc(pdfNeedsPassword) func pdfNeedsPassword()
  @objc(pdfDidPressLink:) func pdfDidPressLink(_ url: String)
  @objc(pdfDidChangeFullscreen:) func pdfDidChangeFullscreen(_ fullscreen: Bool)
  @objc(pdfDidChangeReadAloud:) func pdfDidChangeReadAloud(_ reading: Bool)
  @objc(pdfDidPressPlaylist) func pdfDidPressPlaylist()
}

/// Native view of `Pdf` on iOS: Apple PDFKit (`PDFView`) with the lib's UIKit toolbar.
///  · pages: continuous vertical scroll, pinch zoom, text selection and copy, links;
///  · toolbar: thumbnails, page field, search, table of contents, more (night mode, fit, share);
///  · search: every match highlighted, the selected one in a stronger color;
///  · protected files: the `password` prop, or a password field.
@objc(IsoPdfViewer)
public final class IsoPdfViewer: UIView {
  @objc public weak var delegate: IsoPdfViewerDelegate?

  private let pdfView = PDFView()
  private let thumbnails = PDFThumbnailView()
  private let toolbar = IsoPdfToolbar()
  private let status = IsoPdfStatusView()
  private let finder = IsoPdfFinder()
  private let links = IsoPdfLinks()
  private let reader = IsoPdfReader()
  private var stack: UIStackView!
  /// Toolbar, pages, thumbnails and status: moved into a fullscreen controller and back.
  private let content = UIView()
  private var fullscreenController: UIViewController?

  private var source = ""
  private var password = ""
  private var initialPage = 1
  private var fit = "width"
  private var direction = "vertical"
  private var maxZoom: CGFloat = 5
  private var nightMode = false
  private var fileURL: URL?
  private var loadTask: URLSessionDataTask?
  private var lastPage = 0

  private var query = ""
  private var matches: [PDFSelection] = []
  private var current = 0

  /// Highlight of every match, and of the selected one.
  private static let matchColor = UIColor.systemYellow.withAlphaComponent(0.45)
  private static let currentColor = UIColor.systemOrange.withAlphaComponent(0.75)

  override public init(frame: CGRect) {
    super.init(frame: frame)
    configurePdfView()
    configureThumbnails()
    configureToolbar()
    layoutContent()
    NotificationCenter.default.addObserver(self, selector: #selector(pageChanged), name: .PDFViewPageChanged, object: pdfView)
    NotificationCenter.default.addObserver(self, selector: #selector(scaleChanged), name: .PDFViewScaleChanged, object: pdfView)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  deinit {
    loadTask?.cancel()
    NotificationCenter.default.removeObserver(self)
  }

  // MARK: - Props (the setters ignore repeated values)

  @objc public func setSource(_ value: String) {
    guard value != source else { return }
    source = value
    load()
  }

  @objc public func setPassword(_ value: String) {
    guard value != password else { return }
    password = value
    if let document = pdfView.document, document.isLocked { unlock(document, with: value) }
  }

  @objc public func setInitialPage(_ value: Int) { initialPage = max(1, value) }

  /// List position for the playlist button in the toolbar (`count` 0 hides it).
  @objc public func setPlaylist(index: Int, count: Int) { toolbar.setPlaylist(index: index, count: count) }

  @objc public func setSpeechLanguage(_ value: String) {
    reader.language = value.isEmpty ? nil : value
    toolbar.refreshMore()
  }

  @objc public func setSpeechVoice(_ value: String) {
    let voice = value.isEmpty ? nil : value
    guard voice != reader.voiceIdentifier else { return }
    reader.voiceIdentifier = voice
    toolbar.refreshMore()
  }

  @objc public func setControls(_ value: Bool) { toolbar.isHidden = !value }

  @objc public func setNightMode(_ value: Bool) {
    guard value != nightMode else { return }
    applyNight(value)
  }

  @objc public func setFit(_ value: String) {
    guard value != fit else { return }
    fit = value
    applyFit()
  }

  /// `"vertical"` (pages one under the other) or `"horizontal"` (side by side, turning like a book).
  @objc public func setDirection(_ value: String) {
    guard value != direction else { return }
    direction = value
    applyDirection()
  }

  @objc public func setMaxZoom(_ value: Float) {
    maxZoom = CGFloat(max(1, value))
    applyFit()
  }

  // MARK: - Commands

  @objc public func goToPage(_ page: Int) {
    guard let document = pdfView.document, document.pageCount > 0 else { return }
    let index = min(max(page - 1, 0), document.pageCount - 1)
    document.page(at: index).map(pdfView.go(to:))
  }

  @objc public func search(_ text: String) {
    toolbar.showSearch(text)
    runSearch(text)
  }

  @objc public func searchNext() { select(current + 1) }

  @objc public func searchPrevious() { select(current - 1) }

  @objc public func clearSearch() {
    finder.cancel(in: pdfView.document)
    query = ""
    matches = []
    current = 0
    pdfView.highlightedSelections = nil
    pdfView.clearSelection()
    toolbar.hideSearch()
    delegate?.pdfDidSearch("", total: 0, current: 0)
  }

  /// Shows the viewer over the whole screen (`true`) or back in its place (`false`).
  @objc public func setFullscreen(_ on: Bool) {
    guard on != (fullscreenController != nil) else { return }
    on ? enterFullscreen() : exitFullscreen()
  }

  /// Reads aloud from the page on screen to the end.
  @objc public func startReadAloud() {
    guard let document = pdfView.document, let page = pdfView.currentPage else { return }
    reader.start(document, at: document.index(for: page))
  }

  @objc public func stopReadAloud() {
    reader.stop()
    pdfView.clearSelection()
  }

  @objc public func setZoom(_ scale: Float) {
    pdfView.scaleFactor = baseScale * min(max(CGFloat(scale), 1), maxZoom)
  }

  /// Back to empty (view recycling).
  @objc public func reset() {
    exitFullscreen()
    stopReadAloud()
    loadTask?.cancel()
    finder.cancel(in: pdfView.document)
    pdfView.document = nil
    source = ""
    password = ""
    matches = []
    query = ""
    lastPage = 0
    status.show(.hidden)
  }

  // MARK: - Loading

  private func load() {
    loadTask?.cancel()
    stopReadAloud()
    clearSearch()
    pdfView.document = nil
    lastPage = 0
    guard !source.isEmpty, let url = URL(string: source) else { return }
    status.show(.loading)
    if url.isFileURL { return open(try? Data(contentsOf: url), file: url) }
    loadTask = URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
      let failed = error != nil || ((response as? HTTPURLResponse)?.statusCode ?? 200) >= 400
      DispatchQueue.main.async {
        guard let self, (error as? URLError)?.code != .cancelled else { return }
        self.open(failed ? nil : data, file: nil)
      }
    }
    loadTask?.resume()
  }

  private func open(_ data: Data?, file: URL?) {
    guard let data, let document = PDFDocument(data: data) else {
      status.show(.error("This file could not be opened as a PDF."))
      delegate?.pdfDidFail("This file could not be opened as a PDF.")
      return
    }
    fileURL = file ?? Self.saveForSharing(data, name: URL(string: source)?.lastPathComponent)
    document.delegate = finder
    IsoPdfPage.setNight(nightMode, for: document)
    guard !document.isLocked || unlock(document, with: password) else {
      return askPassword(for: document, wrong: !password.isEmpty)
    }
    present(document)
  }

  /// Writes the downloaded file to the caches folder, so the share sheet can offer it as a PDF.
  private static func saveForSharing(_ data: Data, name: String?) -> URL? {
    let base = (name?.isEmpty == false && name?.hasSuffix(".pdf") == true) ? name! : "document.pdf"
    let url = FileManager.default.temporaryDirectory.appendingPathComponent(base)
    return (try? data.write(to: url, options: .atomic)) == nil ? nil : url
  }

  @discardableResult
  private func unlock(_ document: PDFDocument, with password: String) -> Bool {
    guard !password.isEmpty, document.unlock(withPassword: password) else { return false }
    present(document)
    return true
  }

  private func askPassword(for document: PDFDocument, wrong: Bool) {
    delegate?.pdfNeedsPassword()
    status.show(.locked(wrong: wrong) { [weak self, weak document] typed in
      guard let self, let document else { return }
      guard document.unlock(withPassword: typed) else { return self.askPassword(for: document, wrong: true) }
      self.present(document)
    })
  }

  private func present(_ document: PDFDocument) {
    status.show(.hidden)
    pdfView.document = document
    applyFit()
    toolbar.update(page: 1, pageCount: document.pageCount)
    toolbar.setOutline(IsoPdfOutline.menu(for: document) { [weak self] destination in self?.pdfView.go(to: destination) })
    if initialPage > 1 { goToPage(initialPage) }
    delegate?.pdfDidLoad(pageCount: document.pageCount)
    pageChanged()
  }

  // MARK: - Zoom and fit

  /// Side by side (PDFKit's page view controller: swipe to turn), or one under the other.
  private func applyDirection() {
    let horizontal = direction == "horizontal"
    let page = pdfView.currentPage
    pdfView.usePageViewController(horizontal, withViewOptions: [UIPageViewController.OptionsKey.interPageSpacing: 16])
    pdfView.displayMode = horizontal ? .singlePage : .singlePageContinuous
    pdfView.displayDirection = horizontal ? .horizontal : .vertical
    applyFit()
    page.map(pdfView.go(to:))
    toolbar.refreshMore()
  }

  /// Scale of the `fit` size (zoom `1`). Side by side, a page always fits whole.
  private var baseScale: CGFloat {
    let fitsPage = pdfView.scaleFactorForSizeToFit
    guard fit == "width", direction != "horizontal", let page = pdfView.currentPage ?? pdfView.document?.page(at: 0) else { return fitsPage }
    let width = page.bounds(for: pdfView.displayBox).width
    return width > 0 ? (pdfView.bounds.width - 16) / width : fitsPage
  }

  private func applyFit() {
    guard pdfView.document != nil, pdfView.bounds.width > 0 else { return }
    let base = baseScale
    pdfView.minScaleFactor = base
    pdfView.maxScaleFactor = base * maxZoom
    pdfView.scaleFactor = base
  }

  override public func layoutSubviews() {
    let oldWidth = pdfView.bounds.width
    super.layoutSubviews()
    if pdfView.bounds.width != oldWidth { applyFit() }
  }

  // MARK: - Night mode

  private func applyNight(_ on: Bool) {
    nightMode = on
    toolbar.nightMode = on
    guard let document = pdfView.document else { return }
    IsoPdfPage.setNight(on, for: document)
    // PDFKit caches the drawn pages: setting the document again redraws them, at the same place
    let destination = pdfView.currentDestination
    let scale = pdfView.scaleFactor
    pdfView.document = document
    pdfView.scaleFactor = scale
    destination.map(pdfView.go(to:))
    thumbnails.pdfView = pdfView
    applyHighlights()
  }

  // MARK: - Search

  private func runSearch(_ text: String) {
    query = text.trimmingCharacters(in: .whitespacesAndNewlines)
    matches = []
    current = 0
    applyHighlights()
    guard let document = pdfView.document, !query.isEmpty else {
      toolbar.setCount(total: 0, current: 0, query: query)
      delegate?.pdfDidSearch(query, total: 0, current: 0)
      return
    }
    toolbar.setSearching()
    finder.find(query, in: document) { [weak self] found in
      guard let self else { return }
      self.matches = found
      self.select(0)
    }
  }

  private func select(_ index: Int) {
    guard !matches.isEmpty else {
      toolbar.setCount(total: 0, current: 0, query: query)
      delegate?.pdfDidSearch(query, total: 0, current: 0)
      return
    }
    current = (index % matches.count + matches.count) % matches.count
    applyHighlights()
    pdfView.go(to: matches[current])
    toolbar.setCount(total: matches.count, current: current + 1, query: query)
    delegate?.pdfDidSearch(query, total: matches.count, current: current + 1)
  }

  private func applyHighlights() {
    guard !matches.isEmpty else {
      pdfView.highlightedSelections = nil
      return
    }
    pdfView.highlightedSelections = matches.enumerated().map { index, match in
      match.color = index == current ? Self.currentColor : Self.matchColor
      return match
    }
  }

  // MARK: - Pages

  @objc private func pageChanged() {
    guard let document = pdfView.document, let page = pdfView.currentPage else { return }
    let number = document.index(for: page) + 1
    toolbar.update(page: number, pageCount: document.pageCount)
    guard number != lastPage else { return }
    lastPage = number
    delegate?.pdfDidChangePage(number, pageCount: document.pageCount)
  }

  @objc private func scaleChanged() {
    toolbar.zoom = pdfView.scaleFactor / max(baseScale, 0.01)
  }

  private func askPage() {
    guard let document = pdfView.document, let controller = isoViewController else { return }
    let alert = UIAlertController(title: "Go to page", message: "1–\(document.pageCount)", preferredStyle: .alert)
    alert.addTextField { field in
      field.keyboardType = .numberPad
      field.placeholder = "\(self.lastPage)"
    }
    alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
    alert.addAction(UIAlertAction(title: "Go", style: .default) { [weak self, weak alert] _ in
      Int(alert?.textFields?.first?.text ?? "").map { self?.goToPage($0) }
    })
    controller.present(alert, animated: true)
  }

  private func share(from source: UIView) {
    guard let fileURL, let controller = isoViewController else { return }
    let sheet = UIActivityViewController(activityItems: [fileURL], applicationActivities: nil)
    sheet.popoverPresentationController?.sourceView = source
    sheet.popoverPresentationController?.sourceRect = source.bounds
    controller.present(sheet, animated: true)
  }

  // MARK: - Fullscreen

  private func enterFullscreen() {
    guard let presenter = isoViewController else { return }
    let controller = UIViewController()
    controller.modalPresentationStyle = .fullScreen
    controller.view.backgroundColor = .systemBackground
    Self.pin(content, in: controller.view, safeArea: true)
    fullscreenController = controller
    toolbar.fullscreen = true
    presenter.present(controller, animated: true)
    delegate?.pdfDidChangeFullscreen(true)
  }

  private func exitFullscreen() {
    guard let controller = fullscreenController else { return }
    fullscreenController = nil
    toolbar.fullscreen = false
    controller.dismiss(animated: true)
    Self.pin(content, in: self, safeArea: false)
    delegate?.pdfDidChangeFullscreen(false)
  }

  /// Moves `view` into `host`, filling it (inside the safe area in fullscreen).
  private static func pin(_ view: UIView, in host: UIView, safeArea: Bool) {
    view.removeFromSuperview()
    view.translatesAutoresizingMaskIntoConstraints = false
    host.addSubview(view)
    let guide: (top: NSLayoutYAxisAnchor, bottom: NSLayoutYAxisAnchor) =
      safeArea ? (host.safeAreaLayoutGuide.topAnchor, host.safeAreaLayoutGuide.bottomAnchor) : (host.topAnchor, host.bottomAnchor)
    NSLayoutConstraint.activate([
      view.leadingAnchor.constraint(equalTo: host.leadingAnchor),
      view.trailingAnchor.constraint(equalTo: host.trailingAnchor),
      view.topAnchor.constraint(equalTo: guide.top),
      view.bottomAnchor.constraint(equalTo: guide.bottom),
    ])
  }

  // MARK: - Layout

  private func configurePdfView() {
    pdfView.displayMode = .singlePageContinuous
    pdfView.displayDirection = .vertical
    pdfView.autoScales = false
    pdfView.pageShadowsEnabled = true
    pdfView.pageBreakMargins = UIEdgeInsets(top: 8, left: 8, bottom: 8, right: 8)
    pdfView.backgroundColor = .secondarySystemBackground
    pdfView.delegate = links
    links.onLink = { [weak self] url in self?.delegate?.pdfDidPressLink(url.absoluteString) }
    configureReader()
  }

  /// The word being read is selected (and followed); each new page is scrolled to.
  private func configureReader() {
    reader.onPage = { [weak self] page in self?.pdfView.go(to: page) }
    reader.onWord = { [weak self] page, range in
      guard let self, let word = page.selection(for: range) else { return }
      self.pdfView.setCurrentSelection(word, animate: false)
      self.pdfView.go(to: word)
    }
    reader.onChange = { [weak self] reading in
      guard let self else { return }
      self.toolbar.reading = reading
      if !reading { self.pdfView.clearSelection() }
      self.delegate?.pdfDidChangeReadAloud(reading)
    }
  }

  private func configureThumbnails() {
    thumbnails.pdfView = pdfView
    thumbnails.layoutMode = .horizontal
    thumbnails.thumbnailSize = CGSize(width: 40, height: 54)
    thumbnails.backgroundColor = .systemBackground
    thumbnails.contentInset = UIEdgeInsets(top: 8, left: 12, bottom: 8, right: 12)
    thumbnails.isHidden = true
  }

  private func configureToolbar() {
    toolbar.actions = IsoPdfToolbar.Actions(
      toggleThumbnails: { [weak self] in
        guard let self else { return }
        self.thumbnails.isHidden.toggle()
        self.toolbar.thumbnailsOpen = !self.thumbnails.isHidden
      },
      askPage: { [weak self] in self?.askPage() },
      search: { [weak self] text in self?.runSearch(text) },
      next: { [weak self] in self?.searchNext() },
      previous: { [weak self] in self?.searchPrevious() },
      closeSearch: { [weak self] in self?.clearSearch() },
      toggleNight: { [weak self] in self.map { $0.applyNight(!$0.nightMode) } },
      setFit: { [weak self] value in
        self?.fit = value
        self?.applyFit()
      },
      share: { [weak self] source in self?.share(from: source) },
      toggleReadAloud: { [weak self] in
        guard let self else { return }
        self.reader.isReading ? self.stopReadAloud() : self.startReadAloud()
      },
      toggleFullscreen: { [weak self] in self.map { $0.setFullscreen($0.fullscreenController == nil) } },
      openPlaylist: { [weak self] in
        // the carousel opens in the React Native view: fullscreen closes first
        self?.setFullscreen(false)
        self?.delegate?.pdfDidPressPlaylist()
      },
      currentFit: { [weak self] in self?.fit ?? "width" },
      toggleDirection: { [weak self] in
        guard let self else { return }
        self.direction = self.direction == "horizontal" ? "vertical" : "horizontal"
        self.applyDirection()
      },
      currentDirection: { [weak self] in self?.direction ?? "vertical" },
      voices: { [weak self] in self?.reader.choices ?? [] },
      currentVoice: { [weak self] in self?.reader.voiceIdentifier },
      selectVoice: { [weak self] id in
        guard let self else { return }
        self.reader.voiceIdentifier = id
        // a new voice is heard right away: restart reading on the page being read
        if self.reader.isReading { self.startReadAloud() }
      }
    )
    toolbar.refreshMore()
  }

  private func layoutContent() {
    backgroundColor = .secondarySystemBackground
    clipsToBounds = true

    stack = UIStackView(arrangedSubviews: [toolbar, pdfView, thumbnails])
    stack.axis = .vertical
    stack.translatesAutoresizingMaskIntoConstraints = false
    content.addSubview(stack)
    status.translatesAutoresizingMaskIntoConstraints = false
    content.addSubview(status)
    NSLayoutConstraint.activate([
      stack.leadingAnchor.constraint(equalTo: content.leadingAnchor),
      stack.trailingAnchor.constraint(equalTo: content.trailingAnchor),
      stack.topAnchor.constraint(equalTo: content.topAnchor),
      stack.bottomAnchor.constraint(equalTo: content.bottomAnchor),
      thumbnails.heightAnchor.constraint(equalToConstant: 74),
      status.leadingAnchor.constraint(equalTo: pdfView.leadingAnchor),
      status.trailingAnchor.constraint(equalTo: pdfView.trailingAnchor),
      status.topAnchor.constraint(equalTo: pdfView.topAnchor),
      status.bottomAnchor.constraint(equalTo: pdfView.bottomAnchor),
    ])
    Self.pin(content, in: self, safeArea: false)
  }
}
