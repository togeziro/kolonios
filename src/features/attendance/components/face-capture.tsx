import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { startCamera, captureFrame, stopCamera, type FaceStream } from '@/lib/face/capture';
import { useTranslation } from 'react-i18next';

interface FaceCaptureProps {
  onCapture: (descriptor: number[], photo: string) => void;
  disabled?: boolean;
}

export function FaceCapture({ onCapture, disabled }: FaceCaptureProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [faceStream, setFaceStream] = useState<FaceStream | null>(null);
  const [status, setStatus] = useState<'idle' | 'camera' | 'detecting' | 'captured' | 'capturing'>(
    'idle'
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => stopCamera(faceStream);
  }, [faceStream]);

  const handleStartCamera = useCallback(async () => {
    try {
      setError(null);
      setStatus('camera');
      const stream = await startCamera(videoRef);
      setFaceStream(stream);
      setStatus('detecting');
    } catch {
      setError(t('faceCapture.cameraError'));
      setStatus('idle');
    }
  }, [t]);

  const handleCapture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setStatus('capturing');

    const result = await captureFrame(videoRef.current);

    if (!result.detected || !result.descriptor) {
      setError(result.error ?? t('faceCapture.noFace'));
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
    onCapture(result.descriptor, photo);
  }, [faceStream, onCapture, t]);

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
      </div>

      {error && <p className='text-sm text-red-400'>{error}</p>}

      {status === 'idle' && (
        <Button className='w-full' onClick={handleStartCamera} disabled={disabled}>
          <Icons.camera className='mr-2 h-4 w-4' />
          {t('faceCapture.startVerification')}
        </Button>
      )}

      {status === 'detecting' && (
        <Button className='w-full' onClick={handleCapture} disabled={disabled}>
          <Icons.camera className='mr-2 h-4 w-4' />
          {t('faceCapture.capture')}
        </Button>
      )}
    </div>
  );
}
