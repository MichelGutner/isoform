import { ResponsiveDemo } from '../demos/Responsive';
import { Code, PageShell, Section } from '../kit';

/** Mobile-first breakpoints with `when('breakpoints:…')`. */
export function ResponsivePage() {
  return (
    <PageShell title="Responsive" summary="Breakpoints behave the same on the web (@media) and on mobile (window width): resize the browser or rotate the device.">
      <ResponsiveDemo />
      <Section title="In code">
        <Code>{`
const Grid = engine('Box', { flexDirection: 'column' })
  .when('breakpoints:md', { style: { flexDirection: 'row' } })     // ≥ 768
  .when('breakpoints:<md', { style: { gap: 4 } })                  // below md
  .when('breakpoints:md..lg', { style: { display: 'flex' } });     // between md and lg

configure({ breakpoints: { tablet: 600 } });                       // custom names
        `}</Code>
      </Section>
    </PageShell>
  );
}
