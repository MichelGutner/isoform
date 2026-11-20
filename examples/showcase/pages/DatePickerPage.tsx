import { useState } from 'react';
import { engine, type DatePickerDisplay, type DatePickerMode } from 'react-isoform';
import { Body } from '../ui';
import { Choice, Code, Flag, Flags, PageShell, Section } from '../kit';

/** The picker: full width, its height is the one it reports (a calendar is taller than a pill). */
const Picker = engine('DatePicker', ({ theme }) => ({
  alignSelf: 'stretch',
  maxWidth: 420,
  borderRadius: theme.borderRadius?.lg ?? 20,
  borderWidth: 1,
  borderColor: theme.color.border,
}));

const MODES = ['date', 'time', 'datetime'] as const;
const DISPLAYS = ['inline', 'wheel', 'compact'] as const;
const LOCALES = ['device', 'pt-BR', 'en-US', 'ja-JP'] as const;

/** The date as the user would read it (and the ISO form below it). */
const show = (value: Date, mode: DatePickerMode, locale?: string) => {
  const options: Intl.DateTimeFormatOptions =
    mode === 'date' ? { dateStyle: 'full' } : mode === 'time' ? { timeStyle: 'short' } : { dateStyle: 'full', timeStyle: 'short' };
  return new Intl.DateTimeFormat(locale, options).format(value);
};

const day = (offset: number) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
};

/** DatePicker: a date, a time or both, with each platform's own picker. */
export function DatePickerPage() {
  const [value, setValue] = useState(() => new Date());
  const [mode, setMode] = useState<DatePickerMode>('date');
  const [display, setDisplay] = useState<DatePickerDisplay>('inline');
  const [locale, setLocale] = useState<(typeof LOCALES)[number]>('device');
  const [limited, setLimited] = useState(false);
  const [is24Hour, setIs24Hour] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const language = locale === 'device' ? undefined : locale;

  return (
    <PageShell
      title="DatePicker"
      summary="Pick a date, a time or both. iOS and Android: the same picker, drawn with SwiftUI and Jetpack Compose (calendar, wheels, compact pills with a sheet). Web: the browser's own input."
    >
      <Section title="Picker" hint="Controlled: keep the value in state and update it in onValueChange.">
        <Picker
          value={value}
          onValueChange={setValue}
          mode={mode}
          display={display}
          locale={language}
          is24Hour={is24Hour || undefined}
          minimumDate={limited ? day(-7) : undefined}
          maximumDate={limited ? day(14) : undefined}
          disabled={disabled}
          label="Pick a date"
          testID="date-picker"
        />
        <Body testID="date-picker-value">{show(value, mode, language)}</Body>
        <Choice label="mode" value={mode} options={MODES} onChange={setMode} />
        <Choice label="display" value={display} options={DISPLAYS} onChange={setDisplay} />
        <Choice label="locale" value={locale} options={LOCALES} onChange={setLocale} />
        <Flags>
          <Flag label="last week → in 2 weeks" on={limited} onChange={setLimited} />
          <Flag label="24-hour clock" on={is24Hour} onChange={setIs24Hour} />
          <Flag label="disabled" on={disabled} onChange={setDisabled} />
        </Flags>
      </Section>

      <Section title="In code">
        <Code>{`
// isoform.config.json
{ "modules": { "datePicker": true } }

const Picker = engine('DatePicker', { alignSelf: 'stretch', borderRadius: 20 });
const [date, setDate] = useState(new Date());

<Picker value={date} onValueChange={setDate}
  mode="datetime"            // 'date' | 'time' | 'datetime'
  display="inline"           // 'inline' | 'wheel' | 'compact'
  minimumDate={today} maximumDate={nextMonth}
  locale="pt-BR" is24Hour />
        `}</Code>
      </Section>
    </PageShell>
  );
}
