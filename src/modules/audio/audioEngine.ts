import { useProjectStore } from '../../store/useProjectStore';
import type { AudioEngineContract } from '../../types/contracts';
import type { FxState, PadId, SampleAsset, SampleId } from '../../types/project';

class AudioEngineState {
  ctx: AudioContext | null = null;
  sampleBuffers = new Map<SampleId, AudioBuffer>();
  loadingBuffers = new Map<SampleId, Promise<AudioBuffer>>();
  padSampleMap = new Map<PadId, SampleId>();
  activeSources = new Map<PadId, AudioBufferSourceNode[]>();
  padGains = new Map<PadId, GainNode>();
  masterGain: GainNode | null = null;
  filterNode: BiquadFilterNode | null = null;
  reverbNode: ConvolverNode | null = null;
  reverbGain: GainNode | null = null;
  reverbDryGain: GainNode | null = null;
  delayNode: DelayNode | null = null;
  delayFeedbackGain: GainNode | null = null;
  delayDryGain: GainNode | null = null;
  bitcrusherNode: WaveShaperNode | null = null;
  currentFx: FxState = {
    filterCutoff: 8400,
    reverbAmount: 0.18,
    delayFeedback: 0.22,
    bitcrusherAmount: 0,
  };
}

const state = new AudioEngineState();

function getAudioContext(): AudioContext {
  const AudioContextCtor =
    window.AudioContext ||
    (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    throw new Error('Web Audio is not available in this browser.');
  }

  if (!state.ctx || state.ctx.state === 'closed') {
    state.ctx = new AudioContextCtor();
  }

  return state.ctx;
}

async function ensureAudioReady(): Promise<AudioContext> {
  const ctx = getAudioContext();

  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  return ctx;
}

function createReverbImpulse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
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

  for (let index = 0; index < 256; index += 1) {
    const value = (index - 128) / 128;
    curve[index] = clamped <= 0 ? value : Math.min(1, Math.max(-1, Math.round(value * steps) / steps));
  }

  return curve;
}

function connectPadGain(gain: GainNode): void {
  if (state.bitcrusherNode) {
    gain.connect(state.bitcrusherNode);
  } else if (state.filterNode) {
    gain.connect(state.filterNode);
  } else if (state.masterGain) {
    gain.connect(state.masterGain);
  }
}

function getSampleForPad(padId: PadId): SampleAsset | undefined {
  const project = useProjectStore.getState();
  const pad = project.pads.find((item) => item.id === padId);
  const sampleId = pad?.sampleId ?? state.padSampleMap.get(padId);

  return sampleId ? project.samples.find((sample) => sample.id === sampleId) : undefined;
}

async function decodeSample(sample: SampleAsset): Promise<AudioBuffer> {
  if (state.sampleBuffers.has(sample.id)) {
    return state.sampleBuffers.get(sample.id)!;
  }

  const pending = state.loadingBuffers.get(sample.id);

  if (pending) {
    return pending;
  }

  const loadPromise = ensureAudioReady()
    .then(async (ctx) => {
      const response = await fetch(sample.url);

      if (!response.ok) {
        throw new Error(`Unable to load sample ${sample.name}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      state.sampleBuffers.set(sample.id, buffer);
      return buffer;
    })
    .finally(() => {
      state.loadingBuffers.delete(sample.id);
    });

  state.loadingBuffers.set(sample.id, loadPromise);
  return loadPromise;
}

function stopPadSources(padId: PadId): void {
  for (const source of state.activeSources.get(padId) ?? []) {
    try {
      source.stop();
    } catch {
      // Source may already have ended.
    }
    source.disconnect();
  }

  state.activeSources.delete(padId);
}

function ensurePadGain(padId: PadId, volume: number, velocity: number): GainNode {
  const ctx = getAudioContext();
  let gain = state.padGains.get(padId);

  if (!gain) {
    gain = ctx.createGain();
    connectPadGain(gain);
    state.padGains.set(padId, gain);
  }

  gain.gain.value = Math.min(1.2, Math.max(0, volume * velocity));
  return gain;
}

export const audioEngine: AudioEngineContract = {
  async initAudioEngine(): Promise<void> {
    const ctx = await ensureAudioReady();

    if (state.masterGain && state.filterNode && state.bitcrusherNode) {
      return;
    }

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.9;
    state.masterGain = masterGain;
    masterGain.connect(ctx.destination);

    const bitcrusher = ctx.createWaveShaper();
    bitcrusher.curve = createBitcrusherCurve(state.currentFx.bitcrusherAmount);
    state.bitcrusherNode = bitcrusher;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = state.currentFx.filterCutoff;
    filter.Q.value = 1;
    state.filterNode = filter;

    const reverb = ctx.createConvolver();
    reverb.buffer = createReverbImpulse(ctx, 1.2, 4);
    state.reverbNode = reverb;

    const reverbGain = ctx.createGain();
    reverbGain.gain.value = state.currentFx.reverbAmount;
    state.reverbGain = reverbGain;

    const reverbDryGain = ctx.createGain();
    reverbDryGain.gain.value = 1 - state.currentFx.reverbAmount;
    state.reverbDryGain = reverbDryGain;

    const delay = ctx.createDelay(2);
    delay.delayTime.value = 0.3;
    state.delayNode = delay;

    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = state.currentFx.delayFeedback;
    state.delayFeedbackGain = delayFeedback;

    const delayDryGain = ctx.createGain();
    delayDryGain.gain.value = 0.35;
    state.delayDryGain = delayDryGain;

    bitcrusher.connect(filter);
    filter.connect(masterGain);
    filter.connect(reverb);
    reverb.connect(reverbGain);
    reverbGain.connect(masterGain);
    filter.connect(delay);
    delay.connect(delayDryGain);
    delayDryGain.connect(masterGain);
    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
  },

  async loadSampleBuffer(sample: SampleAsset): Promise<void> {
    await decodeSample(sample);
  },

  assignSampleToPad(padId: PadId, sampleId: SampleId): void {
    state.padSampleMap.set(padId, sampleId);
  },

  triggerPad(padId: PadId, velocity = 1): void {
    const project = useProjectStore.getState();
    const pad = project.pads.find((item) => item.id === padId);
    const sample = getSampleForPad(padId);

    if (!pad || pad.muted || !sample) {
      return;
    }

    void audioEngine.initAudioEngine()
      .then(() => decodeSample(sample))
      .then((buffer) => {
        stopPadSources(padId);
        const ctx = getAudioContext();
        const source = ctx.createBufferSource();
        const gain = ensurePadGain(padId, pad.volume, velocity);
        const startTime = Math.max(0, Math.min(sample.startTime, buffer.duration));
        const endTime = Math.max(startTime, Math.min(sample.endTime || buffer.duration, buffer.duration));
        const duration = Math.max(0.001, endTime - startTime);

        source.buffer = buffer;
        source.playbackRate.value = Math.pow(2, pad.pitch / 12);
        source.connect(gain);

        const sources = state.activeSources.get(padId) ?? [];
        sources.push(source);
        state.activeSources.set(padId, sources);

        source.onended = () => {
          const active = state.activeSources.get(padId) ?? [];
          const remaining = active.filter((item) => item !== source);
          if (remaining.length > 0) {
            state.activeSources.set(padId, remaining);
          } else {
            state.activeSources.delete(padId);
          }
          source.disconnect();
        };

        source.start(0, startTime, duration);
      })
      .catch((error: unknown) => console.error(error));
  },

  stopAllSounds(): void {
    for (const padId of state.activeSources.keys()) {
      stopPadSources(padId);
    }
  },

  setPadVolume(padId: PadId, volume: number): void {
    const gain = state.padGains.get(padId);
    if (gain) {
      gain.gain.value = Math.min(1.2, Math.max(0, volume));
    }
  },

  setPadPitch(padId: PadId, pitch: number): void {
    void padId;
    void pitch;
  },

  applyFxState(fx: Partial<FxState>): void {
    Object.assign(state.currentFx, fx);

    if (!state.ctx) {
      return;
    }

    const ctx = state.ctx;

    if (fx.filterCutoff !== undefined && state.filterNode) {
      state.filterNode.frequency.setValueAtTime(
        Math.min(12000, Math.max(200, fx.filterCutoff)),
        ctx.currentTime,
      );
    }

    if (fx.reverbAmount !== undefined && state.reverbGain) {
      const value = Math.min(1, Math.max(0, fx.reverbAmount));
      state.reverbGain.gain.setValueAtTime(value, ctx.currentTime);
      state.reverbDryGain?.gain.setValueAtTime(1 - value, ctx.currentTime);
    }

    if (fx.delayFeedback !== undefined && state.delayFeedbackGain && state.delayNode) {
      state.delayFeedbackGain.gain.setValueAtTime(
        Math.min(0.95, Math.max(0, fx.delayFeedback)),
        ctx.currentTime,
      );
      state.delayNode.delayTime.setValueAtTime(0.3, ctx.currentTime);
    }

    if (fx.bitcrusherAmount !== undefined && state.bitcrusherNode) {
      state.bitcrusherNode.curve = createBitcrusherCurve(fx.bitcrusherAmount);
    }
  },
};

export const triggerPad = audioEngine.triggerPad.bind(audioEngine);
export const stopAllSounds = audioEngine.stopAllSounds.bind(audioEngine);
export const initAudioEngine = audioEngine.initAudioEngine.bind(audioEngine);
export const loadSampleBuffer = audioEngine.loadSampleBuffer.bind(audioEngine);
export const assignSampleToPad = audioEngine.assignSampleToPad.bind(audioEngine);
export const setPadVolume = audioEngine.setPadVolume.bind(audioEngine);
export const setPadPitch = audioEngine.setPadPitch.bind(audioEngine);
export const applyFxState = audioEngine.applyFxState.bind(audioEngine);
