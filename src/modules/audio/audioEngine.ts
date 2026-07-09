// src/modules/audio/audioEngine.ts
import type {
  FxState,
  PadId,
  SampleAsset,
  SampleId,
} from '../../types/project';
import type { AudioEngineContract } from '../../types/contracts';

// ============================================================
// 1. 内部状态管理
// ============================================================

class AudioEngineState {
  ctx: AudioContext | null = null;
  sampleBuffers: Map<SampleId, AudioBuffer> = new Map();
  padSampleMap: Map<PadId, SampleId> = new Map();
  activeSources: Map<PadId, AudioBufferSourceNode[]> = new Map();
  padGains: Map<PadId, GainNode> = new Map();

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
    bitcrusherAmount: 0.0,
  };
}

const state = new AudioEngineState();

// ============================================================
// 2. 工具函数
// ============================================================

function createReverbImpulse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(2, length, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const t = i / length;
    const envelope = Math.exp(-t * decay);
    left[i] = (Math.random() * 2 - 1) * envelope;
    right[i] = (Math.random() * 2 - 1) * envelope;
  }
  return buffer;
}

function createBitcrusherCurve(amount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(256 * Float32Array.BYTES_PER_ELEMENT));
  const clamped = Math.min(1, Math.max(0, amount));

  if (clamped <= 0) {
    for (let i = 0; i < 256; i++) {
      curve[i] = (i - 128) / 128;
    }

    return curve;
  }

  const steps = Math.max(2, Math.round(32 - 30 * clamped));

  for (let i = 0; i < 256; i++) {
    const x = (i - 128) / 128;
    curve[i] = Math.min(1, Math.max(-1, Math.round(x * steps) / steps));
  }

  return curve;
}

function connectPadGain(gain: GainNode): void {
  if (state.bitcrusherNode) {
    gain.connect(state.bitcrusherNode);
    return;
  }

  if (state.filterNode) {
    gain.connect(state.filterNode);
    return;
  }

  if (state.masterGain) {
    gain.connect(state.masterGain);
  }
}

// ============================================================
// 3. 核心 AudioEngine
// ============================================================

export const audioEngine: AudioEngineContract = {
  async initAudioEngine(): Promise<void> {
    if (state.ctx && state.ctx.state !== 'closed') {
      return;
    }

    const ctx = new AudioContext();
    state.ctx = ctx;

    // 主音量
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.9;
    state.masterGain = masterGain;
    masterGain.connect(ctx.destination);

    // Bitcrusher 放在最前面，amount=0 时为近似直通
    const bitcrusher = ctx.createWaveShaper();
    bitcrusher.curve = createBitcrusherCurve(0);
    state.bitcrusherNode = bitcrusher;

    // 滤波器
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = state.currentFx.filterCutoff;
    filter.Q.value = 1.0;
    state.filterNode = filter;

    // 混响
    const reverb = ctx.createConvolver();
    const impulse = createReverbImpulse(ctx, 1.2, 4.0);
    reverb.buffer = impulse;
    state.reverbNode = reverb;

    const reverbGain = ctx.createGain();
    reverbGain.gain.value = state.currentFx.reverbAmount;
    state.reverbGain = reverbGain;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 1.0;
    state.reverbDryGain = dryGain;

    // 延迟
    const delay = ctx.createDelay(2.0);
    delay.delayTime.value = 0.3;
    state.delayNode = delay;

    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = state.currentFx.delayFeedback;
    state.delayFeedbackGain = delayFeedback;

    const delayDry = ctx.createGain();
    delayDry.gain.value = 0.35;
    state.delayDryGain = delayDry;

    bitcrusher.connect(filter);
    filter.connect(masterGain);
    filter.connect(reverb);
    reverb.connect(reverbGain);
    reverbGain.connect(masterGain);
    filter.connect(delay);
    delay.connect(delayDry);
    delayDry.connect(masterGain);
    delay.connect(delayFeedback);
    delayFeedback.connect(delay);

    console.log('[AudioEngine] 初始化完成');
  },

  async loadSampleBuffer(sample: SampleAsset): Promise<void> {
    if (!state.ctx) {
      await audioEngine.initAudioEngine();
    }
    const ctx = state.ctx!;

    if (state.sampleBuffers.has(sample.id)) {
      return;
    }

    const response = await fetch(sample.url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    state.sampleBuffers.set(sample.id, audioBuffer);
    console.log(`[AudioEngine] 已加载 Sample: ${sample.name}`);
  },

  assignSampleToPad(padId: PadId, sampleId: SampleId): void {
    if (!state.sampleBuffers.has(sampleId)) {
      console.warn(`[AudioEngine] Sample ${sampleId} 尚未加载`);
      return;
    }
    state.padSampleMap.set(padId, sampleId);

    if (!state.padGains.has(padId) && state.ctx) {
      const gain = state.ctx.createGain();
      gain.gain.value = 0.8;
      connectPadGain(gain);
      state.padGains.set(padId, gain);
    }
    console.log(`[AudioEngine] Pad ${padId} 已绑定 Sample ${sampleId}`);
  },

  triggerPad(padId: PadId, velocity: number = 1): void {
    const ctx = state.ctx;
    if (!ctx) {
      console.warn('[AudioEngine] 未初始化');
      return;
    }

    if (ctx.state === 'suspended') {
      ctx.resume().catch((err) => {
        console.warn('[AudioEngine] 恢复 AudioContext 失败:', err);
      });
    }

    const sampleId = state.padSampleMap.get(padId);
    if (!sampleId) {
      console.warn(`[AudioEngine] Pad ${padId} 未绑定 Sample`);
      return;
    }

    const buffer = state.sampleBuffers.get(sampleId);
    if (!buffer) {
      console.warn(`[AudioEngine] Sample ${sampleId} 未加载`);
      return;
    }

    let gainNode = state.padGains.get(padId);
    if (!gainNode) {
      gainNode = ctx.createGain();
      connectPadGain(gainNode);
      state.padGains.set(padId, gainNode);
    }
    gainNode.gain.value = Math.min(1.2, Math.max(0, 0.8 * velocity));

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    source.connect(gainNode);

    if (!state.activeSources.has(padId)) {
      state.activeSources.set(padId, []);
    }
    state.activeSources.get(padId)!.push(source);

    source.onended = () => {
      const sources = state.activeSources.get(padId) || [];
      const filtered = sources.filter((s) => s !== source);
      if (filtered.length > 0) {
        state.activeSources.set(padId, filtered);
      } else {
        state.activeSources.delete(padId);
      }
      source.disconnect();
    };

    source.start(0, 0, buffer.duration);
    console.log(`[AudioEngine] 触发 Pad ${padId}`);
  },

  stopAllSounds(): void {
    for (const sources of state.activeSources.values()) {
      for (const source of sources) {
        try {
          source.stop();
        } catch (_e) {}
        source.disconnect();
      }
    }
    state.activeSources.clear();
    console.log('[AudioEngine] 已停止所有声音');
  },

  setPadVolume(padId: PadId, volume: number): void {
    const gain = state.padGains.get(padId);
    if (gain) {
      gain.gain.value = Math.min(1.2, Math.max(0, volume));
    }
  },

  setPadPitch(padId: PadId, pitch: number): void {
    console.log(`[AudioEngine] Pad ${padId} pitch 设置为 ${pitch}`);
  },

  applyFxState(fx: Partial<FxState>): void {
    const ctx = state.ctx;
    if (!ctx) {
      console.warn('[AudioEngine] 未初始化，无法应用 FX');
      return;
    }

    Object.assign(state.currentFx, fx);

    // 滤波器
    if (fx.filterCutoff !== undefined && state.filterNode) {
      const minFreq = 200;
      const maxFreq = 12000;
      const freq = Math.min(maxFreq, Math.max(minFreq, fx.filterCutoff));
      state.filterNode.frequency.setValueAtTime(
        freq,
        ctx.currentTime
      );
    }

    // 混响
    if (fx.reverbAmount !== undefined && state.reverbGain) {
      const value = Math.min(1, Math.max(0, fx.reverbAmount));
      state.reverbGain.gain.setValueAtTime(value, ctx.currentTime);
      if (state.reverbDryGain) {
        state.reverbDryGain.gain.setValueAtTime(1 - value, ctx.currentTime);
      }
    }

    // 延迟
    if (fx.delayFeedback !== undefined && state.delayFeedbackGain && state.delayNode) {
      const value = Math.min(0.95, Math.max(0, fx.delayFeedback));
      state.delayFeedbackGain.gain.setValueAtTime(value, ctx.currentTime);
      state.delayNode.delayTime.setValueAtTime(0.3, ctx.currentTime);
    }

    // Bitcrusher
    if (fx.bitcrusherAmount !== undefined && state.bitcrusherNode) {
      state.bitcrusherNode.curve = createBitcrusherCurve(fx.bitcrusherAmount);
    }

    console.log('[AudioEngine] FX 已应用:', fx);
  },
};

// ============================================================
// 4. 单独导出核心方法供其他模块（如 Sequencer）使用
// ============================================================

export const triggerPad = audioEngine.triggerPad.bind(audioEngine);
export const stopAllSounds = audioEngine.stopAllSounds.bind(audioEngine);
export const initAudioEngine = audioEngine.initAudioEngine.bind(audioEngine);
export const loadSampleBuffer = audioEngine.loadSampleBuffer.bind(audioEngine);
export const assignSampleToPad = audioEngine.assignSampleToPad.bind(audioEngine);
export const setPadVolume = audioEngine.setPadVolume.bind(audioEngine);
export const setPadPitch = audioEngine.setPadPitch.bind(audioEngine);
export const applyFxState = audioEngine.applyFxState.bind(audioEngine);

if (import.meta.env.DEV) {
  (window as any).__audioState = state;
}
