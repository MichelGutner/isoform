import UIKit

/// Toolbar of the iOS `Pdf`, in UIKit with SF Symbols and system colors (no accent color).
/// Normal mode: thumbnails · page ("3 / 14", tap to type a page) · read aloud · search · contents · fullscreen · more.
/// Search mode: the search field with "3 of 17", previous / next and close.
final class IsoPdfToolbar: UIView, UITextFieldDelegate {
  /// What the buttons do (set by the viewer).
  struct Actions {
    var toggleThumbnails: () -> Void = {}
    var askPage: () -> Void = {}
    var search: (String) -> Void = { _ in }
    var next: () -> Void = {}
    var previous: () -> Void = {}
    var closeSearch: () -> Void = {}
    var toggleNight: () -> Void = {}
    var setFit: (String) -> Void = { _ in }
    var share: (UIView) -> Void = { _ in }
    var toggleReadAloud: () -> Void = {}
    var toggleFullscreen: () -> Void = {}
    var openPlaylist: () -> Void = {}
    var currentFit: () -> String = { "width" }
    var toggleDirection: () -> Void = {}
    var currentDirection: () -> String = { "vertical" }
    var voices: () -> [(id: String, label: String)] = { [] }
    var currentVoice: () -> String? = { nil }
    var selectVoice: (String?) -> Void = { _ in }
  }

  var actions = Actions()

  var nightMode = false { didSet { refreshMore() } }
  var thumbnailsOpen = false { didSet { thumbnailsButton.isSelected = thumbnailsOpen } }
  var zoom: CGFloat = 1
  var reading = false {
    didSet {
      readButton.configuration?.image = UIImage(systemName: reading ? "stop.circle" : "speaker.wave.2")
      readButton.accessibilityLabel = reading ? "Stop reading" : "Read aloud"
    }
  }
  var fullscreen = false {
    didSet { fullscreenButton.configuration?.image = UIImage(systemName: fullscreen ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right") }
  }

  private let thumbnailsButton = UIButton(type: .system)
  private let pageButton = UIButton(type: .system)
  private let searchButton = UIButton(type: .system)
  private let outlineButton = UIButton(type: .system)
  private let fullscreenButton = UIButton(type: .system)
  private let readButton = UIButton(type: .system)
  /// List (`items`): opens the carousel; hidden without a list.
  private let playlistButton = UIButton(type: .system)
  private let moreButton = UIButton(type: .system)
  private let normalBar = UIStackView()

  private let field = UISearchTextField()
  private let countLabel = UILabel()
  private let previousButton = UIButton(type: .system)
  private let nextButton = UIButton(type: .system)
  private let closeButton = UIButton(type: .system)
  private let searchBar = UIStackView()

  private let separator = UIView()
  private var typingTimer: Timer?

  override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .systemBackground
    configureNormalBar()
    configureSearchBar()
    layoutBars()
    update(page: 1, pageCount: 0)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  // MARK: - State from the viewer

  func update(page: Int, pageCount: Int) {
    pageButton.configuration?.title = pageCount > 0 ? "\(page) / \(pageCount)" : "–"
    pageButton.accessibilityLabel = "Page \(page) of \(pageCount)"
  }

  /// Shows the playlist button with the position ("2/4"), or hides it (`count` 0).
  func setPlaylist(index: Int, count: Int) {
    playlistButton.isHidden = count == 0 || index < 0
    playlistButton.configuration?.title = "\(index + 1)/\(count)"
    playlistButton.accessibilityLabel = "Playlist, item \(index + 1) of \(count)"
  }

  func setOutline(_ menu: UIMenu?) {
    outlineButton.menu = menu
    outlineButton.isHidden = menu == nil
  }

  func showSearch(_ text: String) {
    field.text = text
    setSearchVisible(true)
  }

  func hideSearch() {
    field.text = ""
    countLabel.text = ""
    field.resignFirstResponder()
    setSearchVisible(false)
  }

  func setSearching() {
    countLabel.text = "…"
    setArrows(enabled: false)
  }

  func setCount(total: Int, current: Int, query: String) {
    countLabel.text = query.isEmpty ? "" : (total > 0 ? "\(current) of \(total)" : "No results")
    setArrows(enabled: total > 0)
  }

  // MARK: - Search field

  func textFieldShouldReturn(_ textField: UITextField) -> Bool {
    actions.next()
    return false
  }

  @objc private func textChanged() {
    typingTimer?.invalidate()
    let text = field.text ?? ""
    typingTimer = Timer.scheduledTimer(withTimeInterval: 0.3, repeats: false) { [weak self] _ in self?.actions.search(text) }
  }

  private func setSearchVisible(_ visible: Bool) {
    normalBar.isHidden = visible
    searchBar.isHidden = !visible
    if visible { field.becomeFirstResponder() }
  }

  private func setArrows(enabled: Bool) {
    previousButton.isEnabled = enabled
    nextButton.isEnabled = enabled
  }

  // MARK: - Building

  private static func iconConfiguration(_ symbol: String) -> UIButton.Configuration {
    var config = UIButton.Configuration.plain()
    config.image = UIImage(systemName: symbol)
    config.preferredSymbolConfigurationForImage = UIImage.SymbolConfiguration(pointSize: 17, weight: .regular)
    config.baseForegroundColor = .label
    config.contentInsets = NSDirectionalEdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8)
    return config
  }

  private static func icon(_ button: UIButton, _ symbol: String, _ label: String, action: @escaping () -> Void) {
    button.configuration = iconConfiguration(symbol)
    button.accessibilityLabel = label
    button.addAction(UIAction { _ in action() }, for: .touchUpInside)
    button.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([button.widthAnchor.constraint(equalToConstant: 40), button.heightAnchor.constraint(equalToConstant: 40)])
  }

  private func configureNormalBar() {
    Self.icon(thumbnailsButton, "square.grid.2x2", "Pages") { [weak self] in self?.actions.toggleThumbnails() }
    thumbnailsButton.configurationUpdateHandler = { button in
      button.configuration?.background.backgroundColor = button.isSelected ? .tertiarySystemFill : .clear
    }

    var page = UIButton.Configuration.gray()
    page.cornerStyle = .capsule
    page.baseForegroundColor = .label
    page.contentInsets = NSDirectionalEdgeInsets(top: 5, leading: 12, bottom: 5, trailing: 12)
    page.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
      var outgoing = incoming
      outgoing.font = UIFont.monospacedDigitSystemFont(ofSize: 13, weight: .semibold)
      return outgoing
    }
    pageButton.configuration = page
    pageButton.addAction(UIAction { [weak self] _ in self?.actions.askPage() }, for: .touchUpInside)

    Self.icon(searchButton, "magnifyingglass", "Search") { [weak self] in self?.setSearchVisible(true) }
    Self.icon(outlineButton, "list.bullet", "Contents") {}
    outlineButton.showsMenuAsPrimaryAction = true
    outlineButton.isHidden = true
    Self.icon(readButton, "speaker.wave.2", "Read aloud") { [weak self] in self?.actions.toggleReadAloud() }
    var playlist = Self.iconConfiguration("list.bullet")
    playlist.imagePadding = 4
    playlist.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
      var outgoing = incoming
      outgoing.font = UIFont.monospacedDigitSystemFont(ofSize: 12, weight: .semibold)
      return outgoing
    }
    playlistButton.configuration = playlist
    playlistButton.isHidden = true
    playlistButton.addAction(UIAction { [weak self] _ in self?.actions.openPlaylist() }, for: .touchUpInside)
    Self.icon(fullscreenButton, "arrow.up.left.and.arrow.down.right", "Fullscreen") { [weak self] in self?.actions.toggleFullscreen() }
    Self.icon(moreButton, "ellipsis.circle", "More") {}
    moreButton.showsMenuAsPrimaryAction = true
    refreshMore()

    let spacer = UIView()
    spacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
    [thumbnailsButton, pageButton, spacer, playlistButton, readButton, searchButton, outlineButton, fullscreenButton, moreButton].forEach(normalBar.addArrangedSubview)
    normalBar.setCustomSpacing(8, after: thumbnailsButton)
    normalBar.alignment = .center
  }

  /// The "more" menu: voice, night mode, fit width / page and share (rebuilt when a state changes).
  func refreshMore() {
    let fit = actions.currentFit()
    moreButton.menu = UIMenu(children: voiceMenu() + [
      UIAction(title: "Night mode", image: UIImage(systemName: "moon"), state: nightMode ? .on : .off) { [weak self] _ in self?.actions.toggleNight() },
      UIAction(title: "Horizontal pages", image: UIImage(systemName: "rectangle.split.2x1"), state: actions.currentDirection() == "horizontal" ? .on : .off) { [weak self] _ in
        self?.actions.toggleDirection()
        self?.refreshMore()
      },
      UIMenu(options: .displayInline, children: [
        UIAction(title: "Fit width", image: UIImage(systemName: "arrow.left.and.right"), state: fit == "width" ? .on : .off) { [weak self] _ in self?.selectFit("width") },
        UIAction(title: "Fit page", image: UIImage(systemName: "arrow.up.and.down.and.arrow.left.and.right"), state: fit == "page" ? .on : .off) { [weak self] _ in self?.selectFit("page") },
      ]),
      UIAction(title: "Share", image: UIImage(systemName: "square.and.arrow.up")) { [weak self] _ in
        guard let self else { return }
        self.actions.share(self.moreButton)
      },
    ])
  }

  /// "Voice" submenu: Automatic (the most natural) and every installed voice of the language.
  private func voiceMenu() -> [UIMenuElement] {
    let voices = actions.voices()
    guard !voices.isEmpty else { return [] }
    let current = actions.currentVoice()
    let automatic = UIAction(title: "Automatic (most natural)", state: current == nil ? .on : .off) { [weak self] _ in self?.pickVoice(nil) }
    let items = voices.map { voice in
      UIAction(title: voice.label, state: current == voice.id ? .on : .off) { [weak self] _ in self?.pickVoice(voice.id) }
    }
    return [UIMenu(title: "Voice", image: UIImage(systemName: "person.wave.2"), children: [automatic] + items)]
  }

  private func pickVoice(_ id: String?) {
    actions.selectVoice(id)
    refreshMore()
  }

  private func selectFit(_ value: String) {
    actions.setFit(value)
    refreshMore()
  }

  private func configureSearchBar() {
    field.placeholder = "Search"
    field.returnKeyType = .search
    field.autocorrectionType = .no
    field.autocapitalizationType = .none
    field.delegate = self
    field.addTarget(self, action: #selector(textChanged), for: .editingChanged)
    field.setContentHuggingPriority(.defaultLow, for: .horizontal)

    countLabel.font = UIFont.monospacedDigitSystemFont(ofSize: 12, weight: .regular)
    countLabel.textColor = .secondaryLabel
    countLabel.setContentHuggingPriority(.required, for: .horizontal)
    countLabel.setContentCompressionResistancePriority(.required, for: .horizontal)

    Self.icon(previousButton, "chevron.up", "Previous match") { [weak self] in self?.actions.previous() }
    Self.icon(nextButton, "chevron.down", "Next match") { [weak self] in self?.actions.next() }
    Self.icon(closeButton, "xmark", "Close search") { [weak self] in self?.actions.closeSearch() }
    setArrows(enabled: false)

    [field, countLabel, previousButton, nextButton, closeButton].forEach(searchBar.addArrangedSubview)
    searchBar.setCustomSpacing(8, after: field)
    searchBar.setCustomSpacing(4, after: countLabel)
    searchBar.alignment = .center
    searchBar.isHidden = true
  }

  private func layoutBars() {
    separator.backgroundColor = .separator
    [normalBar, searchBar, separator].forEach {
      $0.translatesAutoresizingMaskIntoConstraints = false
      addSubview($0)
    }
    NSLayoutConstraint.activate([
      heightAnchor.constraint(equalToConstant: 50),
      normalBar.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 6),
      normalBar.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -6),
      normalBar.centerYAnchor.constraint(equalTo: centerYAnchor),
      searchBar.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 10),
      searchBar.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -6),
      searchBar.centerYAnchor.constraint(equalTo: centerYAnchor),
      separator.leadingAnchor.constraint(equalTo: leadingAnchor),
      separator.trailingAnchor.constraint(equalTo: trailingAnchor),
      separator.bottomAnchor.constraint(equalTo: bottomAnchor),
      separator.heightAnchor.constraint(equalToConstant: 1 / UITraitCollection.current.displayScale.clamped(min: 1)),
    ])
  }
}

/// Loading spinner, error message or password prompt, over the pages.
final class IsoPdfStatusView: UIView, UITextFieldDelegate {
  enum State {
    case hidden
    case loading
    case error(String)
    case locked(wrong: Bool, submit: (String) -> Void)
  }

  private let spinner = UIActivityIndicatorView(style: .medium)
  private let icon = UIImageView(image: UIImage(systemName: "lock"))
  private let label = UILabel()
  private let field = UITextField()
  private let button = UIButton(type: .system)
  private let stack = UIStackView()
  private var submit: (String) -> Void = { _ in }

  override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .secondarySystemBackground
    icon.tintColor = .label
    icon.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 28, weight: .regular)
    label.font = .preferredFont(forTextStyle: .subheadline)
    label.textAlignment = .center
    label.numberOfLines = 0
    field.isSecureTextEntry = true
    field.placeholder = "Password"
    field.borderStyle = .roundedRect
    field.returnKeyType = .go
    field.delegate = self
    field.widthAnchor.constraint(equalToConstant: 240).isActive = true
    var config = UIButton.Configuration.gray()
    config.title = "Open"
    config.baseForegroundColor = .label
    config.cornerStyle = .capsule
    button.configuration = config
    button.addAction(UIAction { [weak self] _ in self?.send() }, for: .touchUpInside)

    [spinner, icon, label, field, button].forEach(stack.addArrangedSubview)
    stack.axis = .vertical
    stack.alignment = .center
    stack.spacing = 12
    stack.translatesAutoresizingMaskIntoConstraints = false
    addSubview(stack)
    NSLayoutConstraint.activate([
      stack.centerXAnchor.constraint(equalTo: centerXAnchor),
      stack.centerYAnchor.constraint(equalTo: centerYAnchor),
      stack.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor, constant: 24),
    ])
    show(.hidden)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  func show(_ state: State) {
    let parts = Self.parts(of: state)
    isHidden = parts.hidden
    spinner.isHidden = !parts.spinner
    parts.spinner ? spinner.startAnimating() : spinner.stopAnimating()
    icon.isHidden = !parts.lock
    field.isHidden = !parts.lock
    button.isHidden = !parts.lock
    label.isHidden = parts.text == nil
    label.text = parts.text
    label.textColor = parts.alert ? .systemRed : .secondaryLabel
    submit = parts.submit
    field.text = ""
    if parts.lock { field.becomeFirstResponder() }
  }

  private struct Parts {
    var hidden = false
    var spinner = false
    var lock = false
    var text: String?
    var alert = false
    var submit: (String) -> Void = { _ in }
  }

  /// What each state shows (one place, instead of branching in `show`).
  private static func parts(of state: State) -> Parts {
    switch state {
    case .hidden: return Parts(hidden: true)
    case .loading: return Parts(spinner: true)
    case let .error(message): return Parts(text: message, alert: true)
    case let .locked(wrong, submit):
      return Parts(lock: true, text: wrong ? "Wrong password. Try again." : "This document is protected.", alert: wrong, submit: submit)
    }
  }

  private func send() {
    let typed = field.text ?? ""
    field.resignFirstResponder()
    submit(typed)
  }

  func textFieldShouldReturn(_ textField: UITextField) -> Bool {
    send()
    return false
  }
}

private extension CGFloat {
  func clamped(min lower: CGFloat) -> CGFloat { Swift.max(self, lower) }
}
