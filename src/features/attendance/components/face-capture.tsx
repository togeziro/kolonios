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
  disabled?: boolean;
}

type CaptureStatus = 'idle' | 'loading' | 'camera' | 'detecting' | 'capturing' | 'captured';

export function FaceCapture({ onCapture, disabled }: FaceCaptureProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [faceStream, setFaceStream] = useState<FaceStream | null>(null);
  const [status, setStatus] = useState<CaptureStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Stop camera whenever the component unmounts OR the stream instance changes.
  useEffect(() => {
    return () => stopCamera(faceStream);
  }, [faceStream]);

  const handleStartCamera = useCallback(async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      setError(null);
      setStatus('loading');
      // Pre-load Human models while the camera permission prompt is showing.
      const { getHuman } = await import('@/lib/face/human');
      await getHuman();
      setStatus('camera');
      const stream = await startCamera(videoRef);
      setFaceStream(stream);
      setStatus('detecting');
    } catch {
      setError(t('faceCapture.cameraError'));
      setStatus('idle');
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, t]);

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
    </div>
  );
}
