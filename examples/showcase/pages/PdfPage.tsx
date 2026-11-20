import { useState } from 'react';
import { engine } from 'react-isoform';
import { Body } from '../ui';
import { Choice, Code, EventLog, Flag, Flags, PageShell, Section, useEventLog } from '../kit';
import { LISTS, PDFS } from '../media';

/** `engine('Pdf')`: a full viewer (pdf.js on the web, a Compose viewer on Android, PDFKit on iOS). */
const Viewer = engine('Pdf', { width: '100%', height: 560 });

/** Pdf: search with highlights, thumbnails, zoom, outline, links, read aloud and horizontal pages. */
export function PdfPage() {
  const [source, setSource] = useState<'single' | 'playlist'>('single');
  const [direction, setDirection] = useState<'vertical' | 'horizontal'>('vertical');
  const [fit, setFit] = useState<'width' | 'page'>('width');
  const [night, setNight] = useState(false);
  const { events, log } = useEventLog();

  return (
    <PageShell title="Pdf" summary="A premium viewer: search with highlighted matches, thumbnails, zoom, outline, links, night mode, fullscreen and read aloud.">
      <Section title="Viewer" hint="Use the toolbar: search, thumbnails, zoom, fullscreen, read aloud (with a voice picker) and horizontal pages.">
        <Viewer
          src={source === 'single' ? PDFS.paper : undefined}
          items={source === 'playlist' ? LISTS.pdfs : undefined}
          direction={direction}
          fit={fit}
          nightMode={night}
          onLoad={({ pageCount }) => log(`load ${pageCount} pages`)}
          onPageChange={({ page, pageCount }) => log(`page ${page}/${pageCount}`)}
          onSearch={({ query, total }) => log(`search “${query}”: ${total}`)}
          onLinkPress={(url) => log(`link ${url}`)}
          onReadAloudChange={(reading) => log(reading ? 'read aloud on' : 'read aloud off')}
          onFullscreenChange={(fullscreen) => log(fullscreen ? 'fullscreen on' : 'fullscreen off')}
          onItemChange={({ index, item }) => log(`item ${index + 1}: ${item.title ?? item.src}`)}
          onError={(message) => log(`error ${message}`)}
        />
        <Choice label="Source" value={source} options={['single', 'playlist'] as const} onChange={setSource} />
        <Choice label="Pages" value={direction} options={['vertical', 'horizontal'] as const} onChange={setDirection} />
        <Choice label="Fit" value={fit} options={['width', 'page'] as const} onChange={setFit} />
        <Flags>
          <Flag label="night mode" on={night} onChange={setNight} />
        </Flags>
        <Body muted>On devices that cannot render the full viewer, a basic one is used automatically.</Body>
      </Section>

      <Section title="Events">
        <EventLog events={events} />
      </Section>

      <Section title="In code">
        <Code>{`
const Viewer = engine('Pdf', { width: '100%', height: 560 });

<Viewer src="https://…/file.pdf" direction="horizontal" nightMode />

<Viewer items={[{ src, title, thumbnail }, …]} />
        `}</Code>
      </Section>
    </PageShell>
  );
}
