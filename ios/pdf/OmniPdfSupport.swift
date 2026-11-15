import AVFoundation
import PDFKit
import UIKit

// Pieces of the iOS `Pdf` viewer that talk to PDFKit. They stay internal (not
// `public`/`@objc`), so the generated `omnistyle-Swift.h`, shared with the
// video and audio shells, never mentions PDFKit types.

// MARK: - Night mode

/// A page that can draw itself with inverted colors. PDFKit creates the pages, so the
/// document delegate hands out this class; whether a document is "night" lives here.
final class OmniPdfPage: PDFPage {
  private static let night = NSHashTable<PDFDocument>.weakObjects()

  /// Turns night mode on or off for every page of `document` (redraw afterwards).
  static func setNight(_ on: Bool, for document: PDFDocument) {
    on ? night.add(document) : night.remove(document)
  }

  override func draw(with box: PDFDisplayBox, to context: CGContext) {
    super.draw(with: box, to: context)
    guard let document, Self.night.contains(document) else { return }
    // white − color = inverted color, drawn over the page that was just painted
    context.saveGState()
    context.setBlendMode(.difference)
    context.setFillColor(UIColor.white.cgColor)
    context.fill(bounds(for: box))
    context.restoreGState()
  }
}

// MARK: - Search

/// Finds text asynchronously (`beginFindString`) and reports all matches at the end.
/// Also gives PDFKit the page class above.
final class OmniPdfFinder: NSObject, PDFDocumentDelegate {
  private var found: [PDFSelection] = []
  private var completion: (([PDFSelection]) -> Void)?

  /// Starts a search on `document`, cancelling the previous one.
  func find(_ query: String, in document: PDFDocument, completion: @escaping ([PDFSelection]) -> Void) {
    document.cancelFindString()
    found = []
    self.completion = completion
    document.beginFindString(query, withOptions: [.caseInsensitive, .diacriticInsensitive])
  }

  /// Stops a search in progress without reporting it.
  func cancel(in document: PDFDocument?) {
    completion = nil
    document?.cancelFindString()
  }

  func classForPage() -> AnyClass {
    OmniPdfPage.self
  }

  func didMatchString(_ instance: PDFSelection) {
    found.append(instance)
  }

  func documentDidEndDocumentFind(_ notification: Notification) {
    let done = completion
    completion = nil
    done?(found)
  }
}

// MARK: - Links

/// Lets the app know about website links before they open.
final class OmniPdfLinks: NSObject, PDFViewDelegate {
  var onLink: (URL) -> Void = { _ in }

  func pdfViewWillClick(onLink sender: PDFView, with url: URL) {
    onLink(url)
    UIApplication.shared.open(url)
  }
}

// MARK: - Table of contents

enum OmniPdfOutline {
  /// The outline as a menu (up to three levels), or `nil` when the document has none.
  static func menu(for document: PDFDocument, open: @escaping (PDFDestination) -> Void) -> UIMenu? {
    guard let root = document.outlineRoot, root.numberOfChildren > 0 else { return nil }
    return UIMenu(title: "Contents", children: children(of: root, depth: 0, open: open))
  }

  private static func children(of outline: PDFOutline, depth: Int, open: @escaping (PDFDestination) -> Void) -> [UIMenuElement] {
    (0..<outline.numberOfChildren).compactMap { outline.child(at: $0) }.map { item in
      element(for: item, depth: depth, open: open)
    }
  }

  private static func element(for item: PDFOutline, depth: Int, open: @escaping (PDFDestination) -> Void) -> UIMenuElement {
    let title = item.label ?? "—"
    let action = UIAction(title: title, subtitle: pageLabel(item)) { _ in
      item.destination.map(open)
    }
    guard depth < 2, item.numberOfChildren > 0 else { return action }
    return UIMenu(title: title, children: [action] + children(of: item, depth: depth + 1, open: open))
  }

  private static func pageLabel(_ item: PDFOutline) -> String? {
    guard let page = item.destination?.page, let document = page.document else { return nil }
    return "Page \(document.index(for: page) + 1)"
  }
}

// MARK: - Helpers

extension UIView {
  /// The view controller that shows this view (to present alerts and the share sheet).
  var omniViewController: UIViewController? {
    sequence(first: next) { $0?.next }.lazy.compactMap { $0 as? UIViewController }.first
  }
}

// MARK: - Read aloud

/// Reads the pages aloud with the system voice (`AVSpeechSynthesizer`), one page per
/// utterance, from a starting page to the end. It reports each word being spoken
/// (to highlight it) and each new page (to scroll to it).
final class OmniPdfReader: NSObject, AVSpeechSynthesizerDelegate {
  /// Called with the page being read and the range of the word inside that page's text.
  var onWord: (PDFPage, NSRange) -> Void = { _, _ in }
  /// Called when a new page starts being read.
  var onPage: (PDFPage) -> Void = { _ in }
  /// Called with `true` when reading starts and `false` when it stops or ends.
  var onChange: (Bool) -> Void = { _ in }
  /// BCP 47 language of the voice (`nil` = the device language).
  var language: String?
  /// Voice chosen by the app or the user (`AVSpeechSynthesisVoice.identifier`; `nil` = the most natural one).
  var voiceIdentifier: String?

  /// A new synthesizer for every reading: after `stopSpeaking`, a reused one sometimes stays silent.
  private var synthesizer = AVSpeechSynthesizer()
  private weak var document: PDFDocument?
  private var index = 0
  private var page: PDFPage?

  override init() {
    super.init()
    synthesizer.delegate = self
  }

  /**
   * The voice uses the app's audio session, set for spoken audio: it speaks with the
   * silent switch on, lowers other apps' sound meanwhile, and is not muted by a
   * session the video/audio players left in exclusive playback.
   */
  private static func prepareSession() {
    let session = AVAudioSession.sharedInstance()
    try? session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
    try? session.setActive(true)
  }

  /// Gives the sound back to other apps (only when nothing of ours is playing).
  private static func releaseSession() {
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }

  var isReading: Bool { document != nil }

  /// Starts reading `document` at page `start` (from `0`).
  func start(_ document: PDFDocument, at start: Int) {
    stop()
    synthesizer.delegate = nil
    synthesizer = AVSpeechSynthesizer()
    synthesizer.delegate = self
    Self.prepareSession()
    self.document = document
    index = start
    onChange(true)
    speakNextPage()
  }

  func stop() {
    guard document != nil else { return }
    document = nil
    page = nil
    synthesizer.stopSpeaking(at: .immediate)
    Self.releaseSession()
    onChange(false)
  }

  /// Speaks the next page with text (pages without text, like scans, are skipped).
  private func speakNextPage() {
    guard let document else { return }
    while index < document.pageCount {
      defer { index += 1 }
      guard let next = document.page(at: index), let text = next.string, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { continue }
      page = next
      onPage(next)
      let utterance = AVSpeechUtterance(string: text)
      let chosen = voiceIdentifier.flatMap(AVSpeechSynthesisVoice.init(identifier:))
      utterance.voice = chosen ?? Self.bestVoice(for: language ?? AVSpeechSynthesisVoice.currentLanguageCode())
      synthesizer.speak(utterance)
      return
    }
    stop()
  }

  /// The most natural installed voice for `language`: Premium (iOS 16+), then Enhanced, then the
  /// default one. Better voices are downloaded in Settings › Accessibility › Spoken Content › Voices.
  static func bestVoice(for language: String) -> AVSpeechSynthesisVoice? {
    voices(for: language).first ?? AVSpeechSynthesisVoice(language: language)
  }

  /// Installed voices of `language` (exact region first, else same language), most natural first.
  static func voices(for language: String) -> [AVSpeechSynthesisVoice] {
    let base = language.split(separator: "-").first.map(String.init) ?? language
    let candidates = AVSpeechSynthesisVoice.speechVoices().filter { $0.language == language }
    let fallback = AVSpeechSynthesisVoice.speechVoices().filter { $0.language.hasPrefix(base) }
    let pool = candidates.isEmpty ? fallback : candidates
    return pool.filter { qualityRank($0) >= 0 }.sorted { qualityRank($0) > qualityRank($1) }
  }

  /// The voices the user can pick, for the current language: (identifier, "Luciana · Premium").
  var choices: [(id: String, label: String)] {
    Self.voices(for: language ?? AVSpeechSynthesisVoice.currentLanguageCode()).map { voice in
      (voice.identifier, voice.name + Self.qualityLabel(voice))
    }
  }

  private static func qualityLabel(_ voice: AVSpeechSynthesisVoice) -> String {
    let rank = qualityRank(voice)
    return [3: " · Premium", 2: " · Enhanced"][rank] ?? ""
  }

  /// Higher is more natural (novelty voices such as "Bells" or "Zarvox" rank lowest).
  private static func qualityRank(_ voice: AVSpeechSynthesisVoice) -> Int {
    if #available(iOS 17.0, *), voice.voiceTraits.contains(.isNoveltyVoice) { return -1 }
    if #available(iOS 16.0, *), voice.quality == .premium { return 3 }
    return voice.quality == .enhanced ? 2 : 1
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, willSpeakRangeOfSpeechString characterRange: NSRange, utterance: AVSpeechUtterance) {
    page.map { onWord($0, characterRange) }
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
    speakNextPage()
  }
}
