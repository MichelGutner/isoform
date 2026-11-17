import { percentBox, viewportRect } from './pdfDocument';

/** Same transform as pdf.js `PageViewport` at scale 1, rotation 0: y grows downwards from the page top. */
const fakeViewport = (height: number) => ({
  convertToViewportPoint: (x: number, y: number) => [x, height - y],
});

describe('pdf link boxes', () => {
  it('maps a PDF rectangle to viewport corners', () => {
    expect(viewportRect(fakeViewport(800), [100, 700, 300, 750])).toEqual([100, 100, 300, 50]);
  });

  it('turns the viewport rectangle into page percentages, whatever the corner order', () => {
    const size = { width: 600, height: 800 };
    expect(percentBox(viewportRect(fakeViewport(800), [60, 720, 300, 760]), size)).toEqual({ left: 10, top: 5, width: 40, height: 5 });
  });
});
