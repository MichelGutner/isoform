import { useState, type ReactNode } from 'react';
import { engine } from '@michelgutner/isoform';
import { Body, Card, Chip, ChipLabel, Heading, Title, themeFade } from './ui';

/** Building blocks shared by the pages: a page frame, a section card, a code block and small controls. */

const Stack = engine('Box', ({ theme }) => ({ gap: theme.spacing.xs }));
const PageBox = engine('Box', ({ theme }) => ({ gap: theme.spacing.lg }));

/** A page: its title, a one-line summary and the sections below. */
export function PageShell({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  return (
    <PageBox>
      <Stack>
        <Title>{title}</Title>
        <Body muted>{summary}</Body>
      </Stack>
      {children}
    </PageBox>
  );
}

/** A card with a heading, an optional hint and the demo. */
export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card>
      <Heading>{title}</Heading>
      {hint ? <Body muted>{hint}</Body> : null}
      {children}
    </Card>
  );
}

const CodeBox = engine('Box', ({ theme }) => ({
  transition: themeFade(),
  backgroundColor: theme.color.background,
  borderWidth: 1,
  borderColor: theme.color.border,
  borderRadius: theme.borderRadius?.md ?? 14,
  padding: theme.spacing.md,
}));

const CodeText = engine('Text', ({ theme }) => ({
  transition: themeFade(),
  fontFamily: 'monospace',
  fontSize: 12,
  lineHeight: '1.5',
  color: theme.color.text,
}))
  .when('platform:ios', { style: { fontFamily: 'Menlo' } })
  .when('platform:web', { style: { whiteSpace: 'pre', overflowX: 'auto' } });

/** A snippet of the code behind the demo. */
export function Code({ children }: { children: string }) {
  return (
    <CodeBox>
      <CodeText>{children.trim()}</CodeText>
    </CodeBox>
  );
}

const Controls = engine('Box', ({ theme }) => ({ gap: theme.spacing.xs }));
const Options = engine('Box', ({ theme }) => ({ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }));

/** Pick one of several values (rendered as chips). */
export function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (value: T) => void }) {
  return (
    <Controls>
      <Body muted>{label}</Body>
      <Options>
        {options.map((option) => (
          <Chip key={option} active={option === value} onPress={() => onChange(option)}>
            <ChipLabel active={option === value}>{option}</ChipLabel>
          </Chip>
        ))}
      </Options>
    </Controls>
  );
}

/** An on/off option (a chip that lights up). */
export function Flag({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <Chip active={on} onPress={() => onChange(!on)}>
      <ChipLabel active={on}>{label}</ChipLabel>
    </Chip>
  );
}

/** A flex-wrapped row for the flags and buttons of a demo. */
export const Flags = Options;

const LogBox = engine('Box', ({ theme }) => ({
  gap: 2,
  padding: theme.spacing.sm,
  borderRadius: theme.borderRadius?.md ?? 14,
  backgroundColor: theme.color.background,
  borderWidth: 1,
  borderColor: theme.color.border,
}));

const LogLine = engine('Text', ({ theme }) => ({ fontSize: 12, color: theme.color.muted, fontFamily: 'monospace' }))
  .when('platform:ios', { style: { fontFamily: 'Menlo' } });

/** The last `size` events, newest first, and the function that adds one. */
export function useEventLog(size = 6) {
  const [events, setEvents] = useState<string[]>([]);
  const log = (text: string) => setEvents((prev) => [text, ...prev].slice(0, size));
  return { events, log };
}

/** The events a player emitted (what reaches your JS callbacks). */
export function EventLog({ events }: { events: string[] }) {
  return (
    <LogBox>
      {events.length ? events.map((text, i) => <LogLine key={`${i}-${text}`}>{text}</LogLine>) : <LogLine>events appear here</LogLine>}
    </LogBox>
  );
}
