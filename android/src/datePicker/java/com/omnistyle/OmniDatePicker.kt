package com.omnistyle

import android.text.format.DateFormat
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import java.text.DateFormatSymbols
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt

/*
 * The date picker drawn by the lib, so it looks the same on Android and iOS
 * (`ios/datePicker/OmniDatePicker.swift`): same colors, sizes, calendar, month panel,
 * wheels and compact pills. Keep the numbers in sync with the Swift side.
 */

/** A limit from JS at or beyond this many milliseconds means "no limit" (the range of a JS `Date`). */
private const val NO_LIMIT = 8.64e15

// ── look ──

/** Colors of the picker, the same on iOS and Android. */
internal class PickerPalette(dark: Boolean, tint: Int?) {
  val accent = tint?.let { Color(it) } ?: Color(if (dark) 0xFF0A84FF else 0xFF007AFF)
  val onAccent = Color.White
  val text = Color(if (dark) 0xFFF2F2F7 else 0xFF111111)
  val secondary = Color(if (dark) 0xFF98989F else 0xFF8A8A8E)
  val disabled = Color(if (dark) 0xFF48484A else 0xFFC7C7CC)
  val fill = Color(if (dark) 0xFF2C2C2E else 0xFFF2F2F7)
  val surface = Color(if (dark) 0xFF1C1C1E else 0xFFFFFFFF)
}

private val DAY = 40.dp
private val DAY_ROW = 44.dp
private val ROW = 36.dp
private const val VISIBLE_ROWS = 5
private val RADIUS = 10.dp
private val PADDING = 12.dp

private fun style(size: Int, color: Color, weight: FontWeight = FontWeight.Normal) =
  TextStyle(fontSize = size.sp, color = color, fontWeight = weight, fontFeatureSettings = "tnum")

// ── dates ──

/** The picker's view of the props: limits, locale, clock and the date math. */
internal class PickerModel(private val state: OmniDatePickerState, is24HourDevice: Boolean, private val emit: (Long) -> Unit) {
  val value get() = state.value
  val locale: Locale = if (state.locale.isEmpty()) Locale.getDefault() else Locale.forLanguageTag(state.locale)
  val minimum: Long? = state.minimum.takeIf { abs(it) < NO_LIMIT }?.toLong()
  val maximum: Long? = state.maximum.takeIf { abs(it) < NO_LIMIT }?.toLong()
  val hasDate get() = state.mode != "time"
  val hasTime get() = state.mode != "date"
  val uses24Hour = when (state.hourCycle) {
    "h24" -> true
    "h12" -> false
    else -> is24HourDevice
  }

  fun calendar(millis: Long = value): Calendar = Calendar.getInstance(locale).apply { timeInMillis = millis }

  /** Midnight of the first day of the month of [millis]. */
  fun startOfMonth(millis: Long): Long = calendar(millis).apply {
    set(Calendar.DAY_OF_MONTH, 1)
    set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
  }.timeInMillis

  fun startOfDay(millis: Long): Long = calendar(millis).apply {
    set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
  }.timeInMillis

  fun firstOf(year: Int, month: Int): Long = calendar().apply {
    clear(); set(year, month - 1, 1)
  }.timeInMillis

  fun plus(millis: Long, field: Int, amount: Int): Long = calendar(millis).apply { add(field, amount) }.timeInMillis

  /** Whether any moment of the span [start, start + 1 field) is inside the limits. */
  private fun overlaps(start: Long, field: Int): Boolean {
    val end = plus(start, field, 1)
    return (minimum == null || end > minimum) && (maximum == null || start <= maximum)
  }

  fun isEnabledDay(dayStart: Long) = overlaps(dayStart, Calendar.DAY_OF_MONTH)
  fun isEnabledMonth(monthStart: Long) = overlaps(monthStart, Calendar.MONTH)

  /** The value with some of its parts replaced; a day past the end of the new month becomes its last day. */
  fun moment(year: Int? = null, month: Int? = null, day: Int? = null, hour: Int? = null, minute: Int? = null): Long {
    val now = calendar()
    val y = year ?: now.get(Calendar.YEAR)
    val m = month ?: (now.get(Calendar.MONTH) + 1)
    val length = calendar(firstOf(y, m)).getActualMaximum(Calendar.DAY_OF_MONTH)
    return calendar().apply {
      set(Calendar.DAY_OF_MONTH, 1)
      set(Calendar.YEAR, y)
      set(Calendar.MONTH, m - 1)
      set(Calendar.DAY_OF_MONTH, minOf(day ?: now.get(Calendar.DAY_OF_MONTH), length))
      if (hour != null) { set(Calendar.HOUR_OF_DAY, hour); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }
      if (minute != null) { set(Calendar.MINUTE, minute); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }
    }.timeInMillis
  }

  /** A pick from the UI: shown at once and sent to JS (which clamps it and sends it back). */
  fun pick(millis: Long) {
    if (millis == state.value) return
    state.value = millis
    emit(millis)
  }

  // ── text in the picker's language ──

  private fun format(skeleton: String, millis: Long) =
    SimpleDateFormat(DateFormat.getBestDateTimePattern(locale, skeleton), locale).format(Date(millis))

  private fun String.capitalizedFirst() = replaceFirstChar { it.titlecase(locale) }

  fun monthTitle(millis: Long) = format("yMMMM", millis).capitalizedFirst()
  fun dateText(millis: Long) = format("yMMMd", millis)
  fun longDate(millis: Long) = format("EEEEdMMMM", millis).capitalizedFirst()
  fun timeText(millis: Long) = format(if (uses24Hour) "HHmm" else "hmma", millis)
  fun spoken(millis: Long) = format("yMMMMEEEEd", millis)

  /** Narrow weekday names starting on the locale's first weekday. */
  val weekdays: List<String> by lazy {
    val first = Calendar.getInstance(locale).firstDayOfWeek
    val narrow = SimpleDateFormat("ccccc", locale)
    (0 until 7).map { offset ->
      val day = Calendar.getInstance(locale).apply { set(Calendar.DAY_OF_WEEK, (first - 1 + offset) % 7 + 1) }
      narrow.format(day.time)
    }
  }

  private fun monthNames(pattern: String): List<String> {
    val formatter = SimpleDateFormat(pattern, locale)
    return (0 until 12).map { month -> formatter.format(Date(firstOf(2001, month + 1))).capitalizedFirst() }
  }

  val shortMonths by lazy { monthNames("LLL") }
  val months by lazy { monthNames("LLLL") }
  val amPm: List<String> by lazy { DateFormatSymbols.getInstance(locale).amPmStrings.toList() }

  /** Order of day, month and year in the locale. */
  val dateOrder: List<Char> by lazy {
    val order = DateFormat.getBestDateTimePattern(locale, "yMMMMd").filter { it in "dMy" }.toList().distinct()
    if (order.size == 3) order else listOf('d', 'M', 'y')
  }
}

// ── root ──

/** The picker; `onChange` gets the new moment (ms), `onSize` the natural size in px. */
@Composable
internal fun OmniDatePicker(state: OmniDatePickerState, onChange: (Long) -> Unit, onSize: (Int, Int) -> Unit) {
  val context = LocalContext.current
  val palette = PickerPalette(isSystemInDarkTheme(), state.tint)
  val emit by rememberUpdatedState(onChange)
  val model = PickerModel(state, DateFormat.is24HourFormat(context)) { emit(it) }

  Box(
    Modifier
      .fillMaxWidth()
      .wrapContentHeight()
      .alpha(if (state.disabled) 0.45f else 1f)
      .onSizeChanged { onSize(it.width, it.height) },
  ) {
    // a disabled picker ignores touches: a transparent layer on top takes them
    when (state.display) {
      "compact" -> CompactField(model, palette)
      "wheel" -> WheelBody(model, palette)
      else -> InlineBody(model, palette, timeAlwaysOpen = false)
    }
    if (state.disabled) {
      Box(Modifier.matchParentSize().pointerInput(Unit) { awaitEachGesture { awaitFirstDown(requireUnconsumed = false).consume() } })
    }
  }
}

// ── inline: calendar (+ time) ──

@Composable
private fun InlineBody(model: PickerModel, palette: PickerPalette, timeAlwaysOpen: Boolean) {
  var month by remember { mutableLongStateOf(model.startOfMonth(model.value)) }
  var choosingMonth by remember { mutableStateOf(false) }
  var timeOpen by remember { mutableStateOf(false) }

  // JS moved the value to another month: show that month
  LaunchedEffect(model.value) {
    val next = model.startOfMonth(model.value)
    if (next != month) month = next
  }

  Column(Modifier.fillMaxWidth().animateContentSize().padding(PADDING)) {
    if (model.hasDate) {
      Header(model, palette, month, choosingMonth, onToggle = { choosingMonth = !choosingMonth }, onMonth = { month = it })
      if (choosingMonth) {
        MonthPanel(model, palette, month, onMonth = { month = it }, done = { choosingMonth = false })
      } else {
        WeekdayRow(model, palette)
        DayGrid(model, palette, month)
      }
    }
    if (model.hasTime && model.hasDate) {
      Box(Modifier.padding(vertical = 8.dp).fillMaxWidth().height(1.dp).background(palette.fill))
      Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(
          model.longDate(model.value),
          style = style(15, palette.secondary),
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
          modifier = Modifier.weight(1f),
        )
        Pill(model.timeText(model.value), palette, active = timeOpen || timeAlwaysOpen) { if (!timeAlwaysOpen) timeOpen = !timeOpen }
      }
      if (timeOpen || timeAlwaysOpen) {
        Spacer(Modifier.height(8.dp))
        TimeWheels(model, palette)
      }
    }
    if (!model.hasDate) TimeWheels(model, palette)
  }
}

@Composable
private fun Header(model: PickerModel, palette: PickerPalette, month: Long, choosingMonth: Boolean, onToggle: () -> Unit, onMonth: (Long) -> Unit) {
  val previous = model.plus(month, Calendar.MONTH, -1)
  val next = model.plus(month, Calendar.MONTH, 1)
  Row(Modifier.fillMaxWidth().height(44.dp).padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
    Row(
      Modifier
        .plainClick(onToggle)
        .padding(vertical = 8.dp)
        .semantics { heading() },
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Text(model.monthTitle(month), style = style(17, palette.text, FontWeight.SemiBold))
      Spacer(Modifier.width(6.dp))
      Chevron(if (choosingMonth) Direction.Up else Direction.Down, palette.accent, 10.dp, 2f)
    }
    Spacer(Modifier.weight(1f))
    if (!choosingMonth) {
      ArrowButton(Direction.Left, model.isEnabledMonth(previous), palette) { onMonth(previous) }
      ArrowButton(Direction.Right, model.isEnabledMonth(next), palette) { onMonth(next) }
    }
  }
}

@Composable
private fun ArrowButton(direction: Direction, enabled: Boolean, palette: PickerPalette, onClick: () -> Unit) {
  Box(
    Modifier.size(40.dp).plainClick(onClick, enabled, Role.Button),
    contentAlignment = Alignment.Center,
  ) {
    Chevron(direction, if (enabled) palette.accent else palette.disabled, 11.dp, 2.2f)
  }
}

@Composable
private fun WeekdayRow(model: PickerModel, palette: PickerPalette) {
  Row(Modifier.fillMaxWidth().height(28.dp), verticalAlignment = Alignment.CenterVertically) {
    model.weekdays.forEach { name ->
      Text(name, style = style(13, palette.secondary, FontWeight.SemiBold), textAlign = TextAlign.Center, modifier = Modifier.weight(1f))
    }
  }
}

/** Six rows always, so the height does not jump from month to month. */
@Composable
private fun DayGrid(model: PickerModel, palette: PickerPalette, month: Long) {
  val first = model.calendar(month)
  val days = first.getActualMaximum(Calendar.DAY_OF_MONTH)
  val lead = (first.get(Calendar.DAY_OF_WEEK) - first.firstDayOfWeek + 7) % 7
  val today = model.startOfDay(System.currentTimeMillis())
  val selected = model.startOfDay(model.value)

  Column(Modifier.fillMaxWidth()) {
    for (row in 0 until 6) {
      Row(Modifier.fillMaxWidth().height(DAY_ROW)) {
        for (column in 0 until 7) {
          val number = row * 7 + column - lead + 1
          Box(Modifier.weight(1f).height(DAY_ROW), contentAlignment = Alignment.Center) {
            if (number in 1..days) {
              val day = model.plus(month, Calendar.DAY_OF_MONTH, number - 1)
              DayCell(model, palette, day, number, today = day == today, selected = day == selected)
            }
          }
        }
      }
    }
  }
}

@Composable
private fun DayCell(model: PickerModel, palette: PickerPalette, day: Long, number: Int, today: Boolean, selected: Boolean) {
  val enabled = model.isEnabledDay(day)
  val color = when {
    selected -> palette.onAccent
    !enabled -> palette.disabled
    today -> palette.accent
    else -> palette.text
  }
  Box(
    Modifier
      .size(DAY)
      .background(if (selected) palette.accent else Color.Transparent, CircleShape)
      .plainClick({
        val parts = model.calendar(day)
        model.pick(model.moment(parts.get(Calendar.YEAR), parts.get(Calendar.MONTH) + 1, parts.get(Calendar.DAY_OF_MONTH)))
      }, enabled, Role.Button)
      .semantics {
        contentDescription = model.spoken(day)
        this.selected = selected
      },
    contentAlignment = Alignment.Center,
  ) {
    Text("$number", style = style(17, color, if (selected || today) FontWeight.SemiBold else FontWeight.Normal))
  }
}

/** Quick jump: the year with arrows and the twelve months. */
@Composable
private fun MonthPanel(model: PickerModel, palette: PickerPalette, month: Long, onMonth: (Long) -> Unit, done: () -> Unit) {
  val current = model.calendar(month)
  val year = current.get(Calendar.YEAR)
  val selectedMonth = current.get(Calendar.MONTH) + 1
  val yearEnabled = { y: Int -> (1..12).any { model.isEnabledMonth(model.firstOf(y, it)) } }

  Column(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      ArrowButton(Direction.Left, yearEnabled(year - 1), palette) { onMonth(model.firstOf(year - 1, selectedMonth)) }
      Text("$year", style = style(20, palette.text, FontWeight.SemiBold), textAlign = TextAlign.Center, modifier = Modifier.weight(1f))
      ArrowButton(Direction.Right, yearEnabled(year + 1), palette) { onMonth(model.firstOf(year + 1, selectedMonth)) }
    }
    for (row in 0 until 4) {
      Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        for (column in 0 until 3) {
          val number = row * 3 + column + 1
          val start = model.firstOf(year, number)
          val enabled = model.isEnabledMonth(start)
          val selected = number == selectedMonth
          Box(
            Modifier
              .weight(1f)
              .height(44.dp)
              .background(if (selected) palette.accent else palette.fill, RoundedCornerShape(RADIUS))
              .plainClick({ onMonth(start); done() }, enabled, Role.Button),
            contentAlignment = Alignment.Center,
          ) {
            Text(
              model.shortMonths[number - 1],
              style = style(16, if (selected) palette.onAccent else if (enabled) palette.text else palette.disabled, if (selected) FontWeight.SemiBold else FontWeight.Normal),
            )
          }
        }
      }
    }
  }
}

// ── wheels ──

/**
 * A spinning wheel of labels: drag or fling to a row, tap a row to jump to it. Rows away
 * from the middle fade and shrink; disabled rows are skipped; each row ticks. Same numbers
 * as iOS's `OmniWheelView`.
 */
@Composable
private fun Wheel(
  items: List<String>,
  selection: Int,
  palette: PickerPalette,
  modifier: Modifier = Modifier,
  enabled: List<Boolean> = emptyList(),
  onSelect: (Int) -> Unit,
) {
  val rowPx = with(LocalDensity.current) { ROW.toPx() }
  val position = remember { Animatable(selection.toFloat()) }
  val scope = rememberCoroutineScope()
  val haptics = LocalHapticFeedback.current
  val view = LocalView.current
  var dragging by remember { mutableStateOf(false) }
  val latestItems by rememberUpdatedState(items)
  val latestEnabled by rememberUpdatedState(enabled)
  val latestSelection by rememberUpdatedState(selection)
  val select by rememberUpdatedState(onSelect)

  fun isEnabled(row: Int) = latestEnabled.getOrNull(row) ?: true
  fun nearestEnabled(row: Int): Int {
    if (isEnabled(row)) return row
    for (distance in 1 until latestItems.size) {
      if (row - distance >= 0 && isEnabled(row - distance)) return row - distance
      if (row + distance < latestItems.size && isEnabled(row + distance)) return row + distance
    }
    return row
  }
  fun settleOn(row: Int, velocity: Float = 0f) {
    scope.launch {
      position.animateTo(row.toFloat(), spring(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = Spring.StiffnessMediumLow), velocity)
      dragging = false
    }
    if (row != latestSelection) select(row)
  }

  // JS (or another wheel) changed the value: roll to it
  LaunchedEffect(selection, items.size) {
    if (!dragging) position.animateTo(selection.coerceIn(0, maxOf(items.lastIndex, 0)).toFloat(), spring(stiffness = Spring.StiffnessMediumLow))
  }
  // one tick per row while the finger moves the wheel
  LaunchedEffect(Unit) {
    var last = position.value.roundToInt()
    snapshotFlow { position.value.roundToInt() }.collect { row ->
      if (row != last && dragging) haptics.performHapticFeedback(HapticFeedbackType.SegmentFrequentTick)
      last = row
    }
  }

  Box(
    modifier
      .height(ROW * VISIBLE_ROWS)
      .clipToBounds()
      // a React Native scroll view around the picker must not take the wheel's drags
      .pointerInput(Unit) {
        awaitEachGesture {
          awaitFirstDown(requireUnconsumed = false)
          view.parent?.requestDisallowInterceptTouchEvent(true)
        }
      }
      .pointerInput(Unit) {
        val tracker = VelocityTracker()
        detectVerticalDragGestures(
          onDragStart = {
            dragging = true
            tracker.resetTracking()
          },
          onVerticalDrag = { change, delta ->
            tracker.addPosition(change.uptimeMillis, change.position)
            val next = (position.value - delta / rowPx).coerceIn(-0.4f, latestItems.lastIndex + 0.4f)
            scope.launch { position.snapTo(next) }
          },
          onDragEnd = {
            // rows per second (positive = towards later rows)
            val speed = -tracker.calculateVelocity().y / rowPx
            val projected = (position.value + speed * 0.25f).roundToInt().coerceIn(0, latestItems.lastIndex)
            settleOn(nearestEnabled(projected), speed)
          },
          onDragCancel = { settleOn(nearestEnabled(position.value.roundToInt().coerceIn(0, latestItems.lastIndex))) },
        )
      }
      .pointerInput(Unit) {
        detectTapGestures { offset ->
          val row = (position.value + (offset.y - size.height / 2f) / rowPx).roundToInt()
          if (row in latestItems.indices && isEnabled(row)) {
            haptics.performHapticFeedback(HapticFeedbackType.SegmentTick)
            dragging = true
            settleOn(row)
          }
        }
      }
      .semantics { contentDescription = items.getOrNull(selection).orEmpty() },
    contentAlignment = Alignment.Center,
  ) {
    val center = position.value
    val first = maxOf(0, center.toInt() - VISIBLE_ROWS / 2 - 1)
    val last = minOf(items.lastIndex, center.toInt() + VISIBLE_ROWS / 2 + 1)
    for (row in first..last) {
      val distance = abs(row - center)
      Text(
        items[row],
        style = style(20, if (enabled.getOrNull(row) == false) palette.disabled else palette.text),
        maxLines = 1,
        textAlign = TextAlign.Center,
        modifier = Modifier
          .fillMaxWidth()
          .offset { IntOffset(0, ((row - center) * rowPx).roundToInt()) }
          .graphicsLayer {
            alpha = maxOf(0.2f, 1f - distance * 0.3f)
            val scale = maxOf(0.75f, 1f - distance * 0.07f)
            scaleX = scale
            scaleY = scale
          },
      )
    }
  }
}

/** The band behind the middle row of the wheels. */
@Composable
private fun WheelBand(palette: PickerPalette) {
  Box(Modifier.fillMaxWidth().height(ROW).background(palette.fill, RoundedCornerShape(RADIUS)))
}

/** Hours, minutes and (12-hour clock) AM/PM. */
@Composable
private fun TimeWheels(model: PickerModel, palette: PickerPalette) {
  val now = model.calendar()
  val hour = now.get(Calendar.HOUR_OF_DAY)
  val minute = now.get(Calendar.MINUTE)
  val hours = if (model.uses24Hour) (0 until 24).map { "%02d".format(it) } else (0 until 12).map { if (it == 0) "12" else "$it" }
  val minutes = remember { (0 until 60).map { "%02d".format(it) } }

  Box(Modifier.fillMaxWidth().height(ROW * VISIBLE_ROWS), contentAlignment = Alignment.Center) {
    WheelBand(palette)
    Row(verticalAlignment = Alignment.CenterVertically) {
      Wheel(hours, if (model.uses24Hour) hour else hour % 12, palette, Modifier.width(64.dp)) { index ->
        model.pick(model.moment(hour = if (model.uses24Hour) index else index + if (hour >= 12) 12 else 0))
      }
      Text(":", style = style(20, palette.text, FontWeight.SemiBold))
      Wheel(minutes, minute, palette, Modifier.width(64.dp)) { index -> model.pick(model.moment(minute = index)) }
      if (!model.uses24Hour) {
        Wheel(model.amPm, if (hour >= 12) 1 else 0, palette, Modifier.width(72.dp)) { index ->
          model.pick(model.moment(hour = hour % 12 + index * 12))
        }
      }
    }
  }
}

/** `display="wheel"`: day, month and year wheels in the locale's order (+ the time). */
@Composable
private fun WheelBody(model: PickerModel, palette: PickerPalette) {
  Column(Modifier.fillMaxWidth().padding(PADDING), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    if (model.hasDate) DateWheels(model, palette)
    if (model.hasTime) TimeWheels(model, palette)
  }
}

@Composable
private fun DateWheels(model: PickerModel, palette: PickerPalette) {
  val now = model.calendar()
  val year = now.get(Calendar.YEAR)
  val month = now.get(Calendar.MONTH) + 1
  val day = now.get(Calendar.DAY_OF_MONTH)
  val firstOfMonth = model.firstOf(year, month)
  val length = model.calendar(firstOfMonth).getActualMaximum(Calendar.DAY_OF_MONTH)
  val minYear = model.minimum?.let { model.calendar(it).get(Calendar.YEAR) } ?: (year - 100)
  val maxYear = model.maximum?.let { model.calendar(it).get(Calendar.YEAR) } ?: (year + 100)
  val years = (minOf(minYear, year)..maxOf(maxYear, year)).toList()
  val dayEnabled = (1..length).map { model.isEnabledDay(model.plus(firstOfMonth, Calendar.DAY_OF_MONTH, it - 1)) }
  val monthEnabled = (1..12).map { model.isEnabledMonth(model.firstOf(year, it)) }
  val yearEnabled = years.map { y -> (1..12).any { model.isEnabledMonth(model.firstOf(y, it)) } }

  Box(Modifier.fillMaxWidth().height(ROW * VISIBLE_ROWS), contentAlignment = Alignment.Center) {
    WheelBand(palette)
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      model.dateOrder.forEach { part ->
        when (part) {
          'd' -> Wheel((1..length).map { "$it" }, day - 1, palette, Modifier.width(64.dp), dayEnabled) { model.pick(model.moment(day = it + 1)) }
          'M' -> Wheel(model.months, month - 1, palette, Modifier.weight(1f), monthEnabled) { model.pick(model.moment(month = it + 1)) }
          else -> Wheel(years.map { "$it" }, year - years.first(), palette, Modifier.width(84.dp), yearEnabled) { model.pick(model.moment(year = years[it])) }
        }
      }
    }
  }
}

// ── compact: pills that open the picker in a sheet ──

/** A rounded chip with a value ("16 Nov 2026", "14:05"). */
@Composable
private fun Pill(text: String, palette: PickerPalette, active: Boolean = false, onClick: () -> Unit) {
  Box(
    Modifier
      .height(36.dp)
      .background(palette.fill, RoundedCornerShape(RADIUS))
      .plainClick(onClick, role = Role.Button)
      .padding(horizontal = 14.dp),
    contentAlignment = Alignment.Center,
  ) {
    Text(text, style = style(17, if (active) palette.accent else palette.text))
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CompactField(model: PickerModel, palette: PickerPalette) {
  var open by remember { mutableStateOf(false) }
  Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
    if (model.hasDate) Pill(model.dateText(model.value), palette, open) { open = true }
    if (model.hasTime) Pill(model.timeText(model.value), palette, open) { open = true }
  }

  if (open) {
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    val close: () -> Unit = { scope.launch { sheet.hide() }.invokeOnCompletion { open = false } }
    ModalBottomSheet(
      onDismissRequest = { open = false },
      sheetState = sheet,
      containerColor = palette.surface,
      shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
    ) {
      Column(Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.End) {
          Box(
            Modifier
              .size(36.dp)
              .background(palette.accent, CircleShape)
              .plainClick(close, role = Role.Button)
              .semantics { contentDescription = "OK" },
            contentAlignment = Alignment.Center,
          ) {
            Check(palette.onAccent)
          }
        }
        Box(Modifier.padding(horizontal = 4.dp)) { InlineBody(model, palette, timeAlwaysOpen = true) }
      }
    }
  }
}

// ── glyphs (drawn, so iOS draws the very same ones) ──

private enum class Direction { Left, Right, Up, Down }

@Composable
private fun Chevron(direction: Direction, color: Color, size: Dp, width: Float) {
  val density = LocalDensity.current
  Canvas(Modifier.size(size)) {
    val w = this.size.width
    val h = this.size.height
    val path = Path().apply {
      when (direction) {
        Direction.Left -> { moveTo(w * 0.7f, 0f); lineTo(w * 0.25f, h / 2); lineTo(w * 0.7f, h) }
        Direction.Right -> { moveTo(w * 0.3f, 0f); lineTo(w * 0.75f, h / 2); lineTo(w * 0.3f, h) }
        Direction.Up -> { moveTo(0f, h * 0.7f); lineTo(w / 2, h * 0.25f); lineTo(w, h * 0.7f) }
        Direction.Down -> { moveTo(0f, h * 0.3f); lineTo(w / 2, h * 0.75f); lineTo(w, h * 0.3f) }
      }
    }
    drawPath(path, color, style = Stroke(width = with(density) { width.dp.toPx() }, cap = StrokeCap.Round, join = StrokeJoin.Round))
  }
}

@Composable
private fun Check(color: Color) {
  val density = LocalDensity.current
  Canvas(Modifier.size(14.dp)) {
    val w = size.width
    val h = size.height
    val path = Path().apply {
      moveTo(0f, h / 2)
      lineTo(w * 0.38f, h * 0.85f)
      lineTo(w, h * 0.15f)
    }
    drawPath(path, color, style = Stroke(width = with(density) { 2.5.dp.toPx() }, cap = StrokeCap.Round, join = StrokeJoin.Round))
  }
}

/** A click without ripple (iOS has none either), with a role for TalkBack. */
@Composable
private fun Modifier.plainClick(onClick: () -> Unit, enabled: Boolean = true, role: Role? = null): Modifier =
  clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, enabled = enabled, role = role, onClick = onClick)

