import { useProjectStore } from '../../store/useProjectStore';
import type { FxState, PadId, SampleAsset, SampleId } from '../../types/project';

let audioContext: AudioContext | null = null;
const sampleBuffers = new Map<SampleId, AudioBuffer>();
const loadingBuffers = new Map<SampleId, Promise<void>>();
const padAssignments = new Map<PadId, SampleId>();
const activeSources = new Set<AudioBufferSourceNode>();
const activeElements = new Set<HTMLAudioElement>();

function getAudioContext(): AudioContext {
  const AudioContextCtor =
    window.AudioContext ||
    (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    throw new Error('Web Audio is not available in this browser.');
  }

  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContextCtor();
  }

  return audioContext;
}

async function ensureAudioReady(): Promise<AudioContext> {
  const context = getAudioContext();

  if (context.state === 'suspended') {
    await context.resume();
  }

  return context;
}

async function decodeSample(sample: SampleAsset): Promise<AudioBuffer> {
  const context = await ensureAudioReady();
  const response = await fetch(sample.url);

  if (!response.ok) {
    throw new Error(`Unable to load sample: ${sample.name}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return context.decodeAudioData(arrayBuffer.slice(0));
}

function getAssignedSample(padId: PadId): SampleAsset | undefined {
  const state = useProjectStore.getState();
  const pad = state.pads.find((item) => item.id === padId);
  const sampleId = pad?.sampleId ?? padAssignments.get(padId);

  return sampleId ? state.samples.find((sample) => sample.id === sampleId) : undefined;
}

async function ensureSampleBuffer(sample: SampleAsset): Promise<void> {
  if (sampleBuffers.has(sample.id)) {
    return;
  }

  const pending = loadingBuffers.get(sample.id);

  if (pending) {
    await pending;
    return;
  }

  const loadPromise = decodeSample(sample)
    .then((buffer) => {
      sampleBuffers.set(sample.id, buffer);
    })
    .finally(() => {
      loadingBuffers.delete(sample.id);
    });

  loadingBuffers.set(sample.id, loadPromise);
  await loadPromise;
}

export async function initAudioEngine(): Promise<void> {
  await ensureAudioReady();
}

export async function loadSampleBuffer(sample: SampleAsset): Promise<void> {
  await ensureSampleBuffer(sample);
}

export function assignSampleToPad(padId: PadId, sampleId: SampleId): void {
  padAssignments.set(padId, sampleId);
}

export function triggerPad(padId: PadId, velocity = 1): void {
  const state = useProjectStore.getState();
  const pad = state.pads.find((item) => item.id === padId);
  const sample = getAssignedSample(padId);

  if (!pad || pad.muted || !sample) {
    return;
  }

  const audio = new Audio(sample.url);
  const startTime = Math.max(0, sample.startTime);
  const endTime = Math.max(startTime, sample.endTime || sample.duration || startTime + 2);
  const durationMs = Math.max(50, (endTime - startTime) * 1000);

  audio.volume = Math.max(0, Math.min(1, pad.volume * velocity));
  audio.playbackRate = Math.pow(2, pad.pitch / 12);
  audio.currentTime = startTime;
  activeElements.add(audio);
  audio.onended = () => activeElements.delete(audio);

  window.setTimeout(() => {
    audio.pause();
    activeElements.delete(audio);
  }, durationMs);

  void audio.play().catch((error: unknown) => {
    activeElements.delete(audio);
    console.error(error);
  });
}

export function stopAllSounds(): void {
  for (const source of activeSources) {
    try {
      source.stop();
    } catch {
      // Source may already have ended.
    }
  }

  activeSources.clear();

  for (const audio of activeElements) {
    audio.pause();
  }

  activeElements.clear();
}

export function setPadVolume(padId: PadId, volume: number): void {
  useProjectStore.getState().updatePad(padId, { volume });
}

export function setPadPitch(padId: PadId, pitch: number): void {
  useProjectStore.getState().updatePad(padId, { pitch });
}

export function applyFxState(_fx: Partial<FxState>): void {
  // Gesture FX is intentionally out of scope for the pre-gesture baseline.
}
