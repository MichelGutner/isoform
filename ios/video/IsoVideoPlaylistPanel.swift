import UIKit

/// The carousel of a video list, drawn natively for the fullscreen (where the React
/// Native panel cannot reach). Same look as the JS one: a dark glass panel over the
/// lower part of the video; the card in the middle is full size and outlined, its
/// neighbors shrink and fade with the distance; the scroll snaps to a card and the
/// card it stops on becomes the selected entry; tapping a card picks it and closes.
final class IsoVideoPlaylistPanel: UIView, UICollectionViewDataSource, UICollectionViewDelegate {
  /// One entry: its title and image address (empty = a play symbol).
  struct Item: Decodable {
    let title: String
    let image: String
  }

  /// An entry was picked (tap, or the scroll stopped on it).
  var onSelect: (Int) -> Void = { _ in }
  /// The panel closed itself (close button or a tapped card).
  var onClose: () -> Void = {}

  private(set) var items: [Item] = []
  private var index = 0
  private var focus = 0
  private var dragged = false

  private let glass = UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterialDark))
  private let titleLabel = UILabel()
  private let countLabel = UILabel()
  private let closeButton = UIButton(type: .system)
  private let layout = IsoCarouselLayout()
  private lazy var collection = UICollectionView(frame: .zero, collectionViewLayout: layout)

  override init(frame: CGRect) {
    super.init(frame: frame)
    overrideUserInterfaceStyle = .dark
    tintAdjustmentMode = .normal
    build()
    isHidden = true
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  // MARK: - Data

  /// The entries, from the `playlistItems` JSON (`[{ "title", "image" }]`).
  func set(json: String) {
    let parsed = (try? JSONDecoder().decode([Item].self, from: Data(json.utf8))) ?? []
    guard parsed.map(\.title) != items.map(\.title) || parsed.map(\.image) != items.map(\.image) else { return }
    items = parsed
    collection.reloadData()
    refreshHeader()
  }

  /// The entry that is on.
  func set(index: Int) {
    self.index = max(0, index)
    focus = self.index
    refreshHeader()
    guard !isHidden else { return }
    scroll(to: self.index, animated: true)
  }

  // MARK: - Showing

  func show() {
    guard !items.isEmpty, isHidden else { return }
    isHidden = false
    layoutIfNeeded()
    collection.reloadData()
    collection.layoutIfNeeded()
    scroll(to: index, animated: false)
    transform = CGAffineTransform(translationX: 0, y: 30)
    alpha = 0
    UIView.animate(withDuration: 0.28, delay: 0, usingSpringWithDamping: 0.9, initialSpringVelocity: 0) {
      self.transform = .identity
      self.alpha = 1
    }
  }

  func hide() {
    guard !isHidden else { return }
    UIView.animate(withDuration: 0.2, animations: { self.alpha = 0 }) { _ in
      self.isHidden = true
      self.alpha = 1
    }
  }

  // MARK: - Carousel

  private func scroll(to item: Int, animated: Bool) {
    guard item < items.count else { return }
    collection.scrollToItem(at: IndexPath(item: item, section: 0), at: .centeredHorizontally, animated: animated)
  }

  /// The card closest to the middle of the carousel.
  private func centered() -> Int {
    let middle = collection.contentOffset.x + collection.bounds.width / 2
    let visible = collection.indexPathsForVisibleItems.compactMap { path in
      collection.layoutAttributesForItem(at: path).map { (path.item, abs($0.center.x - middle)) }
    }
    return visible.min { $0.1 < $1.1 }?.0 ?? index
  }

  private func refreshHeader() {
    titleLabel.text = items.indices.contains(focus) ? items[focus].title : ""
    countLabel.text = items.isEmpty ? "" : "\(focus + 1) / \(items.count)"
    collection.visibleCells.compactMap { $0 as? IsoCarouselCell }.forEach { cell in
      guard let path = collection.indexPath(for: cell) else { return }
      cell.set(focused: path.item == focus, current: path.item == index)
    }
  }

  func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int { items.count }

  func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
    let cell = collectionView.dequeueReusableCell(withReuseIdentifier: IsoCarouselCell.id, for: indexPath) as! IsoCarouselCell
    cell.configure(items[indexPath.item])
    cell.set(focused: indexPath.item == focus, current: indexPath.item == index)
    return cell
  }

  func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
    onSelect(indexPath.item)
    hide()
    onClose()
  }

  func scrollViewWillBeginDragging(_ scrollView: UIScrollView) {
    dragged = true
  }

  /// Live highlight: the card in the middle while scrolling.
  func scrollViewDidScroll(_ scrollView: UIScrollView) {
    let middle = centered()
    guard middle != focus else { return }
    focus = middle
    refreshHeader()
  }

  /// The card the user's scroll stops on becomes the entry.
  func scrollViewDidEndDecelerating(_ scrollView: UIScrollView) {
    settle()
  }

  func scrollViewDidEndDragging(_ scrollView: UIScrollView, willDecelerate decelerate: Bool) {
    if !decelerate { settle() }
  }

  private func settle() {
    guard dragged else { return }
    dragged = false
    let middle = centered()
    if middle != index { onSelect(middle) }
  }

  // MARK: - Building

  private func build() {
    glass.layer.cornerRadius = 22
    glass.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
    glass.clipsToBounds = true
    glass.translatesAutoresizingMaskIntoConstraints = false
    addSubview(glass)

    titleLabel.font = .systemFont(ofSize: 14, weight: .semibold)
    titleLabel.textColor = .white
    countLabel.font = .monospacedDigitSystemFont(ofSize: 13, weight: .regular)
    countLabel.textColor = UIColor.white.withAlphaComponent(0.6)
    countLabel.setContentHuggingPriority(.required, for: .horizontal)
    var close = UIButton.Configuration.plain()
    close.image = UIImage(systemName: "xmark")
    close.preferredSymbolConfigurationForImage = UIImage.SymbolConfiguration(pointSize: 13, weight: .bold)
    close.baseForegroundColor = .white
    close.background.backgroundColor = UIColor.white.withAlphaComponent(0.14)
    close.cornerStyle = .capsule
    closeButton.configuration = close
    closeButton.accessibilityLabel = "Close playlist"
    closeButton.addAction(UIAction { [weak self] _ in
      self?.hide()
      self?.onClose()
    }, for: .touchUpInside)

    let head = UIStackView(arrangedSubviews: [titleLabel, countLabel, UIView(), closeButton])
    head.spacing = 8
    head.alignment = .center
    head.translatesAutoresizingMaskIntoConstraints = false
    addSubview(head)

    collection.backgroundColor = .clear
    collection.showsHorizontalScrollIndicator = false
    collection.decelerationRate = .fast
    collection.dataSource = self
    collection.delegate = self
    collection.register(IsoCarouselCell.self, forCellWithReuseIdentifier: IsoCarouselCell.id)
    collection.translatesAutoresizingMaskIntoConstraints = false
    addSubview(collection)

    NSLayoutConstraint.activate([
      glass.leadingAnchor.constraint(equalTo: leadingAnchor),
      glass.trailingAnchor.constraint(equalTo: trailingAnchor),
      glass.topAnchor.constraint(equalTo: topAnchor),
      glass.bottomAnchor.constraint(equalTo: bottomAnchor),
      head.leadingAnchor.constraint(equalTo: safeAreaLayoutGuide.leadingAnchor, constant: 18),
      head.trailingAnchor.constraint(equalTo: safeAreaLayoutGuide.trailingAnchor, constant: -12),
      head.topAnchor.constraint(equalTo: topAnchor, constant: 12),
      closeButton.widthAnchor.constraint(equalToConstant: 30),
      closeButton.heightAnchor.constraint(equalToConstant: 30),
      collection.leadingAnchor.constraint(equalTo: leadingAnchor),
      collection.trailingAnchor.constraint(equalTo: trailingAnchor),
      collection.topAnchor.constraint(equalTo: head.bottomAnchor, constant: 4),
      collection.heightAnchor.constraint(equalToConstant: 150),
      collection.bottomAnchor.constraint(equalTo: safeAreaLayoutGuide.bottomAnchor, constant: -6),
    ])
  }
}

/// Horizontal carousel: cards snap to the middle; each one is scaled and faded by its distance to it.
final class IsoCarouselLayout: UICollectionViewFlowLayout {
  override init() {
    super.init()
    scrollDirection = .horizontal
    itemSize = CGSize(width: 168, height: 140)
    minimumLineSpacing = 16
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  override func prepare() {
    super.prepare()
    guard let collectionView else { return }
    // room on both sides, so the first and the last card can sit in the middle
    let side = max(0, (collectionView.bounds.width - itemSize.width) / 2)
    sectionInset = UIEdgeInsets(top: 0, left: side, bottom: 0, right: side)
  }

  override func shouldInvalidateLayout(forBoundsChange newBounds: CGRect) -> Bool { true }

  override func layoutAttributesForElements(in rect: CGRect) -> [UICollectionViewLayoutAttributes]? {
    guard let collectionView, let attributes = super.layoutAttributesForElements(in: rect) else { return nil }
    let middle = collectionView.contentOffset.x + collectionView.bounds.width / 2
    return attributes.map { original in
      let card = original.copy() as! UICollectionViewLayoutAttributes
      let distance = min(1, abs(card.center.x - middle) / (itemSize.width + minimumLineSpacing))
      let scale = 1 - distance * 0.16
      card.transform = CGAffineTransform(scaleX: scale, y: scale)
      card.alpha = 1 - distance * 0.5
      return card
    }
  }

  /// Stops on the card nearest to where the scroll would end.
  override func targetContentOffset(forProposedContentOffset proposed: CGPoint, withScrollingVelocity velocity: CGPoint) -> CGPoint {
    guard let collectionView else { return proposed }
    let step = itemSize.width + minimumLineSpacing
    let middle = proposed.x + collectionView.bounds.width / 2
    let first = sectionInset.left + itemSize.width / 2
    let card = ((middle - first) / step).rounded()
    let count = CGFloat(max(1, collectionView.numberOfItems(inSection: 0)))
    let target = min(max(card, 0), count - 1)
    return CGPoint(x: first + target * step - collectionView.bounds.width / 2, y: proposed.y)
  }
}

/// A card: the image (or a play symbol) with a ring when focused, a "now playing" mark, and the title.
final class IsoCarouselCell: UICollectionViewCell {
  static let id = "card"
  private static let cache = NSCache<NSString, UIImage>()

  private let frameView = UIView()
  private let imageView = UIImageView()
  private let symbol = UIImageView(image: UIImage(systemName: "play.fill"))
  private let nowPlaying = UIImageView(image: UIImage(systemName: "waveform"))
  private let titleLabel = UILabel()
  private var address = ""

  override init(frame: CGRect) {
    super.init(frame: frame)
    frameView.backgroundColor = UIColor.white.withAlphaComponent(0.12)
    frameView.layer.cornerRadius = 12
    frameView.layer.cornerCurve = .continuous
    frameView.clipsToBounds = true
    frameView.layer.borderColor = UIColor.white.cgColor
    symbol.tintColor = UIColor.white.withAlphaComponent(0.6)
    symbol.contentMode = .center
    imageView.contentMode = .scaleAspectFill
    nowPlaying.tintColor = .white
    nowPlaying.backgroundColor = UIColor.black.withAlphaComponent(0.55)
    nowPlaying.contentMode = .center
    nowPlaying.layer.cornerRadius = 11
    nowPlaying.clipsToBounds = true
    titleLabel.font = .systemFont(ofSize: 12.5)
    titleLabel.textColor = UIColor.white.withAlphaComponent(0.65)
    titleLabel.numberOfLines = 2
    titleLabel.textAlignment = .center

    [frameView, titleLabel].forEach {
      $0.translatesAutoresizingMaskIntoConstraints = false
      contentView.addSubview($0)
    }
    [symbol, imageView, nowPlaying].forEach {
      $0.translatesAutoresizingMaskIntoConstraints = false
      frameView.addSubview($0)
    }
    NSLayoutConstraint.activate([
      frameView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
      frameView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
      frameView.topAnchor.constraint(equalTo: contentView.topAnchor),
      frameView.heightAnchor.constraint(equalTo: frameView.widthAnchor, multiplier: 9.0 / 16.0),
      symbol.centerXAnchor.constraint(equalTo: frameView.centerXAnchor),
      symbol.centerYAnchor.constraint(equalTo: frameView.centerYAnchor),
      imageView.leadingAnchor.constraint(equalTo: frameView.leadingAnchor),
      imageView.trailingAnchor.constraint(equalTo: frameView.trailingAnchor),
      imageView.topAnchor.constraint(equalTo: frameView.topAnchor),
      imageView.bottomAnchor.constraint(equalTo: frameView.bottomAnchor),
      nowPlaying.leadingAnchor.constraint(equalTo: frameView.leadingAnchor, constant: 8),
      nowPlaying.bottomAnchor.constraint(equalTo: frameView.bottomAnchor, constant: -8),
      nowPlaying.widthAnchor.constraint(equalToConstant: 30),
      nowPlaying.heightAnchor.constraint(equalToConstant: 22),
      titleLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
      titleLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
      titleLabel.topAnchor.constraint(equalTo: frameView.bottomAnchor, constant: 8),
    ])
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  func configure(_ item: IsoVideoPlaylistPanel.Item) {
    titleLabel.text = item.title
    accessibilityLabel = item.title
    isAccessibilityElement = true
    load(item.image)
  }

  func set(focused: Bool, current: Bool) {
    frameView.layer.borderWidth = focused ? 2.5 : 0
    titleLabel.textColor = focused ? .white : UIColor.white.withAlphaComponent(0.65)
    titleLabel.font = .systemFont(ofSize: 12.5, weight: focused ? .semibold : .regular)
    nowPlaying.isHidden = !current
    accessibilityTraits = current ? [.button, .selected] : [.button]
  }

  private func load(_ url: String) {
    address = url
    imageView.image = Self.cache.object(forKey: url as NSString)
    guard imageView.image == nil, !url.isEmpty, let link = URL(string: url) else { return }
    URLSession.shared.dataTask(with: link) { [weak self] data, _, _ in
      guard let data, let image = UIImage(data: data) else { return }
      Self.cache.setObject(image, forKey: url as NSString)
      DispatchQueue.main.async {
        guard let self, self.address == url else { return }
        self.imageView.image = image
      }
    }.resume()
  }
}
