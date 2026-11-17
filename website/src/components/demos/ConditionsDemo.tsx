import './setup';
import { useState } from 'react';
import { engine } from '@michelgutner/isoform';
import { Button, ButtonText, Row, Stack } from './kit';

type Tone = 'ok' | 'bad';

const Tag = engine<'Box', { tone?: Tone; dense?: boolean }>('Box')
  .style(({ theme }) => ({ padding: 12, borderRadius: 10, backgroundColor: theme.color.border }))
  .when('props:tone=ok', { style: { backgroundColor: '#dcfce7' } }) // exact value match
  .when('props:dense', { style: { padding: 4 } }) // truthy prop
  .when(({ props }) => props.tone === 'bad', ({ theme }) => ({ // function condition
    style: { backgroundColor: theme.color.error },
  }))
  .when('platform:web', { style: { transition: 'padding .2s, background-color .2s' } });

const TagText = engine('Text', { color: '#12141c', fontWeight: '600' });

export default function ConditionsDemo() {
  const [tone, setTone] = useState<Tone | undefined>('ok');
  const [dense, setDense] = useState(false);
  return (
    <Stack>
      <Tag tone={tone} dense={dense} style={{ alignSelf: 'flex-start' }}>
        <TagText>tone={String(tone)} dense={String(dense)}</TagText>
      </Tag>
      <Row>
        <Button variant="ghost" onPress={() => setTone(tone === 'ok' ? 'bad' : tone === 'bad' ? undefined : 'ok')}>
          <ButtonText ghost>Cycle tone</ButtonText>
        </Button>
        <Button variant="ghost" onPress={() => setDense(!dense)}>
          <ButtonText ghost>Toggle dense</ButtonText>
        </Button>
      </Row>
    </Stack>
  );
}
