// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import type { FaceStream } from '@/lib/face/capture';
import { FaceCapture } from './face-capture';

const { startCameraMock, captureFrameMock, stopCameraMock, getHumanMock } = vi.hoisted(() => ({
  startCameraMock: vi.fn(),
  captureFrameMock: vi.fn(),
  stopCameraMock: vi.fn(),
  getHumanMock: vi.fn()
}));

// Never let real WebGL / @vladmandic/human code run in jsdom.
vi.mock('@/lib/face/capture', () => ({
  startCamera: startCameraMock,
  captureFrame: captureFrameMock,
  stopCamera: stopCameraMock
}));

vi.mock('@/lib/face/human', () => ({
  getHuman: getHumanMock
}));

const CAPTURED_PHOTO = 'data:image/jpeg;base64,mockphoto';
const CAPTURED_FACE_ALT = 'Captured face photo';

function makeFakeStream(): FaceStream {
  return {
    stream: {} as MediaStream,
    video: {} as HTMLVideoElement,
    stop: vi.fn()
  };
}

function renderFaceCapture(
  onCapture: (descriptor: number[]) => void = vi.fn(),
  onRetake?: () => void,
  allowMultipleSamples?: boolean
) {
  render(
    <I18nextProvider i18n={i18n}>
      <FaceCapture
        onCapture={onCapture}
        onRetake={onRetake}
        allowMultipleSamples={allowMultipleSamples}
      />
    </I18nextProvider>
  );
  return onCapture;
}

async function startAndReachDetecting(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Start face verification' }));
  await screen.findByRole('button', { name: 'Capture' });
}

beforeAll(() => {
  // jsdom has no canvas backend; stub the two methods handleCapture relies on.
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ({ drawImage: vi.fn() }) as unknown as CanvasRenderingContext2D
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => CAPTURED_PHOTO);
});

beforeEach(() => {
  startCameraMock.mockReset();
  captureFrameMock.mockReset();
  stopCameraMock.mockReset();
  getHumanMock.mockReset().mockResolvedValue({});
});

describe('FaceCapture captured-state recovery', () => {
  it('shows the captured preview with a Retake button after a successful capture', async () => {
    const user = userEvent.setup();
    const onCapture = vi.fn();
    startCameraMock.mockResolvedValue(makeFakeStream());
    captureFrameMock.mockResolvedValue({
      detected: true,
      descriptor: [0.1, 0.2],
      antiSpoofScore: 0.9,
      livenessScore: 0.9
    });
    renderFaceCapture(onCapture);

    await startAndReachDetecting(user);
    expect(startCameraMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Capture' }));

    const preview = await screen.findByAltText(CAPTURED_FACE_ALT);
    expect(preview.getAttribute('src')).toBe(CAPTURED_PHOTO);
    expect(screen.getByRole('button', { name: 'Retake' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Capture' })).not.toBeInTheDocument();
    expect(onCapture).toHaveBeenCalledWith([0.1, 0.2], CAPTURED_PHOTO, 0.9, 0.9);
  });

  it('restarts the camera and returns to the detecting UI when Retake is clicked', async () => {
    const user = userEvent.setup();
    startCameraMock.mockResolvedValue(makeFakeStream());
    captureFrameMock.mockResolvedValue({
      detected: true,
      descriptor: [0.1, 0.2],
      antiSpoofScore: 0.9,
      livenessScore: 0.9
    });
    renderFaceCapture();

    await startAndReachDetecting(user);
    await user.click(screen.getByRole('button', { name: 'Capture' }));
    await screen.findByAltText(CAPTURED_FACE_ALT);

    await user.click(screen.getByRole('button', { name: 'Retake' }));

    await waitFor(() => expect(startCameraMock).toHaveBeenCalledTimes(2));
    const captureButton = await screen.findByRole('button', {
      name: 'Capture'
    });
    expect(captureButton.hasAttribute('disabled')).toBe(false);
    expect(screen.queryByAltText(CAPTURED_FACE_ALT)).not.toBeInTheDocument();
  });

  it('calls onRetake before restarting capture when Retake is clicked', async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    const onRetake = vi.fn(() => order.push('onRetake'));
    startCameraMock.mockImplementation(async () => {
      order.push('startCamera');
      return makeFakeStream();
    });
    captureFrameMock.mockResolvedValue({
      detected: true,
      descriptor: [0.1, 0.2],
      antiSpoofScore: 0.9,
      livenessScore: 0.9
    });
    renderFaceCapture(undefined, onRetake);

    await startAndReachDetecting(user);
    await user.click(screen.getByRole('button', { name: 'Capture' }));
    await screen.findByAltText(CAPTURED_FACE_ALT);

    order.length = 0;
    await user.click(screen.getByRole('button', { name: 'Retake' }));

    await waitFor(() => expect(startCameraMock).toHaveBeenCalledTimes(2));
    expect(order).toEqual(['onRetake', 'startCamera']);
    expect(onRetake).toHaveBeenCalledTimes(1);
  });

  it('stays in detecting and shows an error when no face is detected', async () => {
    const user = userEvent.setup();
    const onCapture = vi.fn();
    startCameraMock.mockResolvedValue(makeFakeStream());
    captureFrameMock.mockResolvedValue({
      detected: false,
      descriptor: null,
      antiSpoofScore: null,
      livenessScore: null,
      error: 'No face detected'
    });
    renderFaceCapture(onCapture);

    await startAndReachDetecting(user);
    await user.click(screen.getByRole('button', { name: 'Capture' }));

    await waitFor(() => expect(screen.getByText(/no face detected/i)).toBeInTheDocument());
    const captureButton = screen.getByRole('button', { name: 'Capture' });
    expect(captureButton.hasAttribute('disabled')).toBe(false);
    expect(onCapture).not.toHaveBeenCalled();
  });
});

describe('FaceCapture camera-start failure handling', () => {
  it('retries once and recovers when the camera open fails with a transient error', async () => {
    const user = userEvent.setup();
    startCameraMock
      .mockRejectedValueOnce(new DOMException('device busy', 'NotReadableError'))
      .mockResolvedValue(makeFakeStream());
    renderFaceCapture();

    await user.click(screen.getByRole('button', { name: 'Start face verification' }));

    await screen.findByRole('button', { name: 'Capture' });
    expect(startCameraMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/camera/i)).not.toBeInTheDocument();
  });

  it('does not retry on permission denial and shows the denied message', async () => {
    const user = userEvent.setup();
    startCameraMock.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    renderFaceCapture();

    await user.click(screen.getByRole('button', { name: 'Start face verification' }));

    await waitFor(() => expect(screen.getByText('Camera access denied')).toBeInTheDocument());
    expect(startCameraMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Start face verification' })).toBeInTheDocument();
  });

  it('shows the busy message when the transient error persists after the retry', async () => {
    const user = userEvent.setup();
    startCameraMock.mockRejectedValue(new DOMException('device busy', 'NotReadableError'));
    renderFaceCapture();

    await user.click(screen.getByRole('button', { name: 'Start face verification' }));

    await waitFor(() => expect(screen.getByText(/camera is busy/i)).toBeInTheDocument());
    expect(startCameraMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to the generic message for unexpected start failures', async () => {
    const user = userEvent.setup();
    startCameraMock.mockRejectedValue(new Error('Video element not available'));
    renderFaceCapture();

    await user.click(screen.getByRole('button', { name: 'Start face verification' }));

    await waitFor(() =>
      expect(screen.getByText(/could not access the camera/i)).toBeInTheDocument()
    );
    expect(startCameraMock).toHaveBeenCalledTimes(1);
  });
});

describe('FaceCapture multi-sample enrollment', () => {
  const detected = {
    detected: true,
    descriptor: [0.1, 0.2],
    antiSpoofScore: 0.9,
    livenessScore: 0.9
  };

  function renderFaceCaptureWithSamples(onRetake?: () => void) {
    startCameraMock.mockResolvedValue(makeFakeStream());
    captureFrameMock.mockResolvedValue(detected);
    renderFaceCapture(vi.fn(), onRetake, true);
  }

  it('offers Capture another in the captured state when allowMultipleSamples is set', async () => {
    const user = userEvent.setup();
    renderFaceCaptureWithSamples();

    await startAndReachDetecting(user);
    await user.click(screen.getByRole('button', { name: 'Capture' }));
    await screen.findByAltText(CAPTURED_FACE_ALT);

    expect(screen.getByRole('button', { name: 'Capture another sample' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retake' })).toBeInTheDocument();
  });

  it('Capture another restarts the camera without calling onRetake', async () => {
    const user = userEvent.setup();
    const onRetake = vi.fn();
    renderFaceCaptureWithSamples(onRetake);

    await startAndReachDetecting(user);
    await user.click(screen.getByRole('button', { name: 'Capture' }));
    await screen.findByAltText(CAPTURED_FACE_ALT);

    await user.click(screen.getByRole('button', { name: 'Capture another sample' }));

    await waitFor(() => expect(startCameraMock).toHaveBeenCalledTimes(2));
    expect(onRetake).not.toHaveBeenCalled();
    await screen.findByRole('button', { name: 'Capture' });
  });

  it('single-sample mode keeps only the Retake button', async () => {
    const user = userEvent.setup();
    startCameraMock.mockResolvedValue(makeFakeStream());
    captureFrameMock.mockResolvedValue(detected);
    renderFaceCapture();

    await startAndReachDetecting(user);
    await user.click(screen.getByRole('button', { name: 'Capture' }));
    await screen.findByAltText(CAPTURED_FACE_ALT);

    expect(
      screen.queryByRole('button', { name: 'Capture another sample' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retake' })).toBeInTheDocument();
  });
});
