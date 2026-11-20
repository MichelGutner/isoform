import { useState } from 'react';
import { engine, type ModalAnimation } from 'react-isoform';
import { Body, Button, ButtonLabel, Field, Heading, Row } from '../ui';
import { Choice, Code, EventLog, Flag, Flags, PageShell, Section, useEventLog } from '../kit';

/**
 * `engine('Modal')`: UIKit on iOS, Compose on Android, `<dialog>` on the web.
 * `backgroundColor`, `borderRadius` and `maxWidth` go to the native card; padding and
 * gap to the content.
 */
const Dialog = engine('Modal', ({ theme }) => ({
  backgroundColor: theme.color.surface,
  padding: theme.spacing.lg,
  gap: theme.spacing.md,
}));

const Cover = engine('Modal', ({ theme }) => ({
  backgroundColor: theme.color.background,
  padding: theme.spacing.lg,
  gap: theme.spacing.md,
}));

const ANIMATIONS = ['scale', 'slide', 'fade', 'none'] as const;

/** Modal: a centered dialog or a full-screen cover, the same design on every platform. */
export function ModalPage() {
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState(false);
  const [cover, setCover] = useState(false);
  const [animation, setAnimation] = useState<ModalAnimation>('scale');
  const [dismissible, setDismissible] = useState(true);
  const [name, setName] = useState('');
  const { events, log } = useEventLog();

  return (
    <PageShell
      title="Modal"
      summary="With the modal module on, Modal is the lib's own: a centered dialog as tall as its content, or a full-screen cover, with spring animations, backdrop, keyboard avoidance and a focus trap. iOS: UIKit. Android: Jetpack Compose. Web: <dialog>."
    >
      <Section title="Dialog" hint="Tap the backdrop (or Back on Android, Escape on the web) to close it, unless it is not dismissible.">
        <Choice label="animation" value={animation} options={ANIMATIONS} onChange={setAnimation} />
        <Flags>
          <Flag label="dismissible" on={dismissible} onChange={setDismissible} />
        </Flags>
        <Row wrap>
          <Button onPress={() => setDialog(true)} testID="open-dialog">
            <ButtonLabel>Open dialog</ButtonLabel>
          </Button>
          <Button outlined onPress={() => setForm(true)} testID="open-form">
            <ButtonLabel outlined>Dialog with a field</ButtonLabel>
          </Button>
          <Button outlined onPress={() => setCover(true)} testID="open-cover">
            <ButtonLabel outlined>Full screen</ButtonLabel>
          </Button>
        </Row>
        <EventLog events={events} />
      </Section>

      <Dialog
        open={dialog}
        onOpenChange={(open) => {
          log(`onOpenChange(${open})`);
          setDialog(open);
        }}
        onClosed={() => log('onClosed')}
        animation={animation}
        dismissible={dismissible}
        label="Delete photo"
      >
        <Heading>Delete this photo?</Heading>
        <Body muted>It is removed from all your devices. This cannot be undone.</Body>
        <Row between>
          <Button outlined onPress={() => setDialog(false)}>
            <ButtonLabel outlined>Cancel</ButtonLabel>
          </Button>
          <Button variant="error" onPress={() => setDialog(false)}>
            <ButtonLabel>Delete</ButtonLabel>
          </Button>
        </Row>
      </Dialog>

      <Dialog open={form} onOpenChange={setForm} label="Rename" animation={animation}>
        <Heading>Rename album</Heading>
        <Field value={name} onChangeText={setName} placeholder="Album name" autoFocus />
        <Button onPress={() => setForm(false)}>
          <ButtonLabel>Save</ButtonLabel>
        </Button>
      </Dialog>

      <Cover open={cover} onOpenChange={setCover} presentation="fullScreen" label="Details">
        <Heading>Full screen</Heading>
        <Body>The content stays inside the safe area; the background fills the screen.</Body>
        <Button onPress={() => setCover(false)}>
          <ButtonLabel>Close</ButtonLabel>
        </Button>
      </Cover>

      <Section title="In code">
        <Code>{`
// isoform.config.json
{ "modules": { "modal": true } }

const Dialog = engine('Modal', { backgroundColor: '#fff', borderRadius: 20, padding: 24, gap: 16 });
const [open, setOpen] = useState(false);

<Dialog open={open} onOpenChange={setOpen}
  presentation="dialog"      // 'dialog' | 'fullScreen'
  animation="scale"          // 'scale' | 'slide' | 'fade' | 'none'
  dismissible backdropColor="rgba(0,0,0,0.5)"
  onClosed={() => {}}>
  …
</Dialog>
        `}</Code>
      </Section>
    </PageShell>
  );
}
