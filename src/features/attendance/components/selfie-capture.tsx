import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

export interface SelfieCaptureProps {
  required: boolean;
  disabled?: boolean;
  onCapture: (dataUrl: string) => void;
  onClear: () => void;
}

/**
 * Browser camera capture using Media Capture APIs. The captured image is
 * returned as a data URL; no camera library is used. Shows a preview with a
 * retake flow.
 */
export function SelfieCapture({ required, disabled, onCapture, onClear }: SelfieCaptureProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActive(false);
  };

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      streamRef.current = stream;
      setActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      });
    } catch {
      setError(t('attendanceAdmin.cameraUnavailable'));
      setActive(false);
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setError(t('attendanceAdmin.cameraUnavailable'));
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError(t('attendanceAdmin.cameraUnavailable'));
      return;
    }
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    if (dataUrl.length > 5_000_000) {
      setError(t('attendanceAdmin.cameraUnavailable'));
      return;
    }
    setPreview(dataUrl);
    stopStream();
    onCapture(dataUrl);
  };

  const retake = () => {
    setPreview(null);
    onClear();
    void startCamera();
  };

  if (!active && !preview) {
    return (
      <div className='space-y-2'>
        <Button
          type='button'
          variant='outline'
          className='w-full'
          disabled={disabled}
          onClick={() => void startCamera()}
        >
          {required
            ? `* ${t('attendanceAdmin.captureSelfie')}`
            : t('attendanceAdmin.captureSelfie')}
        </Button>
        {error && <p className='text-xs text-destructive'>{error}</p>}
      </div>
    );
  }

  return (
    <div className='space-y-2'>
      {preview ? (
        <img src={preview} alt='selfie' className='mx-auto h-40 rounded-md border object-cover' />
      ) : (
        <video
          ref={videoRef}
          className='mx-auto h-40 w-full rounded-md border bg-black object-cover'
          playsInline
          muted
        />
      )}
      {error && <p className='text-xs text-destructive'>{error}</p>}
      <div className='flex gap-2'>
        {!preview && (
          <Button type='button' size='sm' className='flex-1' onClick={capture} disabled={disabled}>
            {t('attendanceAdmin.captureNow')}
          </Button>
        )}
        {preview && (
          <Button type='button' variant='outline' size='sm' className='flex-1' onClick={retake}>
            {t('attendanceAdmin.retake')}
          </Button>
        )}
      </div>
    </div>
  );
}
