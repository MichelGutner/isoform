import SwiftUI
import UIKit

/// Events of the picker, sent to the Fabric shell (`OmniDatePickerView.mm`) and from there to JS.
@objc public protocol OmniDatePickerHostDelegate: AnyObject {
  /// The user picked a moment (milliseconds since the epoch).
  func datePickerDidChange(value: Double)
  /// Natural size of the picker; the view is sized to it.
  func datePickerDidMeasure(width: Double, height: Double)
}

/// A limit from JS at or beyond this many milliseconds means "no limit" (the range of a JS `Date`).
private let noLimit = 8.64e15

// MARK: - Model

/// State of one picker, shared by the SwiftUI views and the Fabric shell.
final class OmniDatePickerModel: ObservableObject {
  @Published var value = Date()
  @Published var mode = "date"
  @Published var display = "inline"
  @Published var minimum: Date?
  @Published var maximum: Date?
  @Published var locale = Locale.current
  /// `auto`, `h12` or `h24`.
  @Published var hourCycle = "auto"
  @Published var tint: UIColor?
  @Published var disabled = false
  var onChange: ((Date) -> Void)?
  var onHeight: ((CGFloat) -> Void)?

  var hasDate: Bool { mode != "time" }
  var hasTime: Bool { mode != "date" }

  /// The calendar of the locale (first weekday, month names), in the device's time zone.
  var calendar: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.locale = locale
    calendar.timeZone = .current
    return calendar
  }

  var uses24Hour: Bool {
    switch hourCycle {
    case "h24": return true
    case "h12": return false
    default: return !(DateFormatter.dateFormat(fromTemplate: "j", options: 0, locale: locale) ?? "").contains("a")
    }
  }

  /// Whether any moment of the day that starts at `day` is inside the limits.
  func isEnabled(day: Date) -> Bool {
    let end = calendar.date(byAdding: .day, value: 1, to: day) ?? day
    if let minimum, end <= minimum { return false }
    if let maximum, day > maximum { return false }
    return true
  }

  /// Whether any day of the month that starts at `month` is inside the limits.
  func isEnabled(month: Date) -> Bool {
    let end = calendar.date(byAdding: .month, value: 1, to: month) ?? month
    if let minimum, end <= minimum { return false }
    if let maximum, month > maximum { return false }
    return true
  }

  /// The value with some of its parts replaced (what is not given keeps its value).
  func moment(year: Int? = nil, month: Int? = nil, day: Int? = nil, hour: Int? = nil, minute: Int? = nil) -> Date {
    let calendar = self.calendar
    var parts = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: value)
    if let year { parts.year = year }
    if let month { parts.month = month }
    if let hour { parts.hour = hour; parts.second = 0 }
    if let minute { parts.minute = minute; parts.second = 0 }
    // a day past the end of the new month becomes its last day (31 March → 30 April)
    let first = calendar.date(from: DateComponents(year: parts.year, month: parts.month, day: 1)) ?? value
    let length = calendar.range(of: .day, in: .month, for: first)?.count ?? 28
    parts.day = min(day ?? parts.day ?? 1, length)
    return calendar.date(from: parts) ?? value
  }

  /// A pick from the UI: shown at once and sent to JS (which clamps it and sends it back).
  func pick(_ date: Date) {
    guard date != value else { return }
    value = date
    onChange?(date)
  }
}

// MARK: - Look (the same numbers as Android's `OmniDatePickerUi.kt`)

/// Colors of the picker, the same on iOS and Android.
struct OmniPickerPalette {
  let accent: UIColor
  let onAccent: UIColor
  let text: UIColor
  let secondary: UIColor
  let disabled: UIColor
  let fill: UIColor
  let surface: UIColor

  init(dark: Bool, tint: UIColor?) {
    accent = tint ?? UIColor(hex: dark ? 0x0A84FF : 0x007AFF)
    onAccent = .white
    text = UIColor(hex: dark ? 0xF2F2F7 : 0x111111)
    secondary = UIColor(hex: dark ? 0x98989F : 0x8A8A8E)
    disabled = UIColor(hex: dark ? 0x48484A : 0xC7C7CC)
    fill = UIColor(hex: dark ? 0x2C2C2E : 0xF2F2F7)
    surface = UIColor(hex: dark ? 0x1C1C1E : 0xFFFFFF)
  }
}

extension UIColor {
  convenience init(hex: UInt32) {
    self.init(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
  }
}

private extension Color {
  init(_ color: UIColor) { self.init(uiColor: color) }
}

/// Sizes shared by both platforms.
private enum Metric {
  static let day: CGFloat = 40
  static let dayRow: CGFloat = 44
  static let wheelHeight = OmniWheelView.rowHeight * CGFloat(OmniWheelView.visibleRows)
  static let radius: CGFloat = 10
  static let padding: CGFloat = 12
}

// MARK: - Text in the picker's language

/// Labels of the picker in its locale (month and weekday names, formatted values).
struct OmniPickerText {
  let calendar: Calendar
  let locale: Locale
  let uses24Hour: Bool

  init(model: OmniDatePickerModel) {
    calendar = model.calendar
    locale = model.locale
    uses24Hour = model.uses24Hour
  }

  private func format(_ template: String, _ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = locale
    formatter.calendar = calendar
    formatter.setLocalizedDateFormatFromTemplate(template)
    return formatter.string(from: date)
  }

  /// "November 2026" / "novembro de 2026".
  func monthTitle(_ month: Date) -> String { format("yMMMM", month).capitalizedFirst(locale) }
  /// "16 Nov 2026" / "16 de nov. de 2026".
  func date(_ date: Date) -> String { format("yMMMd", date) }
  /// "Mon, 16 November" (a line above the time in `datetime`).
  func longDate(_ date: Date) -> String { format("EEEEdMMMM", date).capitalizedFirst(locale) }
  /// "14:05" / "2:05 PM".
  func time(_ date: Date) -> String { format(uses24Hour ? "HHmm" : "hmma", date) }
  /// Full date for VoiceOver.
  func spoken(_ date: Date) -> String { format("yMMMMEEEEd", date) }

  /// Narrow weekday names starting on the locale's first weekday ("S M T W T F S").
  var weekdays: [String] {
    let symbols = calendar.veryShortStandaloneWeekdaySymbols
    return (0..<7).map { symbols[(calendar.firstWeekday - 1 + $0) % 7] }
  }

  var shortMonths: [String] { calendar.shortStandaloneMonthSymbols.map { $0.capitalizedFirst(locale) } }
  var months: [String] { calendar.standaloneMonthSymbols.map { $0.capitalizedFirst(locale) } }
  var amPm: [String] { [calendar.amSymbol, calendar.pmSymbol] }

  /// Order of day, month and year in the locale ("dMy", "Mdy", "yMd").
  var dateOrder: [Character] {
    let pattern = DateFormatter.dateFormat(fromTemplate: "yMMMMd", options: 0, locale: locale) ?? "dMy"
    var order: [Character] = []
    for char in pattern where "dMy".contains(char) && !order.contains(char) { order.append(char) }
    return order.count == 3 ? order : ["d", "M", "y"]
  }
}

private extension String {
  /// "novembro de 2026" → "Novembro de 2026".
  func capitalizedFirst(_ locale: Locale) -> String { prefix(1).uppercased(with: locale) + dropFirst() }
}

// MARK: - Root

/// Reports the natural height of the picker.
private struct OmniHeightKey: PreferenceKey {
  static var defaultValue: CGFloat = 0
  static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = max(value, nextValue()) }
}

/// The picker, drawn by the lib so it looks the same on iOS and Android.
struct OmniDatePickerContent: View {
  @ObservedObject var model: OmniDatePickerModel
  @Environment(\.colorScheme) private var scheme

  var body: some View {
    let palette = OmniPickerPalette(dark: scheme == .dark, tint: model.tint)
    Group {
      switch model.display {
      case "compact": OmniCompactField(model: model, palette: palette)
      case "wheel": OmniWheelBody(model: model, palette: palette)
      default: OmniInlineBody(model: model, palette: palette, timeAlwaysOpen: false)
      }
    }
    .disabled(model.disabled)
    .opacity(model.disabled ? 0.45 : 1)
    .fixedSize(horizontal: false, vertical: true)
    .background(GeometryReader { proxy in Color.clear.preference(key: OmniHeightKey.self, value: proxy.size.height) })
    .onPreferenceChange(OmniHeightKey.self) { height in model.onHeight?(height) }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
  }
}

// MARK: - Inline: calendar (+ time)

struct OmniInlineBody: View {
  @ObservedObject var model: OmniDatePickerModel
  let palette: OmniPickerPalette
  /// In the sheet of `compact` the time wheels are always open.
  let timeAlwaysOpen: Bool

  @State private var month: Date
  @State private var choosingMonth = false
  @State private var timeOpen = false

  init(model: OmniDatePickerModel, palette: OmniPickerPalette, timeAlwaysOpen: Bool) {
    self.model = model
    self.palette = palette
    self.timeAlwaysOpen = timeAlwaysOpen
    _month = State(initialValue: Self.startOfMonth(model.value, model.calendar))
  }

  private static func startOfMonth(_ date: Date, _ calendar: Calendar) -> Date {
    calendar.date(from: calendar.dateComponents([.year, .month], from: date)) ?? date
  }

  var body: some View {
    let text = OmniPickerText(model: model)
    VStack(spacing: 0) {
      if model.hasDate {
        header(text)
        if choosingMonth {
          OmniMonthPanel(model: model, palette: palette, text: text, month: $month) {
            withAnimation(.easeInOut(duration: 0.2)) { choosingMonth = false }
          }
        } else {
          weekdayRow(text)
          dayGrid(text)
        }
      }
      if model.mode == "datetime" {
        Rectangle().fill(Color(palette.fill)).frame(height: 1).padding(.vertical, 8)
        timeRow(text)
        if timeOpen || timeAlwaysOpen {
          OmniTimeWheels(model: model, palette: palette, text: text).padding(.top, 8)
        }
      }
      if model.mode == "time" {
        OmniTimeWheels(model: model, palette: palette, text: text)
      }
    }
    .padding(Metric.padding)
    .onChange(of: model.value) { value in
      let next = Self.startOfMonth(value, model.calendar)
      if next != month { month = next }
    }
  }

  private func header(_ text: OmniPickerText) -> some View {
    let calendar = model.calendar
    let previous = calendar.date(byAdding: .month, value: -1, to: month) ?? month
    let next = calendar.date(byAdding: .month, value: 1, to: month) ?? month
    return HStack(spacing: 4) {
      Button {
        withAnimation(.easeInOut(duration: 0.2)) { choosingMonth.toggle() }
      } label: {
        HStack(spacing: 6) {
          Text(text.monthTitle(month))
            .font(.system(size: 17, weight: .semibold))
            .foregroundColor(Color(palette.text))
          OmniChevron(direction: choosingMonth ? .up : .down)
            .stroke(Color(palette.accent), style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
            .frame(width: 10, height: 10)
        }
        .padding(.vertical, 8)
        .contentShape(Rectangle())
      }
      .buttonStyle(.plain)
      .accessibilityAddTraits(.isHeader)
      Spacer()
      if !choosingMonth {
        arrow(.left, enabled: model.isEnabled(month: previous)) { month = previous }
        arrow(.right, enabled: model.isEnabled(month: next)) { month = next }
      }
    }
    .padding(.horizontal, 4)
    .frame(height: 44)
  }

  private func arrow(_ direction: OmniChevron.Direction, enabled: Bool, action: @escaping () -> Void) -> some View {
    Button(action: { withAnimation(.easeInOut(duration: 0.2)) { action() } }) {
      OmniChevron(direction: direction)
        .stroke(Color(enabled ? palette.accent : palette.disabled), style: StrokeStyle(lineWidth: 2.2, lineCap: .round, lineJoin: .round))
        .frame(width: 11, height: 11)
        .frame(width: 40, height: 40)
        .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .disabled(!enabled)
  }

  private func weekdayRow(_ text: OmniPickerText) -> some View {
    HStack(spacing: 0) {
      ForEach(Array(text.weekdays.enumerated()), id: \.offset) { _, name in
        Text(name)
          .font(.system(size: 13, weight: .semibold))
          .foregroundColor(Color(palette.secondary))
          .frame(maxWidth: .infinity)
      }
    }
    .frame(height: 28)
    .accessibilityHidden(true)
  }

  /// Six rows always, so the height does not jump from month to month.
  private func dayGrid(_ text: OmniPickerText) -> some View {
    let calendar = model.calendar
    let days = calendar.range(of: .day, in: .month, for: month)?.count ?? 30
    let lead = (calendar.component(.weekday, from: month) - calendar.firstWeekday + 7) % 7
    let today = calendar.startOfDay(for: Date())
    let selected = calendar.startOfDay(for: model.value)
    return VStack(spacing: 0) {
      ForEach(0..<6, id: \.self) { row in
        HStack(spacing: 0) {
          ForEach(0..<7, id: \.self) { column in
            let number = row * 7 + column - lead + 1
            if number >= 1, number <= days, let day = calendar.date(byAdding: .day, value: number - 1, to: month) {
              dayCell(day, number: number, today: day == today, selected: day == selected, text: text)
            } else {
              Color.clear.frame(maxWidth: .infinity, minHeight: Metric.dayRow, maxHeight: Metric.dayRow)
            }
          }
        }
      }
    }
  }

  private func dayCell(_ day: Date, number: Int, today: Bool, selected: Bool, text: OmniPickerText) -> some View {
    let enabled = model.isEnabled(day: day)
    let color: UIColor = selected ? palette.onAccent : !enabled ? palette.disabled : today ? palette.accent : palette.text
    return Button {
      let parts = model.calendar.dateComponents([.year, .month, .day], from: day)
      model.pick(model.moment(year: parts.year, month: parts.month, day: parts.day))
    } label: {
      Text("\(number)")
        .font(.system(size: 17, weight: selected || today ? .semibold : .regular))
        .foregroundColor(Color(color))
        .frame(width: Metric.day, height: Metric.day)
        .background(Circle().fill(selected ? Color(palette.accent) : Color.clear))
        .frame(maxWidth: .infinity, minHeight: Metric.dayRow, maxHeight: Metric.dayRow)
        .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .disabled(!enabled)
    .accessibilityLabel(text.spoken(day))
    .accessibilityAddTraits(selected ? .isSelected : [])
  }

  private func timeRow(_ text: OmniPickerText) -> some View {
    HStack {
      Text(text.longDate(model.value))
        .font(.system(size: 15))
        .foregroundColor(Color(palette.secondary))
        .lineLimit(1)
      Spacer()
      OmniPill(text: text.time(model.value), palette: palette, active: timeOpen || timeAlwaysOpen) {
        withAnimation(.easeInOut(duration: 0.2)) { timeOpen.toggle() }
      }
      .disabled(timeAlwaysOpen)
    }
    .padding(.horizontal, 4)
  }
}

/// Quick jump: the year with arrows and the twelve months.
struct OmniMonthPanel: View {
  @ObservedObject var model: OmniDatePickerModel
  let palette: OmniPickerPalette
  let text: OmniPickerText
  @Binding var month: Date
  let done: () -> Void

  var body: some View {
    let calendar = model.calendar
    let year = calendar.component(.year, from: month)
    let current = calendar.component(.month, from: month)
    let names = text.shortMonths
    let firstOf = { (y: Int, m: Int) in calendar.date(from: DateComponents(year: y, month: m, day: 1)) ?? month }
    let yearEnabled = { (y: Int) in (1...12).contains { model.isEnabled(month: firstOf(y, $0)) } }

    VStack(spacing: 8) {
      HStack {
        yearArrow(.left, enabled: yearEnabled(year - 1)) { month = firstOf(year - 1, current) }
        Spacer()
        Text(String(year))
          .font(.system(size: 20, weight: .semibold))
          .foregroundColor(Color(palette.text))
        Spacer()
        yearArrow(.right, enabled: yearEnabled(year + 1)) { month = firstOf(year + 1, current) }
      }
      ForEach(0..<4, id: \.self) { row in
        HStack(spacing: 8) {
          ForEach(0..<3, id: \.self) { column in
            let number = row * 3 + column + 1
            let enabled = model.isEnabled(month: firstOf(year, number))
            let selected = number == current
            Button {
              month = firstOf(year, number)
              done()
            } label: {
              Text(names[number - 1])
                .font(.system(size: 16, weight: selected ? .semibold : .regular))
                .foregroundColor(Color(selected ? palette.onAccent : enabled ? palette.text : palette.disabled))
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(RoundedRectangle(cornerRadius: Metric.radius).fill(Color(selected ? palette.accent : palette.fill)))
            }
            .buttonStyle(.plain)
            .disabled(!enabled)
          }
        }
      }
    }
    .padding(.horizontal, 4)
    .padding(.vertical, 8)
  }

  private func yearArrow(_ direction: OmniChevron.Direction, enabled: Bool, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      OmniChevron(direction: direction)
        .stroke(Color(enabled ? palette.accent : palette.disabled), style: StrokeStyle(lineWidth: 2.2, lineCap: .round, lineJoin: .round))
        .frame(width: 11, height: 11)
        .frame(width: 40, height: 40)
        .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .disabled(!enabled)
  }
}

// MARK: - Wheels

/// The wheel inside SwiftUI.
struct OmniWheel: UIViewRepresentable {
  let items: [String]
  var enabled: [Bool] = []
  let selection: Int
  let palette: OmniPickerPalette
  let onSelect: (Int) -> Void

  func makeUIView(context: Context) -> OmniWheelView { OmniWheelView() }

  func updateUIView(_ view: OmniWheelView, context: Context) {
    view.onSelect = onSelect
    view.update(
      items: items,
      enabled: enabled,
      selected: selection,
      textColor: palette.text,
      disabledColor: palette.disabled,
      font: .monospacedDigitSystemFont(ofSize: 20, weight: .regular)
    )
  }
}

/// The band behind the middle row of the wheels.
private struct OmniWheelBand: View {
  let palette: OmniPickerPalette
  var body: some View {
    RoundedRectangle(cornerRadius: Metric.radius)
      .fill(Color(palette.fill))
      .frame(height: OmniWheelView.rowHeight)
  }
}

/// Hours, minutes and (12-hour clock) AM/PM.
struct OmniTimeWheels: View {
  @ObservedObject var model: OmniDatePickerModel
  let palette: OmniPickerPalette
  let text: OmniPickerText

  var body: some View {
    let parts = model.calendar.dateComponents([.hour, .minute], from: model.value)
    let hour = parts.hour ?? 0
    let minute = parts.minute ?? 0
    let hours = text.uses24Hour ? (0..<24).map { String(format: "%02d", $0) } : (0..<12).map { String($0 == 0 ? 12 : $0) }
    ZStack {
      OmniWheelBand(palette: palette)
      HStack(spacing: 0) {
        OmniWheel(items: hours, selection: text.uses24Hour ? hour : hour % 12, palette: palette) { index in
          model.pick(model.moment(hour: text.uses24Hour ? index : index + (hour >= 12 ? 12 : 0)))
        }
        .frame(width: 64)
        Text(":")
          .font(.system(size: 20, weight: .semibold))
          .foregroundColor(Color(palette.text))
        OmniWheel(items: (0..<60).map { String(format: "%02d", $0) }, selection: minute, palette: palette) { index in
          model.pick(model.moment(minute: index))
        }
        .frame(width: 64)
        if !text.uses24Hour {
          OmniWheel(items: text.amPm, selection: hour >= 12 ? 1 : 0, palette: palette) { index in
            model.pick(model.moment(hour: hour % 12 + index * 12))
          }
          .frame(width: 72)
        }
      }
    }
    .frame(height: Metric.wheelHeight)
    .frame(maxWidth: .infinity)
  }
}

/// `display="wheel"`: day, month and year wheels in the locale's order (+ the time).
struct OmniWheelBody: View {
  @ObservedObject var model: OmniDatePickerModel
  let palette: OmniPickerPalette

  var body: some View {
    let text = OmniPickerText(model: model)
    VStack(spacing: 12) {
      if model.hasDate { dateWheels(text) }
      if model.hasTime { OmniTimeWheels(model: model, palette: palette, text: text) }
    }
    .padding(Metric.padding)
  }

  private func dateWheels(_ text: OmniPickerText) -> some View {
    let calendar = model.calendar
    let parts = calendar.dateComponents([.year, .month, .day], from: model.value)
    let year = parts.year ?? 2000
    let month = parts.month ?? 1
    let firstOfMonth = calendar.date(from: DateComponents(year: year, month: month, day: 1)) ?? model.value
    let length = calendar.range(of: .day, in: .month, for: firstOfMonth)?.count ?? 31
    let minYear = model.minimum.map { calendar.component(.year, from: $0) } ?? year - 100
    let maxYear = model.maximum.map { calendar.component(.year, from: $0) } ?? year + 100
    let years = Array(min(minYear, year)...max(maxYear, year))
    let dayEnabled = (1...length).map { day in
      model.isEnabled(day: calendar.date(byAdding: .day, value: day - 1, to: firstOfMonth) ?? firstOfMonth)
    }
    let monthEnabled = (1...12).map { m in
      model.isEnabled(month: calendar.date(from: DateComponents(year: year, month: m, day: 1)) ?? firstOfMonth)
    }
    let yearEnabled = years.map { y in
      (1...12).contains { m in model.isEnabled(month: calendar.date(from: DateComponents(year: y, month: m, day: 1)) ?? firstOfMonth) }
    }

    return ZStack {
      OmniWheelBand(palette: palette)
      HStack(spacing: 0) {
        ForEach(text.dateOrder, id: \.self) { part in
          switch part {
          case "d":
            OmniWheel(items: (1...length).map(String.init), enabled: dayEnabled, selection: (parts.day ?? 1) - 1, palette: palette) { index in
              model.pick(model.moment(day: index + 1))
            }
            .frame(width: 64)
          case "M":
            OmniWheel(items: text.months, enabled: monthEnabled, selection: month - 1, palette: palette) { index in
              model.pick(model.moment(month: index + 1))
            }
            .frame(maxWidth: .infinity)
          default:
            OmniWheel(items: years.map(String.init), enabled: yearEnabled, selection: year - years[0], palette: palette) { index in
              model.pick(model.moment(year: years[index]))
            }
            .frame(width: 84)
          }
        }
      }
    }
    .frame(height: Metric.wheelHeight)
  }
}

// MARK: - Compact: pills that open the picker in a sheet

/// A rounded chip with a value ("16 Nov 2026", "14:05").
struct OmniPill: View {
  let text: String
  let palette: OmniPickerPalette
  var active = false
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      Text(text)
        .font(.system(size: 17).monospacedDigit())
        .foregroundColor(Color(active ? palette.accent : palette.text))
        .padding(.horizontal, 14)
        .frame(height: 36)
        .background(RoundedRectangle(cornerRadius: Metric.radius).fill(Color(palette.fill)))
    }
    .buttonStyle(.plain)
  }
}

struct OmniCompactField: View {
  @ObservedObject var model: OmniDatePickerModel
  let palette: OmniPickerPalette
  @State private var open = false

  var body: some View {
    let text = OmniPickerText(model: model)
    HStack(spacing: 8) {
      if model.hasDate { OmniPill(text: text.date(model.value), palette: palette, active: open) { open = true } }
      if model.hasTime { OmniPill(text: text.time(model.value), palette: palette, active: open) { open = true } }
      Spacer(minLength: 0)
    }
    .sheet(isPresented: $open) {
      OmniPickerSheet(model: model) { open = false }
    }
  }
}

/// The sheet of `compact`: the inline picker (time open) and a done button.
struct OmniPickerSheet: View {
  @ObservedObject var model: OmniDatePickerModel
  let done: () -> Void
  @Environment(\.colorScheme) private var scheme
  @State private var height: CGFloat = 420

  var body: some View {
    let palette = OmniPickerPalette(dark: scheme == .dark, tint: model.tint)
    VStack(spacing: 0) {
      HStack {
        Spacer()
        Button(action: done) {
          OmniCheck()
            .stroke(Color(palette.onAccent), style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
            .frame(width: 14, height: 14)
            .frame(width: 36, height: 36)
            .background(Circle().fill(Color(palette.accent)))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text("OK"))
      }
      .padding(.horizontal, 16)
      .padding(.top, 16)
      OmniInlineBody(model: model, palette: palette, timeAlwaysOpen: true)
        .padding(.horizontal, 4)
        .padding(.bottom, 8)
    }
    .fixedSize(horizontal: false, vertical: true)
    .background(GeometryReader { proxy in Color.clear.preference(key: OmniHeightKey.self, value: proxy.size.height) })
    .onPreferenceChange(OmniHeightKey.self) { if $0 > 0 { height = $0 } }
    .frame(maxHeight: .infinity, alignment: .top)
    .modifier(OmniSheetHeight(height: height, palette: palette))
  }
}

/// The sheet as tall as its content (iOS 16+), with the picker's surface color.
private struct OmniSheetHeight: ViewModifier {
  let height: CGFloat
  let palette: OmniPickerPalette

  func body(content: Content) -> some View {
    if #available(iOS 16.4, *) {
      content
        .presentationDetents([.height(height)])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(24)
        .presentationBackground(Color(palette.surface))
    } else if #available(iOS 16.0, *) {
      content
        .presentationDetents([.height(height)])
        .presentationDragIndicator(.visible)
    } else {
      content
    }
  }
}

// MARK: - Glyphs (drawn, so Android draws the very same ones)

struct OmniChevron: Shape {
  enum Direction { case left, right, up, down }
  let direction: Direction

  func path(in rect: CGRect) -> Path {
    var path = Path()
    switch direction {
    case .left:
      path.move(to: CGPoint(x: rect.maxX * 0.7, y: rect.minY))
      path.addLine(to: CGPoint(x: rect.maxX * 0.25, y: rect.midY))
      path.addLine(to: CGPoint(x: rect.maxX * 0.7, y: rect.maxY))
    case .right:
      path.move(to: CGPoint(x: rect.maxX * 0.3, y: rect.minY))
      path.addLine(to: CGPoint(x: rect.maxX * 0.75, y: rect.midY))
      path.addLine(to: CGPoint(x: rect.maxX * 0.3, y: rect.maxY))
    case .up:
      path.move(to: CGPoint(x: rect.minX, y: rect.maxY * 0.7))
      path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY * 0.25))
      path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY * 0.7))
    case .down:
      path.move(to: CGPoint(x: rect.minX, y: rect.maxY * 0.3))
      path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY * 0.75))
      path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY * 0.3))
    }
    return path
  }
}

struct OmniCheck: Shape {
  func path(in rect: CGRect) -> Path {
    var path = Path()
    path.move(to: CGPoint(x: rect.minX, y: rect.midY))
    path.addLine(to: CGPoint(x: rect.width * 0.38, y: rect.maxY * 0.85))
    path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + rect.height * 0.15))
    return path
  }
}

// MARK: - Host

/// Fills its bounds with the hosted picker.
final class OmniDatePickerContainer: UIView {
  var hosted: UIView? {
    didSet {
      oldValue?.removeFromSuperview()
      if let hosted { addSubview(hosted) }
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    hosted?.frame = bounds
  }
}

/// Bridge for the Fabric shell: owns the model, the SwiftUI host and the container view.
@objc public final class OmniDatePickerHost: NSObject {
  @objc public weak var delegate: OmniDatePickerHostDelegate?
  /// Where Fabric mounts the picker (the shell's content view).
  @objc public var view: UIView { container }

  private let container = OmniDatePickerContainer()
  private let model = OmniDatePickerModel()
  private let controller: UIHostingController<OmniDatePickerContent>
  private var reported: CGFloat = 0
  private var languageTag = ""

  @objc public override init() {
    controller = UIHostingController(rootView: OmniDatePickerContent(model: model))
    super.init()
    controller.view.backgroundColor = .clear
    container.backgroundColor = .clear
    container.hosted = controller.view
    model.onChange = { [weak self] date in self?.delegate?.datePickerDidChange(value: date.timeIntervalSince1970 * 1000) }
    model.onHeight = { [weak self] height in self?.report(height) }
  }

  /// Tells JS the natural height of the picker when it changes.
  private func report(_ height: CGFloat) {
    let rounded = ceil(height)
    guard rounded > 0, abs(rounded - reported) > 0.5 else { return }
    reported = rounded
    delegate?.datePickerDidMeasure(width: Double(container.bounds.width), height: Double(rounded))
  }

  @objc public func setMoment(_ milliseconds: Double) {
    let next = Date(timeIntervalSince1970: milliseconds / 1000)
    if next != model.value { model.value = next }
  }

  @objc public func setMode(_ value: String) { if value != model.mode { model.mode = value } }
  @objc public func setDisplay(_ value: String) { if value != model.display { model.display = value } }

  @objc public func setMinimum(_ milliseconds: Double) {
    let next = abs(milliseconds) >= noLimit ? nil : Date(timeIntervalSince1970: milliseconds / 1000)
    if next != model.minimum { model.minimum = next }
  }

  @objc public func setMaximum(_ milliseconds: Double) {
    let next = abs(milliseconds) >= noLimit ? nil : Date(timeIntervalSince1970: milliseconds / 1000)
    if next != model.maximum { model.maximum = next }
  }

  @objc public func setLocale(_ tag: String) {
    guard tag != languageTag else { return }
    languageTag = tag
    model.locale = tag.isEmpty ? Locale.current : Locale(identifier: tag)
  }

  @objc public func setHourCycle(_ value: String) { if value != model.hourCycle { model.hourCycle = value } }
  @objc public func setTint(_ color: UIColor?) { if color != model.tint { model.tint = color } }
  @objc public func setDisabled(_ value: Bool) { if value != model.disabled { model.disabled = value } }

  /// SwiftUI wants the hosting controller in the view controller hierarchy (the sheet of `compact` is presented from it).
  @objc public func attach(to anchor: UIView) {
    guard controller.parent == nil, let parent = Self.viewController(of: anchor) else { return }
    parent.addChild(controller)
    controller.didMove(toParent: parent)
  }

  /// Takes the controller out of the hierarchy (the view left the window or is recycled).
  @objc public func detach() {
    guard controller.parent != nil else { return }
    controller.willMove(toParent: nil)
    controller.removeFromParent()
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
