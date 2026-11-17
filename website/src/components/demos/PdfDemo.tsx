import './setup';
import { useState } from 'react';
import { engine } from 'isoform';
import { asset, Caption, Stack } from './kit';

const Document = engine('Pdf', { width: '100%', height: 520, borderRadius: 12 });

export default function PdfDemo() {
  const [status, setStatus] = useState('Loading…');
  return (
    <Stack>
      <Document
        src={asset('handout.pdf')}
        speechLanguage="en-US"
        onLoad={({ pageCount }) => setStatus(`${pageCount} pages`)}
        onPageChange={({ page, pageCount }) => setStatus(`Page ${page} of ${pageCount}`)}
        onSearch={({ query, current, total }) => setStatus(`"${query}": ${current} of ${total}`)}
      />
      <Caption>{status}</Caption>
    </Stack>
  );
}
