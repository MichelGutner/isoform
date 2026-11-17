import { useRef, useState } from 'react';
import { engine, type BottomSheetHandle } from '@michelgutner/isoform';
import { Body, Button, ButtonLabel, Heading, Row, themeFade } from '../ui';
import { useOverlay } from '../settings';
import { Code, EventLog, Flag, Flags, PageShell, Section, useEventLog } from '../kit';

/**
 * `engine('BottomSheet')`: SwiftUI sheet on iOS, Compose on Android, `<dialog>` on the web.
 * The style styles the surface: `backgroundColor` and the corner radius go to the native
 * sheet, padding and gap to the content. Leave `backgroundColor` out for the system look
 * (Liquid Glass on iOS 26).
 */
const Sheet = engine('BottomSheet', ({ theme }) => ({
  backgroundColor: theme.color.surface,
  paddingInline: theme.spacing.lg,
  paddingTop: theme.spacing.lg,
  paddingBottom: theme.spacing.xl,
  gap: theme.spacing.md,
}));

const Action = engine<'Pressable', { danger?: boolean }>('Pressable', ({ theme }) => ({
  transition: themeFade(),
  paddingBlock: 14,
  paddingInline: theme.spacing.md,
  borderRadius: theme.borderRadius?.md ?? 14,
  backgroundColor: theme.color.background,
}))
  .attrs({ role: 'button' })
  .when('state:hover', { style: { opacity: 0.85 } })
  .when('state:pressed', { style: { transform: 'scale(0.98)' } })
  .when('platform:web', { style: { cursor: 'pointer' } });

const ActionLabel = engine<'Text', { danger?: boolean }>('Text', ({ theme, props }) => ({
  fontSize: 16,
  fontWeight: '600',
  color: props.danger ? theme.color.error : theme.color.text,
}));

const List = engine('Scroll', { flex: 1 });

const Item = engine('Box', ({ theme }) => ({
  paddingBlock: 14,
  borderBottomWidth: 1,
  borderColor: theme.color.border,
}));

const DETENT_NAMES = ['40%', 'full'];

/** Bottom sheets: fit to content, detents with a scrolling list, and a non-modal sheet. */
export function SheetPage() {
  const [actions, setActions] = useState(false);
  const [list, setList] = useState(false);
  const [panel, setPanel] = useState(false);
  const [grabber, setGrabber] = useState(true);
  const [dismissible, setDismissible] = useState(true);
  const [detent, setDetent] = useState(0);
  const listSheet = useRef<BottomSheetHandle>(null);
  const { events, log } = useEventLog();

  // non-modal: drawn at the root of the screen, not inside the scrolling page
  useOverlay(
    <Sheet open={panel} modal={false} dismissible={false} detents={[160, '50%']} label="Now playing" testID="sheet-panel">
      <Heading>Now playing</Heading>
      <Body muted>The page behind still scrolls and responds. Drag up for more.</Body>
      <Row wrap>
        <Button size="sm" onPress={() => setPanel(false)}>
          <ButtonLabel>Close</ButtonLabel>
        </Button>
      </Row>
    </Sheet>,
    [panel],
  );

  const pick = (label: string) => {
    log(`picked ${label}`);
    setActions(false);
  };

  return (
    <PageShell title="BottomSheet" summary="The platform's own sheet: SwiftUI on iOS, Jetpack Compose on Android and a native <dialog> on the web. The content is regular components.">
      <Section title="Fit to content" hint="detents defaults to ['fit']: the sheet is as tall as what is inside.">
        <Row wrap>
          <Button onPress={() => setActions(true)} testID="open-actions">
            <ButtonLabel>Open actions</ButtonLabel>
          </Button>
        </Row>
        <Flags>
          <Flag label="grabber" on={grabber} onChange={setGrabber} />
          <Flag label="dismissible" on={dismissible} onChange={setDismissible} />
        </Flags>
      </Section>

      <Section title="Detents" hint="['40%', 'full']: drag between them. The list scrolls inside; the ref moves it with snapTo().">
        <Row wrap>
          <Button onPress={() => setList(true)} testID="open-list">
            <ButtonLabel>Open list</ButtonLabel>
          </Button>
        </Row>
        <Body muted>Resting at: {DETENT_NAMES[detent]}</Body>
      </Section>

      <Section title="Non-modal" hint="modal={false}: no backdrop, the page behind keeps working (like Maps).">
        <Row wrap>
          <Button variant="secondary" onPress={() => setPanel((on) => !on)} testID="toggle-panel">
            <ButtonLabel>{panel ? 'Hide panel' : 'Show panel'}</ButtonLabel>
          </Button>
        </Row>
      </Section>

      <Section title="Events">
        <EventLog events={events} />
      </Section>

      <Section title="In code">
        <Code>{`
const Sheet = engine('BottomSheet', ({ theme }) => ({
  backgroundColor: theme.color.surface,   // leave out for the system look
  padding: theme.spacing.lg,
}));

<Sheet open={open} onOpenChange={setOpen}>…</Sheet>

<Sheet open={open} onOpenChange={setOpen}
  detents={['40%', 'full']} onDetentChange={({ index }) => …} />

<Sheet open modal={false} detents={[160, '50%']} dismissible={false} />
        `}</Code>
      </Section>

      <Sheet
        open={actions}
        onOpenChange={setActions}
        grabber={grabber}
        dismissible={dismissible}
        label="Actions"
        onClosed={() => log('actions closed')}
        testID="sheet-actions"
      >
        <Heading>Share “Big Buck Bunny”</Heading>
        {['Copy link', 'Send to…', 'Add to playlist'].map((label) => (
          <Action key={label} onPress={() => pick(label)}>
            <ActionLabel>{label}</ActionLabel>
          </Action>
        ))}
        <Action danger onPress={() => pick('Delete')}>
          <ActionLabel danger>Delete</ActionLabel>
        </Action>
      </Sheet>

      <Sheet
        ref={listSheet}
        open={list}
        onOpenChange={setList}
        detents={['40%', 'full']}
        detent={detent}
        onDetentChange={({ index }) => {
          setDetent(index);
          log(`detent ${DETENT_NAMES[index]}`);
        }}
        label="Episodes"
        onClosed={() => log('list closed')}
        testID="sheet-list"
      >
        <Row between>
          <Heading>Episodes</Heading>
          <Button size="sm" variant="secondary" onPress={() => listSheet.current?.snapTo(detent === 0 ? 1 : 0)}>
            <ButtonLabel>{detent === 0 ? 'Expand' : 'Collapse'}</ButtonLabel>
          </Button>
        </Row>
        <List>
          {Array.from({ length: 30 }, (_, i) => (
            <Item key={i}>
              <Body>Episode {i + 1}</Body>
            </Item>
          ))}
        </List>
      </Sheet>

    </PageShell>
  );
}
