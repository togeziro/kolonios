import { getHuman } from './human';
import type { FaceDetectionResult } from './types';
import type { RefObject } from 'react';

export interface FaceStream {
  stream: MediaStream;
  video: HTMLVideoElement;
  stop: () => void;
}

export async function startCamera(
  videoRef: RefObject<HTMLVideoElement | null>
): Promise<FaceStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
  });

  const video = videoRef.current;
  if (!video) throw new Error('Video element not available');

  video.srcObject = stream;
  await video.play();

  return {
    stream,
    video,
    stop: () => {
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
  };
}

export async function captureFrame(video: HTMLVideoElement): Promise<FaceDetectionResult> {
  const human = await getHuman();

  const result = await human.detect(video);

  if (!result.face || result.face.length === 0) {
    return {
      detected: false,
      descriptor: null,
      antiSpoofScore: null,
      livenessScore: null,
      error: 'No face detected'
    };
  }

  const face = result.face[0];
  const descriptor = face.embedding ? Array.from(face.embedding) : null;
  const antiSpoofScore = face.real ?? null;
  const livenessScore = face.live ?? null;

  return {
    detected: true,
    descriptor,
    antiSpoofScore,
    livenessScore
  };
}

export function stopCamera(faceStream: FaceStream | null): void {
  faceStream?.stop();
}
