import SwiftUI
import UIKit

/// Events of the sheet, sent to the Fabric shell (`OmniSheetView.mm`) and from there to JS.
@objc public protocol OmniSheetHostDelegate: AnyObject {
  /// Size of the content area; the React children are laid out to it.
  func sheetDidLayout(width: Double, height: Double)
  /// The user closed the sheet (drag down or tap outside).
  func sheetDidDismiss()
  /// The closing animation ended.
  func sheetDidClose()
  /// The user moved the sheet to the detent at `index` (index in the JS `detents`).
  func sheetDidChangeDetent(index: Int)
}

/// The view the React children are moved into. It reports its size, so JS can lay them out to the sheet.
final class OmniSheetContainer: UIView {
  var onLayout: ((CGSize) -> Void)?
  private var reported = CGSize.zero

  override func layoutSubviews() {
    super.layoutSubviews()
    let size = bounds.size
    guard size.width > 0, size.height > 0, abs(size.width - reported.width) > 0.5 || abs(size.height - reported.height) > 0.5 else { return }
    reported = size
    onLayout?(size)
  }
}

/// One rest height, as JS sends it: `fit`, `full`, `50%` or a number of points.
enum OmniSheetDetent: Equatable {
  case fit
  case full
  case fraction(CGFloat)
  case height(CGFloat)

  init(_ raw: String) {
    switch raw {
    case "fit": self = .fit
    case "full": self = .full
    case let text where text.hasSuffix("%"): self = .fraction(CGFloat(Double(text.dropLast()) ?? 100) / 100)
    default: self = .height(CGFloat(Double(raw) ?? 0))
    }
  }

  /// The SwiftUI detent (`fit` uses the measured content height).
  @available(iOS 16.0, *)
  func presentation(content: CGFloat) -> PresentationDetent {
    switch self {
    case .fit: return .height(max(content, 1))
    case .full: return .large
    case .fraction(let value): return value >= 1 ? .large : .fraction(max(value, 0.05))
    case .height(let value): return .height(max(value, 1))
    }
  }
}

/// State of one sheet, shared by the SwiftUI views and the Fabric shell.
final class OmniSheetModel: ObservableObject {
  /// Whether SwiftUI shows the sheet. Set by us, and set to `false` by SwiftUI when the user dismisses it.
  @Published var presented = false {
    didSet {
      // SwiftUI closed it while JS still wants it open: the user dismissed it
      if oldValue, !presented, wantsOpen { onUserDismiss?() }
    }
  }
  @Published var detents: [OmniSheetDetent] = [.fit]
  @Published var index = 0
  @Published var contentHeight: CGFloat = 0
  @Published var dismissible = true
  @Published var modal = true
  @Published var grabber = true
  @Published var color: UIColor?
  @Published var cornerRadius: CGFloat = -1

  /// What JS asked for (`open`).
  var wantsOpen = false
  /// The anchor is in a window, so SwiftUI can present.
  var attached = false
  let content = OmniSheetContainer()
  var onUserDismiss: (() -> Void)?
  var onClosed: (() -> Void)?
  var onDetent: ((Int) -> Void)?

  /// `fit` needs the content measured first, or the sheet would open at the wrong height.
  private var ready: Bool { !detents.contains(.fit) || contentHeight > 0 }

  /// Presents or dismisses to match what JS asked for.
  func sync() {
    let next = wantsOpen && attached && ready
    if next != presented { presented = next }
  }

  @available(iOS 16.0, *)
  var presentationDetents: [PresentationDetent] { detents.map { $0.presentation(content: contentHeight) } }

  /// The selected detent, as a binding SwiftUI updates when the user drags.
  @available(iOS 16.0, *)
  var selection: Binding<PresentationDetent> {
    Binding(
      get: { [self] in
        let all = presentationDetents
        return all.indices.contains(index) ? all[index] : (all.first ?? .large)
      },
      set: { [self] detent in
        guard let next = presentationDetents.firstIndex(of: detent), next != index else { return }
        index = next
        onDetent?(next)
      }
    )
  }
}

/// The React children inside SwiftUI.
struct OmniSheetContent: UIViewRepresentable {
  let view: UIView
  func makeUIView(context: Context) -> UIView { view }
  func updateUIView(_ uiView: UIView, context: Context) {}
}

/// Surface color only when JS sets one: otherwise the system background (Liquid Glass on iOS 26).
@available(iOS 16.4, *)
struct OmniSheetBackground: ViewModifier {
  let color: UIColor?
  func body(content: Content) -> some View {
    if let color {
      content.presentationBackground(Color(uiColor: color))
    } else {
      content
    }
  }
}

/// Sheet configuration, using the newest presentation APIs the system has.
struct OmniSheetPresentation: ViewModifier {
  @ObservedObject var model: OmniSheetModel

  func body(content: Content) -> some View {
    if #available(iOS 16.4, *) {
      content
        .presentationDetents(Set(model.presentationDetents), selection: model.selection)
        .presentationDragIndicator(model.grabber ? .visible : .hidden)
        // modal: dimmed and blocked behind; otherwise the screen behind stays usable
        .presentationBackgroundInteraction(model.modal ? .disabled : .enabled)
        .presentationCornerRadius(model.cornerRadius >= 0 ? model.cornerRadius : nil)
        .modifier(OmniSheetBackground(color: model.color))
        .interactiveDismissDisabled(!model.dismissible)
    } else if #available(iOS 16.0, *) {
      content
        .presentationDetents(Set(model.presentationDetents), selection: model.selection)
        .presentationDragIndicator(model.grabber ? .visible : .hidden)
        .interactiveDismissDisabled(!model.dismissible)
    } else {
      // iOS 15: a full-height sheet
      content.interactiveDismissDisabled(!model.dismissible)
    }
  }
}

/// Invisible view that owns the `.sheet` presentation.
struct OmniSheetAnchor: View {
  @ObservedObject var model: OmniSheetModel

  var body: some View {
    Color.clear
      .sheet(isPresented: $model.presented, onDismiss: { model.onClosed?() }) {
        OmniSheetContent(view: model.content)
          // a plain UIView has no size of its own: take the whole sheet, or the children get no area
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .modifier(OmniSheetPresentation(model: model))
      }
  }
}

/// Bridge for the Fabric shell: owns the model, the content view and the SwiftUI host.
@objc public final class OmniSheetHost: NSObject {
  @objc public weak var delegate: OmniSheetHostDelegate?
  private let model = OmniSheetModel()
  private var host: UIHostingController<OmniSheetAnchor>?

  /// Where Fabric mounts the React children.
  @objc public var contentView: UIView { model.content }

  @objc public override init() {
    super.init()
    model.content.backgroundColor = .clear
    model.content.onLayout = { [weak self] size in self?.delegate?.sheetDidLayout(width: Double(size.width), height: Double(size.height)) }
    model.onUserDismiss = { [weak self] in self?.delegate?.sheetDidDismiss() }
    model.onClosed = { [weak self] in self?.delegate?.sheetDidClose() }
    model.onDetent = { [weak self] index in self?.delegate?.sheetDidChangeDetent(index: index) }
  }

  @objc public func setOpen(_ open: Bool) {
    model.wantsOpen = open
    model.sync()
  }

  @objc public func setDetents(_ raw: [String]) {
    let next = (raw.isEmpty ? ["fit"] : raw).map(OmniSheetDetent.init)
    if next != model.detents { model.detents = next }
    model.sync()
  }

  @objc public func setDetent(_ index: Int) {
    if index != model.index { model.index = index }
  }

  @objc public func setContentHeight(_ height: Double) {
    let value = CGFloat(height)
    if abs(value - model.contentHeight) > 0.5 { model.contentHeight = value }
    model.sync()
  }

  @objc public func setDismissible(_ value: Bool) { if value != model.dismissible { model.dismissible = value } }
  @objc public func setModal(_ value: Bool) { if value != model.modal { model.modal = value } }
  @objc public func setGrabber(_ value: Bool) { if value != model.grabber { model.grabber = value } }
  @objc public func setColor(_ value: UIColor?) { if value != model.color { model.color = value } }
  @objc public func setCornerRadius(_ value: Double) { if CGFloat(value) != model.cornerRadius { model.cornerRadius = CGFloat(value) } }

  /// Puts the invisible SwiftUI anchor under `view`'s view controller (SwiftUI presents from there).
  @objc public func attach(to view: UIView) {
    guard host == nil, let parent = Self.viewController(of: view) else { return }
    let controller = UIHostingController(rootView: OmniSheetAnchor(model: model))
    controller.view.backgroundColor = .clear
    controller.view.isUserInteractionEnabled = false
    controller.view.frame = .zero
    parent.addChild(controller)
    view.addSubview(controller.view)
    controller.didMove(toParent: parent)
    host = controller
    // present on the next turn of the run loop, once the anchor is on screen
    DispatchQueue.main.async { [weak self] in
      guard let self, self.host != nil else { return }
      self.model.attached = true
      self.model.sync()
    }
  }

  /// Dismisses the sheet and removes the anchor (the view left the window or is recycled).
  @objc public func detach() {
    model.attached = false
    model.wantsOpen = false
    model.presented = false
    guard let controller = host else { return }
    controller.willMove(toParent: nil)
    controller.view.removeFromSuperview()
    controller.removeFromParent()
    host = nil
  }

  private static func viewController(of view: UIView) -> UIViewController? {
    var responder: UIResponder? = view
    while let next = responder?.next {
      if let controller = next as? UIViewController { return controller }
      responder = next
    }
    return view.window?.rootViewController
  }
}
