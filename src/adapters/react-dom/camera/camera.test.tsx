/**
 * @jest-environment jsdom
 */
import React, { createRef } from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { configure, registerBundledProvider, resetProvider } from '../../../config';
import type { CameraHandle } from '../../../core/camera';
import { engine } from '../../../core/engine';
import { reactDomAdapter } from '../adapter';
import { streamConstraints, toCodes } from './webCamera';

const stopTrack = jest.fn();
const fakeStream = () =>
  ({
    getTracks: () => [{ stop: stopTrack }],
    getVideoTracks: () => [{ stop: stopTrack, getCapabilities: () => ({}), applyConstraints: jest.fn(() => Promise.resolve()) }],
  }) as unknown as MediaStream;

const getUserMedia = jest.fn();

beforeAll(() => {
  Object.defineProperty(globalThis.navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  // jsdom has no media playback
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: () => Promise.resolve() });
  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', { configurable: true, set() {}, get: () => null });
});

let warnSpy: jest.SpyInstance;
beforeEach(() => {
  resetProvider();
  registerBundledProvider(reactDomAdapter);
  getUserMedia.mockReset();
  stopTrack.mockReset();
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warnSpy.mockRestore());

const Preview = engine('Camera', { height: 240 });

describe('Camera (web)', () => {
  it('opens the camera stream and reports the permission', async () => {
    configure({ modules: { camera: true } });
    getUserMedia.mockResolvedValue(fakeStream());
    const onPermissionChange = jest.fn();
    const { container, unmount } = render(
      <Preview facing="front" onPermissionChange={onPermissionChange} testID="cam">
        <span>overlay</span>
      </Preview>,
    );
    await waitFor(() => expect(onPermissionChange).toHaveBeenCalledWith({ camera: 'granted', microphone: 'undetermined' }));
    expect(getUserMedia).toHaveBeenCalledWith(streamConstraints('front', false));
    expect(container.querySelector('video')).not.toBeNull();
    expect(container.textContent).toContain('overlay');
    // the stream is stopped when the camera goes away
    unmount();
    expect(stopTrack).toHaveBeenCalled();
  });

  it('shows the notice when the user refuses, and retries from its button', async () => {
    configure({ modules: { camera: true } });
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    const { findByRole, getByText } = render(<Preview permissionMessage="Camera please" permissionButtonLabel="Try again" />);
    expect((await findByRole('alert')).textContent).toContain('Camera please');

    getUserMedia.mockResolvedValueOnce(fakeStream());
    await act(async () => {
      fireEvent.click(getByText('Try again'));
    });
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('keeps the microphone out unless video is on in the config', async () => {
    configure({ modules: { camera: { enabled: true, video: true } } });
    getUserMedia.mockResolvedValue(fakeStream());
    render(<Preview video />);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledWith(streamConstraints('back', true)));
  });

  it('rejects captures before the camera is ready', async () => {
    configure({ modules: { camera: true } });
    getUserMedia.mockReturnValue(new Promise(() => undefined));
    const ref = createRef<CameraHandle>();
    render(<Preview ref={ref} />);
    await waitFor(() => expect(ref.current).not.toBeNull());
    await expect(ref.current!.takePhoto()).rejects.toThrow('not ready');
    await expect(ref.current!.startRecording()).rejects.toThrow('video');
  });

  it('maps BarcodeDetector formats to code kinds', () => {
    expect(
      toCodes([
        { rawValue: 'https://a', format: 'qr_code' },
        { rawValue: '789', format: 'ean_13' },
        { rawValue: 'x', format: 'unknown_format' },
      ]),
    ).toEqual([
      { value: 'https://a', type: 'qr' },
      { value: '789', type: 'ean-13' },
    ]);
  });
});
