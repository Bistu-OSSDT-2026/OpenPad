import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';
import type { GestureState } from '../../types/project';

const DEFAULT_GESTURE: GestureState = {
  handX: 0.5,
  handY: 0.5,
  openness: 0,
  confidence: 0,
};

const HAND_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const HAND_LANDMARKER_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

let changeCallback: ((gesture: GestureState) => void) | undefined;
let handLandmarker: HandLandmarker | null = null;
let mediaStream: MediaStream | null = null;
let trackedVideoElement: HTMLVideoElement | null = null;
let animationFrameId: number | null = null;
let lastVideoTime = -1;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;

  return Math.sqrt(dx * dx + dy * dy);
}

function getPalmCenter(landmarks: Array<{ x: number; y: number }>) {
  const indices = [0, 5, 9, 13, 17];
  const sum = indices.reduce(
    (acc, index) => ({
      x: acc.x + landmarks[index].x,
      y: acc.y + landmarks[index].y,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: sum.x / indices.length,
    y: sum.y / indices.length,
  };
}

function toGestureState(result: HandLandmarkerResult): GestureState {
  const landmarks = result.landmarks[0];

  if (!landmarks) {
    return DEFAULT_GESTURE;
  }

  const palmCenter = getPalmCenter(landmarks);
  const opennessDistance =
    (
      distance(landmarks[8], palmCenter) +
      distance(landmarks[12], palmCenter) +
      distance(landmarks[16], palmCenter) +
      distance(landmarks[20], palmCenter)
    ) / 4;
  const confidence = result.handednesses[0]?.[0]?.score ?? 0;

  return {
    handX: clamp01(palmCenter.x),
    handY: clamp01(palmCenter.y),
    openness: clamp01((opennessDistance - 0.12) / 0.18),
    confidence: clamp01(confidence),
  };
}

async function ensureHandLandmarker(): Promise<HandLandmarker> {
  if (handLandmarker) {
    return handLandmarker;
  }

  const vision = await FilesetResolver.forVisionTasks(HAND_LANDMARKER_WASM_URL);
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: HAND_LANDMARKER_MODEL_URL,
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 1,
  });

  return handLandmarker;
}

function emitGesture(result: HandLandmarkerResult): void {
  changeCallback?.(toGestureState(result));
}

function loopDetection(): void {
  if (!trackedVideoElement || !handLandmarker) {
    return;
  }

  if (trackedVideoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    animationFrameId = window.requestAnimationFrame(loopDetection);
    return;
  }

  if (trackedVideoElement.currentTime !== lastVideoTime) {
    lastVideoTime = trackedVideoElement.currentTime;
    emitGesture(handLandmarker.detectForVideo(trackedVideoElement, performance.now()));
  }

  animationFrameId = window.requestAnimationFrame(loopDetection);
}

export async function startGestureTracking(videoElement: HTMLVideoElement): Promise<void> {
  stopGestureTracking();

  trackedVideoElement = videoElement;
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: 'user',
      width: { ideal: 960 },
      height: { ideal: 540 },
    },
  });

  trackedVideoElement.srcObject = mediaStream;
  trackedVideoElement.muted = true;
  trackedVideoElement.playsInline = true;
  await trackedVideoElement.play();

  await ensureHandLandmarker();

  lastVideoTime = -1;
  loopDetection();
}

export function stopGestureTracking(): void {
  if (animationFrameId !== null) {
    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (trackedVideoElement) {
    trackedVideoElement.pause();
    trackedVideoElement.srcObject = null;
    trackedVideoElement = null;
  }

  for (const track of mediaStream?.getTracks() ?? []) {
    track.stop();
  }

  mediaStream = null;
  lastVideoTime = -1;
}

export function onGestureChange(callback: (gesture: GestureState) => void): void {
  changeCallback = callback;
}
