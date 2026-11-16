import UIKit

/// A spinning wheel of labels (the time, the day, the month…).
///
/// A real `UIScrollView`, so inside a React Native scroll view the wheel keeps its own
/// vertical drags (nested scroll views hand them to the innermost one). It snaps to a row,
/// skips disabled rows, fades and shrinks rows away from the center and ticks on each row.
/// The Android wheel (`OmniWheel` in `OmniDatePickerUi.kt`) follows the same numbers.
final class OmniWheelView: UIView, UIScrollViewDelegate {
  /// Height of one row (the highlight behind the wheels uses the same).
  static let rowHeight: CGFloat = 36
  /// Rows shown at once (odd: the middle one is the selection).
  static let visibleRows = 5

  var onSelect: ((Int) -> Void)?

  private let scroll = UIScrollView()
  private var labels: [UILabel] = []
  private var items: [String] = []
  private var enabled: [Bool] = []
  private var selected = 0
  private var textColor = UIColor.label
  private var disabledColor = UIColor.tertiaryLabel
  private var font = UIFont.systemFont(ofSize: 20)
  private var lastTick = -1
  private let haptics = UISelectionFeedbackGenerator()

  override init(frame: CGRect) {
    super.init(frame: frame)
    scroll.delegate = self
    scroll.showsVerticalScrollIndicator = false
    scroll.showsHorizontalScrollIndicator = false
    scroll.decelerationRate = .fast
    scroll.contentInsetAdjustmentBehavior = .never
    scroll.scrollsToTop = false
    scroll.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(tapped(_:))))
    addSubview(scroll)
    isAccessibilityElement = true
    accessibilityTraits = .adjustable
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

  private var rowHeight: CGFloat { Self.rowHeight }

  /// Content offset that puts row `index` in the middle.
  private func offset(for index: Int) -> CGFloat { CGFloat(index) * rowHeight - scroll.contentInset.top }

  /// Row under the middle for a content offset.
  private func index(at offsetY: CGFloat) -> Int {
    guard !items.isEmpty else { return 0 }
    let raw = Int(((offsetY + scroll.contentInset.top) / rowHeight).rounded())
    return min(max(raw, 0), items.count - 1)
  }

  /// The closest row that can be picked.
  private func nearestEnabled(_ index: Int) -> Int {
    guard enabled.indices.contains(index), !enabled[index] else { return index }
    for distance in 1..<max(items.count, 1) {
      if enabled.indices.contains(index - distance), enabled[index - distance] { return index - distance }
      if enabled.indices.contains(index + distance), enabled[index + distance] { return index + distance }
    }
    return index
  }

  private var interacting: Bool { scroll.isTracking || scroll.isDragging || scroll.isDecelerating }

  func update(items: [String], enabled: [Bool], selected: Int, textColor: UIColor, disabledColor: UIColor, font: UIFont) {
    let rebuilt = items != self.items
    self.items = items
    self.enabled = enabled.count == items.count ? enabled : Array(repeating: true, count: items.count)
    self.textColor = textColor
    self.disabledColor = disabledColor
    self.font = font
    if rebuilt { rebuildLabels() }
    accessibilityValue = items.indices.contains(selected) ? items[selected] : nil

    let target = min(max(selected, 0), max(items.count - 1, 0))
    if target != self.selected || rebuilt {
      self.selected = target
      if !interacting {
        scroll.setContentOffset(CGPoint(x: 0, y: offset(for: target)), animated: window != nil && !rebuilt)
      }
    }
    restyle()
  }

  private func rebuildLabels() {
    labels.forEach { $0.removeFromSuperview() }
    labels = items.map { text in
      let label = UILabel()
      label.text = text
      label.textAlignment = .center
      label.adjustsFontSizeToFitWidth = true
      label.minimumScaleFactor = 0.7
      scroll.addSubview(label)
      return label
    }
    setNeedsLayout()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    scroll.frame = bounds
    let inset = (bounds.height - rowHeight) / 2
    scroll.contentInset = UIEdgeInsets(top: inset, left: 0, bottom: inset, right: 0)
    scroll.contentSize = CGSize(width: bounds.width, height: CGFloat(items.count) * rowHeight)
    for (row, label) in labels.enumerated() {
      label.frame = CGRect(x: 4, y: CGFloat(row) * rowHeight, width: bounds.width - 8, height: rowHeight)
    }
    if !interacting { scroll.contentOffset = CGPoint(x: 0, y: offset(for: selected)) }
    restyle()
  }

  /// Rows away from the middle fade and shrink, like a drum seen from the front.
  private func restyle() {
    let middle = scroll.contentOffset.y + scroll.contentInset.top + rowHeight / 2
    for (row, label) in labels.enumerated() {
      let distance = abs(label.center.y - middle) / rowHeight
      label.font = font
      label.textColor = enabled.indices.contains(row) && !enabled[row] ? disabledColor : textColor
      label.alpha = max(0.2, 1 - distance * 0.3)
      let scale = max(0.75, 1 - distance * 0.07)
      label.transform = CGAffineTransform(scaleX: scale, y: scale)
    }
  }

  // MARK: - Scrolling

  func scrollViewDidScroll(_ scrollView: UIScrollView) {
    restyle()
    guard interacting else { return }
    let row = index(at: scrollView.contentOffset.y)
    if row != lastTick {
      lastTick = row
      haptics.selectionChanged()
    }
  }

  func scrollViewWillBeginDragging(_ scrollView: UIScrollView) {
    haptics.prepare()
    lastTick = index(at: scrollView.contentOffset.y)
  }

  func scrollViewWillEndDragging(_ scrollView: UIScrollView, withVelocity velocity: CGPoint, targetContentOffset: UnsafeMutablePointer<CGPoint>) {
    targetContentOffset.pointee.y = offset(for: nearestEnabled(index(at: targetContentOffset.pointee.y)))
  }

  func scrollViewDidEndDragging(_ scrollView: UIScrollView, willDecelerate decelerate: Bool) {
    if !decelerate { settle() }
  }

  func scrollViewDidEndDecelerating(_ scrollView: UIScrollView) { settle() }

  /// Snaps to the row in the middle and reports it.
  private func settle() {
    let row = nearestEnabled(index(at: scroll.contentOffset.y))
    let rest = offset(for: row)
    if abs(scroll.contentOffset.y - rest) > 0.5 { scroll.setContentOffset(CGPoint(x: 0, y: rest), animated: true) }
    choose(row)
  }

  private func choose(_ row: Int) {
    guard row != selected else { return }
    selected = row
    accessibilityValue = items.indices.contains(row) ? items[row] : nil
    onSelect?(row)
  }

  @objc private func tapped(_ gesture: UITapGestureRecognizer) {
    let row = Int(gesture.location(in: scroll).y / rowHeight)
    guard items.indices.contains(row), enabled[row] else { return }
    haptics.selectionChanged()
    scroll.setContentOffset(CGPoint(x: 0, y: offset(for: row)), animated: true)
    choose(row)
  }

  // MARK: - VoiceOver

  override func accessibilityIncrement() { step(1) }
  override func accessibilityDecrement() { step(-1) }

  private func step(_ delta: Int) {
    var row = selected + delta
    while enabled.indices.contains(row), !enabled[row] { row += delta }
    guard items.indices.contains(row) else { return }
    scroll.setContentOffset(CGPoint(x: 0, y: offset(for: row)), animated: true)
    choose(row)
  }
}
