import { useProjectStore } from '../../store/useProjectStore';
import type { FxState, PadId, SampleAsset, SampleId } from '../../types/project';

let audioContext: AudioContext | null = null;
const sampleBuffers = new Map<SampleId, AudioBuffer>();
const loadingBuffers = new Map<SampleId, Promise<void>>();
const padAssignments = new Map<PadId, SampleId>();
const activeSources = new Set<AudioBufferSourceNode>();
const activeElements = new Set<HTMLAudioElement>();
const activeElementsByPad = new Map<PadId, HTMLAudioElement>();
const activeElementNodes = new Map<HTMLAudioElement, { gain: GainNode; source: MediaElementAudioSourceNode }>();
let fxInputGain: GainNode | null = null;
let masterGain: GainNode | null = null;
let filterNode: BiquadFilterNode | null = null;
let reverbNode: ConvolverNode | null = null;
let reverbGain: GainNode | null = null;
let reverbDryGain: GainNode | null = null;
let delayNode: DelayNode | null = null;
let delayFeedbackGain: GainNode | null = null;
let delayDryGain: GainNode | null = null;
let bitcrusherNode: WaveShaperNode | null = null;
let currentFx: FxState = {
  filterCutoff: 0,
  reverbAmount: 0,
  delayFeedback: 0,
  bitcrusherAmount: 0,
};

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

function createReverbImpulse(context: AudioContext, duration: number, decay: number): AudioBuffer {
  const length = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  for (let index = 0; index < length; index += 1) {
    const envelope = Math.exp(-(index / length) * decay);
    left[index] = (Math.random() * 2 - 1) * envelope;
    right[index] = (Math.random() * 2 - 1) * envelope;
  }

  return buffer;
}

function createBitcrusherCurve(amount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(256 * Float32Array.BYTES_PER_ELEMENT));
  const clamped = Math.min(1, Math.max(0, amount));
  const steps = clamped <= 0 ? 128 : Math.max(2, Math.round(32 - 30 * clamped));

  for (let index = 0; index < curve.length; index += 1) {
    const value = (index - 128) / 128;
    curve[index] = clamped <= 0 ? value : Math.min(1, Math.max(-1, Math.round(value * steps) / steps));
  }

  return curve;
}

function getFilterFrequency(filterCutoff: number): number {
  return filterCutoff <= 0 ? 20_000 : Math.min(12_000, Math.max(200, filterCutoff));
}

function ensureFxGraph(context: AudioContext): void {
  if (fxInputGain && masterGain && filterNode && bitcrusherNode) {
    return;
  }

  fxInputGain = context.createGain();

  masterGain = context.createGain();
  masterGain.gain.value = 0.9;
  masterGain.connect(context.destination);

  bitcrusherNode = context.createWaveShaper();
  bitcrusherNode.curve = createBitcrusherCurve(currentFx.bitcrusherAmount);

  filterNode = context.createBiquadFilter();
  filterNode.type = 'lowpass';
  filterNode.frequency.value = getFilterFrequency(currentFx.filterCutoff);
  filterNode.Q.value = 1;

  reverbNode = context.createConvolver();
  reverbNode.buffer = createReverbImpulse(context, 1.2, 4);

  reverbGain = context.createGain();
  reverbGain.gain.value = currentFx.reverbAmount;

  reverbDryGain = context.createGain();
  reverbDryGain.gain.value = 1 - currentFx.reverbAmount;

  delayNode = context.createDelay(2);
  delayNode.delayTime.value = 0.3;

  delayFeedbackGain = context.createGain();
  delayFeedbackGain.gain.value = currentFx.delayFeedback;

  delayDryGain = context.createGain();
  delayDryGain.gain.value = 0.35;

  fxInputGain.connect(bitcrusherNode);
  bitcrusherNode.connect(filterNode);
  filterNode.connect(reverbDryGain);
  reverbDryGain.connect(masterGain);
  filterNode.connect(reverbNode);
  reverbNode.connect(reverbGain);
  reverbGain.connect(masterGain);
  filterNode.connect(delayNode);
  delayNode.connect(delayDryGain);
  delayDryGain.connect(masterGain);
  delayNode.connect(delayFeedbackGain);
  delayFeedbackGain.connect(delayNode);
}

function cleanupAudioElement(audio: HTMLAudioElement, padId?: PadId): void {
  audio.pause();
  activeElements.delete(audio);

  if (padId && activeElementsByPad.get(padId) === audio) {
    activeElementsByPad.delete(padId);
  }

  const nodes = activeElementNodes.get(audio);
  if (nodes) {
    nodes.source.disconnect();
    nodes.gain.disconnect();
    activeElementNodes.delete(audio);
  }
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
  const context = await ensureAudioReady();
  ensureFxGraph(context);
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

  const previousAudio = activeElementsByPad.get(padId);
  if (previousAudio) {
    cleanupAudioElement(previousAudio, padId);
  }

  const audio = new Audio(sample.url);
  const startTime = Math.max(0, sample.startTime);
  const endTime = Math.max(startTime, sample.endTime || sample.duration || startTime + 2);
  const durationMs = Math.max(50, (endTime - startTime) * 1000);

  audio.volume = Math.max(0, Math.min(1, pad.volume * velocity));
  audio.playbackRate = Math.pow(2, pad.pitch / 12);
  audio.currentTime = startTime;
  activeElements.add(audio);
  activeElementsByPad.set(padId, audio);
  audio.onended = () => {
    cleanupAudioElement(audio, padId);
  };

  window.setTimeout(() => {
    cleanupAudioElement(audio, padId);
  }, durationMs);

  void initAudioEngine()
    .then(() => {
      const context = getAudioContext();
      const mediaSource = context.createMediaElementSource(audio);
      const gain = context.createGain();
      gain.gain.value = Math.max(0, Math.min(1, pad.volume * velocity));
      mediaSource.connect(gain);
      gain.connect(fxInputGain ?? context.destination);
      activeElementNodes.set(audio, { gain, source: mediaSource });

      return audio.play();
    })
    .catch((error: unknown) => {
      cleanupAudioElement(audio, padId);
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
    cleanupAudioElement(audio);
  }

  activeElements.clear();
  activeElementsByPad.clear();
  activeElementNodes.clear();
}

export function setPadVolume(padId: PadId, volume: number): void {
  useProjectStore.getState().updatePad(padId, { volume });
}

export function setPadPitch(padId: PadId, pitch: number): void {
  useProjectStore.getState().updatePad(padId, { pitch });
}

export function applyFxState(fx: Partial<FxState>): void {
  currentFx = { ...currentFx, ...fx };

  if (!audioContext) {
    return;
  }

  ensureFxGraph(audioContext);

  if (fx.filterCutoff !== undefined && filterNode) {
    filterNode.frequency.setValueAtTime(
      getFilterFrequency(fx.filterCutoff),
      audioContext.currentTime,
    );
  }

  if (fx.reverbAmount !== undefined && reverbGain) {
    const value = Math.min(1, Math.max(0, fx.reverbAmount));
    reverbGain.gain.setValueAtTime(value, audioContext.currentTime);
    reverbDryGain?.gain.setValueAtTime(1 - value, audioContext.currentTime);
  }

  if (fx.delayFeedback !== undefined && delayFeedbackGain && delayNode) {
    delayFeedbackGain.gain.setValueAtTime(
      Math.min(0.95, Math.max(0, fx.delayFeedback)),
      audioContext.currentTime,
    );
    delayNode.delayTime.setValueAtTime(0.3, audioContext.currentTime);
  }

  if (fx.bitcrusherAmount !== undefined && bitcrusherNode) {
    bitcrusherNode.curve = createBitcrusherCurve(fx.bitcrusherAmount);
  }
}
