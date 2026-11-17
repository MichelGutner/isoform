import { clampZoom, sameCodes } from './camera';
import { CameraRequests } from './cameraRequests';

describe('camera helpers', () => {
  it('clamps the zoom to the supported range', () => {
    expect(clampZoom(0.2, 0.5, 10)).toBe(0.5);
    expect(clampZoom(3, 0.5, 10)).toBe(3);
    expect(clampZoom(40, 0.5, 10)).toBe(10);
    expect(clampZoom(Number.NaN, 1, 4)).toBe(1);
  });

  it('compares code lists ignoring order', () => {
    const a = { value: 'https://a', type: 'qr' as const };
    const b = { value: '7891234567895', type: 'ean-13' as const };
    expect(sameCodes([a, b], [b, a])).toBe(true);
    expect(sameCodes([a], [a, b])).toBe(false);
    expect(sameCodes([a], [{ ...a, type: 'aztec' }])).toBe(false);
    expect(sameCodes([], [])).toBe(true);
  });
});

describe('CameraRequests', () => {
  it('settles each request by its id', async () => {
    const requests = new CameraRequests<string>();
    const ids: number[] = [];
    const first = requests.start((id) => ids.push(id));
    const second = requests.start((id) => ids.push(id));
    expect(ids).toEqual([1, 2]);

    expect(requests.settle(2, '', 'two')).toBe(true);
    expect(requests.settle(1, 'boom', '')).toBe(true);
    await expect(second).resolves.toBe('two');
    await expect(first).rejects.toThrow('boom');
    // already settled
    expect(requests.settle(1, '', 'again')).toBe(false);
  });

  it('rejects when the command throws, and on cancelAll', async () => {
    const requests = new CameraRequests<string>();
    await expect(
      requests.start(() => {
        throw new Error('no view');
      }),
    ).rejects.toThrow('no view');

    const waiting = requests.start(() => undefined);
    requests.cancelAll('Camera unmounted');
    await expect(waiting).rejects.toThrow('Camera unmounted');
  });
});
