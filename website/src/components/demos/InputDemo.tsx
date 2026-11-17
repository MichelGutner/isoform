import './setup';
import { useState } from 'react';
import { engine } from 'isoform';

const Field = engine('Input', ({ theme }) => ({
  paddingBlock: 10,
  paddingInline: 12,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: theme.color.border,
  backgroundColor: theme.color.surface,
  color: theme.color.text,
  fontSize: 15,
  maxWidth: 360,
}))
  .when('state:focus', ({ theme }) => ({ style: { borderColor: theme.color.primary } }))
  .when('::placeholder', ({ theme }) => ({ style: { color: theme.color.muted } }));

const Echo = engine('Text', ({ theme }) => ({ color: theme.color.muted, fontSize: 13 }));
const Stack = engine('Box', { gap: 10 });

export default function InputDemo() {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState('');
  return (
    <Stack>
      <Field
        value={name}
        onChangeText={setName} // the text, not the event, on both platforms
        onSubmitEditing={() => setSubmitted(name)}
        placeholder="Your name, then Enter"
        aria-label="Name"
      />
      <Field type="password" placeholder="Password" aria-label="Password" />
      <Field multiline numberOfLines={3} placeholder="A multiline note" aria-label="Note" />
      <Echo>{submitted ? `Submitted: ${submitted}` : `Typing: ${name || '…'}`}</Echo>
    </Stack>
  );
}
