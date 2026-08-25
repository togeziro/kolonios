import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { startCamera, captureFrame, stopCamera, type FaceStream } from '@/lib/face/capture';
import { useTranslation } from 'react-i18next';

interface FaceCaptureProps {
  onCapture: (
    descriptor: number[],
    photo: string,
    antiSpoofScore: number | null,
    livenessScore: number | null
  ) => void;
  onRetake?: () => void;
  disabled?: boolean;
  // Multi-sample flows (face enrollment): adds a "Capture another" action in
  // the captured state that restarts the camera while the parent KEEPS the
  // accumulated samples. Retake remains the erase-and-redo path.
  allowMultipleSamples?: boolean;
}

type CaptureStatus = 'idle' | 'loading' | 'camera' | 'detecting' | 'capturing' | 'captured';

// Device-open races right after navigation (previous page releasing the
// camera, settings flips) reject transiently and settle within moments.
const RETRIABLE_CAMERA_ERRORS = new Set(['NotReadableError', 'AbortError', 'OverconstrainedError']);
const CAMERA_RETRY_BACKOFF_MS = 400;

function cameraErrorName(err: unknown): string {
  if (err instanceof DOMException) return err.name;
  if (err instanceof Error) return err.name === 'Error' ? '' : err.name;
  return '';
}

function cameraErrorKey(
  err: unknown
): 'faceCapture.cameraDenied' | 'faceCapture.cameraBusy' | 'faceCapture.cameraError' {
  const name = cameraErrorName(err);
  if (name === 'NotAllowedError') return 'faceCapture.cameraDenied';
  if (name === 'NotReadableError') return 'faceCapture.cameraBusy';
  return 'faceCapture.cameraError';
}

export function FaceCapture({
  onCapture,
  onRetake,
  disabled,
  allowMultipleSamples
}: FaceCaptureProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [faceStream, setFaceStream] = useState<FaceStream | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [status, setStatus] = useState<CaptureStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Stop camera whenever the component unmounts OR the stream instance changes.
  useEffect(() => {
    return () => stopCamera(faceStream);
  }, [faceStream]);

  // Shared start routine: load Human models, open the camera, enter detecting.
  const beginVerification = useCallback(async () => {
    setError(null);
    setStatus('loading');
    // Pre-load Human models while the camera permission prompt is showing.
    const { getHuman } = await import('@/lib/face/human');
    await getHuman();
    setStatus('camera');
    try {
      const stream = await startCamera(videoRef);
      setFaceStream(stream);
    } catch (err) {
      if (!RETRIABLE_CAMERA_ERRORS.has(cameraErrorName(err))) throw err;
      await new Promise((r) => setTimeout(r, CAMERA_RETRY_BACKOFF_MS));
      const stream = await startCamera(videoRef);
      setFaceStream(stream);
    }
    setStatus('detecting');
  }, []);

  const handleStartCamera = useCallback(async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await beginVerification();
    } catch (err) {
      setError(t(cameraErrorKey(err)));
      setStatus('idle');
    } finally {
      setIsBusy(false);
    }
  }, [beginVerification, isBusy, t]);

  const handleRetake = useCallback(async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      // Let parents drop their captured data before capture restarts.
      onRetake?.();
      stopCamera(faceStream);
      setFaceStream(null);
      setPreviewPhoto(null);
      await beginVerification();
    } catch (err) {
      setError(t(cameraErrorKey(err)));
      setStatus('idle');
    } finally {
      setIsBusy(false);
    }
  }, [beginVerification, faceStream, isBusy, onRetake, t]);

  // Next sample for multi-sample flows: camera restarts but whatever the
  // parent accumulated stays intact (unlike Retake, which erases).
  const handleCaptureAnother = useCallback(async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      stopCamera(faceStream);
      setFaceStream(null);
      setPreviewPhoto(null);
      await beginVerification();
    } catch (err) {
      setError(t(cameraErrorKey(err)));
      setStatus('idle');
    } finally {
      setIsBusy(false);
    }
  }, [beginVerification, faceStream, isBusy, t]);

  const handleCapture = useCallback(async () => {
    if (isBusy) return;
    if (!videoRef.current || !canvasRef.current) return;
    setIsBusy(true);
    setError(null);
    setStatus('capturing');
    try {
      const result = await captureFrame(videoRef.current);

      if (!result.detected || !result.descriptor) {
        setError(result.error ?? t('faceCapture.noFace'));
        setStatus('detecting');
        return;
      }

      // Reject low-quality captures up front (anti-spoof / liveness below gate).
      if (
        (result.antiSpoofScore != null && result.antiSpoofScore < 0.5) ||
        (result.livenessScore != null && result.livenessScore < 0.5)
      ) {
        setError(t('faceCapture.spoofDetected'));
        setStatus('detecting');
        return;
      }

      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      const photo = canvas.toDataURL('image/jpeg', 0.8);

      stopCamera(faceStream);
      setFaceStream(null);
      setPreviewPhoto(photo);
      setStatus('captured');
      onCapture(result.descriptor, photo, result.antiSpoofScore, result.livenessScore);
    } catch {
      setError(t('faceCapture.verificationFailed'));
      setStatus('detecting');
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, faceStream, onCapture, t]);

  return (
    <div className='space-y-4'>
      <div className='relative aspect-square overflow-hidden rounded-2xl border border-zinc-800'>
        <video ref={videoRef} className='h-full w-full object-cover' playsInline muted />
        <canvas ref={canvasRef} className='hidden' />

        {status === 'detecting' && (
          <div className='absolute inset-0 flex items-center justify-center'>
            <div className='h-48 w-48 rounded-full border-2 border-dashed border-zinc-400' />
          </div>
        )}

        {status === 'detecting' && (
          <div className='absolute bottom-4 left-0 right-0 text-center'>
            <p className='text-sm text-zinc-300'>{t('faceCapture.positionFace')}</p>
          </div>
        )}

        {status === 'captured' && previewPhoto && (
          <img
            src={previewPhoto}
            alt={t('attendanceAdmin.capturedFaceAlt')}
            className='absolute inset-0 h-full w-full object-cover'
          />
        )}

        {status === 'capturing' && (
          <div className='absolute inset-0 flex items-center justify-center bg-black/40'>
            <p className='text-sm text-white'>{t('faceCapture.verifying')}</p>
          </div>
        )}
      </div>

      {error && <p className='text-sm text-red-400'>{error}</p>}

      {status === 'idle' && (
        <Button className='w-full' onClick={handleStartCamera} disabled={disabled || isBusy}>
          <Icons.camera className='mr-2 h-4 w-4' />
          {t('faceCapture.startVerification')}
        </Button>
      )}

      {status === 'loading' && (
        <Button className='w-full' disabled>
          {t('faceCapture.loadingModels')}
        </Button>
      )}

      {status === 'detecting' && (
        <Button className='w-full' onClick={handleCapture} disabled={disabled || isBusy}>
          <Icons.camera className='mr-2 h-4 w-4' />
          {t('faceCapture.capture')}
        </Button>
      )}

      {status === 'captured' && (
        <div className='flex gap-2'>
          {allowMultipleSamples && (
            <Button
              className='flex-1'
              variant='outline'
              onClick={handleCaptureAnother}
              disabled={disabled || isBusy}
            >
              <Icons.camera className='mr-2 h-4 w-4' />
              {t('faceCapture.captureAnother')}
            </Button>
          )}
          <Button
            className={allowMultipleSamples ? '' : 'w-full'}
            variant='outline'
            onClick={handleRetake}
            disabled={disabled || isBusy}
          >
            {t('attendanceAdmin.retake')}
          </Button>
        </div>
      )}
    </div>
  );
}
