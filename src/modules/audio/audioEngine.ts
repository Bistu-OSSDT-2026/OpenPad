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
    filterCutoff: 1.0,
    reverbAmount: 0.0,
    delayFeedback: 0.0,
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

    // 滤波器
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 20000;
    filter.Q.value = 1.0;
    state.filterNode = filter;
    filter.connect(masterGain);

    // 混响
    const reverb = ctx.createConvolver();
    const impulse = createReverbImpulse(ctx, 1.2, 4.0);
    reverb.buffer = impulse;
    state.reverbNode = reverb;

    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.0;
    state.reverbGain = reverbGain;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 1.0;
    state.reverbDryGain = dryGain;

    // 延迟
    const delay = ctx.createDelay(2.0);
    delay.delayTime.value = 0.0;
    state.delayNode = delay;

    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0.0;
    state.delayFeedbackGain = delayFeedback;

    const delayDry = ctx.createGain();
    delayDry.gain.value = 1.0;
    state.delayDryGain = delayDry;

    // Bitcrusher
    const bitcrusher = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i - 128) / 128;
      const steps = 16;
      const quantized = Math.round(x * steps) / steps;
      curve[i] = Math.min(1, Math.max(-1, quantized));
    }
    bitcrusher.curve = curve;
    state.bitcrusherNode = bitcrusher;

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
      gainNode.gain.value = 0.8;
      state.padGains.set(padId, gainNode);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // 简化链路
    source.connect(gainNode);
    if (state.filterNode) {
      gainNode.connect(state.filterNode);
      // 直接连接到 master
      state.filterNode.connect(state.masterGain!);
    } else {
      gainNode.connect(state.masterGain!);
    }

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
    for (const [padId, sources] of state.activeSources) {
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
    // 暂时只做日志，完整实现在 triggerPad 中读取 store
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
      const minFreq = 20;
      const maxFreq = 20000;
      const freq = minFreq * Math.pow(maxFreq / minFreq, Math.min(1, Math.max(0, fx.filterCutoff)));
      state.filterNode.frequency.setValueAtTime(
        Math.min(maxFreq, Math.max(minFreq, freq)),
        ctx.currentTime
      );
    }

    // 混响
    if (fx.reverbAmount !== undefined && state.reverbGain) {
      const value = Math.min(0.8, Math.max(0, fx.reverbAmount));
      state.reverbGain.gain.setValueAtTime(value, ctx.currentTime);
      if (state.reverbDryGain) {
        state.reverbDryGain.gain.setValueAtTime(1 - value, ctx.currentTime);
      }
    }

    // 延迟
    if (fx.delayFeedback !== undefined && state.delayFeedbackGain && state.delayNode) {
      const value = Math.min(0.8, Math.max(0, fx.delayFeedback));
      state.delayFeedbackGain.gain.setValueAtTime(value, ctx.currentTime);
      state.delayNode.delayTime.setValueAtTime(0.3, ctx.currentTime);
    }

    // Bitcrusher
    if (fx.bitcrusherAmount !== undefined && state.bitcrusherNode) {
      const steps = Math.max(2, Math.round(32 - 30 * Math.min(1, Math.max(0, fx.bitcrusherAmount))));
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i - 128) / 128;
        const quantized = Math.round(x * steps) / steps;
        curve[i] = Math.min(1, Math.max(-1, quantized));
      }
      state.bitcrusherNode.curve = curve;
    }

    console.log('[AudioEngine] FX 已应用:', fx);
  },
};

if (import.meta.env.DEV) {
  (window as any).__audioState = state;
}
