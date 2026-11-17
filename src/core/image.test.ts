import {
  clampOffset,
  clampZoom,
  decodeBlurhash,
  fitRect,
  flatHeaders,
  isBlurhash,
  nativeContentFit,
  positionFractions,
  prefetchImages,
  resizeModeOf,
  sourceUri,
  zoomOffset,
} from './image';
import { registerBundledProvider, resetProvider } from '../config';

const BOX = { width: 200, height: 100 };
const SQUARE = { width: 100, height: 100 };

describe('image helpers', () => {
  it('reads positions as fractions of the free space', () => {
    expect(positionFractions()).toEqual({ x: 0.5, y: 0.5 });
    expect(positionFractions('top left')).toEqual({ x: 0, y: 0 });
    expect(positionFractions('bottom')).toEqual({ x: 0.5, y: 1 });
    expect(positionFractions('right')).toEqual({ x: 1, y: 0.5 });
  });

  it('places the picture for each contentFit', () => {
    expect(fitRect('cover', 'center', BOX, SQUARE)).toEqual({ x: 0, y: -50, width: 200, height: 200 });
    expect(fitRect('cover', 'top', BOX, SQUARE)).toEqual({ x: 0, y: 0, width: 200, height: 200 });
    expect(fitRect('contain', 'center', BOX, SQUARE)).toEqual({ x: 50, y: 0, width: 100, height: 100 });
    expect(fitRect('contain', 'left', BOX, SQUARE)).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    expect(fitRect('fill', 'center', BOX, SQUARE)).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    expect(fitRect('none', 'center', BOX, { width: 40, height: 20 })).toEqual({ x: 80, y: 40, width: 40, height: 20 });
    expect(fitRect('scale-down', 'center', BOX, { width: 40, height: 20 })).toEqual({ x: 80, y: 40, width: 40, height: 20 });
    expect(fitRect('scale-down', 'center', BOX, { width: 400, height: 400 })).toEqual({ x: 50, y: 0, width: 100, height: 100 });
  });

  it('maps names for the native views and the plain image', () => {
    expect(nativeContentFit('scale-down')).toBe('scaleDown');
    expect(nativeContentFit()).toBe('cover');
    expect(resizeModeOf('fill')).toBe('stretch');
    expect(resizeModeOf('none')).toBe('center');
    expect(flatHeaders({ Authorization: 'Bearer x', 'X-Id': '1' })).toEqual(['Authorization', 'Bearer x', 'X-Id', '1']);
    expect(sourceUri({ uri: 'https://a/b.png' })).toBe('https://a/b.png');
    expect(sourceUri(3)).toBeUndefined();
  });

  it('decodes blurhashes', () => {
    const hash = 'LEHV6nWB2yk8pyo0adR*.7kCMdnj';
    expect(isBlurhash(hash)).toBe(true);
    expect(isBlurhash('LEHV6nWB2yk8')).toBe(false);
    expect(isBlurhash('not a hash!')).toBe(false);
    const pixels = decodeBlurhash(hash, 4, 3)!;
    expect(pixels).toHaveLength(4 * 3 * 4);
    expect(pixels[3]).toBe(255);
    expect(decodeBlurhash('bad', 4, 4)).toBeNull();
  });

  it('keeps zoom and offsets inside the limits', () => {
    expect(clampZoom(0.5)).toBe(1);
    expect(clampZoom(9, 4)).toBe(4);
    expect(clampOffset(500, 100, 2)).toBe(50);
    expect(clampOffset(-500, 100, 2)).toBe(-50);
    expect(clampOffset(30, 100, 1)).toBe(0);
    // zooming 1 → 2 around a point 40 to the right moves the picture 40 left
    expect(zoomOffset(0, 40, 1, 2)).toBe(-40);
    expect(zoomOffset(0, 0, 1, 3)).toBe(0);
  });

  it('prefetch resolves false when the platform has no image cache', async () => {
    resetProvider();
    registerBundledProvider({ name: 'test', os: () => 'test', primitives: {}, compileStyle: () => ({}), applyProps: ({ props }) => props });
    await expect(prefetchImages('https://a/b.png')).resolves.toBe(false);
  });
});
