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
    audio: false,
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
  });

  const video = videoRef.current;
  if (!video) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error('Video element not available');
  }

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
  // Dynamic import: Human.js is browser-only (WebGL). Keeping it out of the
  // top-level module graph means SSR never resolves @vladmandic/human.
  const { getHuman } = await import('./human');
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

  if (result.face.length > 1) {
    return {
      detected: false,
      descriptor: null,
      antiSpoofScore: null,
      livenessScore: null,
      error: 'Multiple faces detected'
    };
  }

  const face = result.face[0];
  const descriptor = face.embedding ? Array.from(face.embedding) : null;
  const antiSpoofScore = face.real ?? null;
  const livenessScore = face.live ?? null;
  const detectionScore = face.faceScore ?? null;

  return {
    detected: true,
    descriptor,
    antiSpoofScore,
    livenessScore,
    detectionScore
  };
}

export function stopCamera(faceStream: FaceStream | null): void {
  faceStream?.stop();
}
