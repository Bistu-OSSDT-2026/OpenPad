import { useProjectStore } from '../../store/useProjectStore';
import type { FxState, PadId, SampleAsset, SampleId } from '../../types/project';

let audioContext: AudioContext | null = null;
const sampleBuffers = new Map<SampleId, AudioBuffer>();
const loadingBuffers = new Map<SampleId, Promise<void>>();
const padAssignments = new Map<PadId, SampleId>();
const activeSources = new Set<AudioBufferSourceNode>();

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

  const contextPromise = ensureAudioReady();

  ensureSampleBuffer(sample)
    .then(async () => {
      const context = await contextPromise;
      const buffer = sampleBuffers.get(sample.id);

      if (!buffer) {
        return;
      }

      const source = context.createBufferSource();
      const gain = context.createGain();
      const startTime = Math.max(0, Math.min(sample.startTime, buffer.duration));
      const endTime = Math.max(startTime, Math.min(sample.endTime || buffer.duration, buffer.duration));
      const duration = Math.max(0.001, endTime - startTime);

      source.buffer = buffer;
      source.playbackRate.value = Math.pow(2, pad.pitch / 12);
      gain.gain.value = Math.max(0, Math.min(1, pad.volume * velocity));

      source.connect(gain);
      gain.connect(context.destination);
      activeSources.add(source);
      source.onended = () => activeSources.delete(source);
      source.start(0, startTime, duration);
    })
    .catch((error: unknown) => {
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
