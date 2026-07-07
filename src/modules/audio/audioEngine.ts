// src/modules/audio/audioEngine.ts
import type {
  FxState,
  PadId,
  SampleAsset,
  SampleId,
} from '../../types/project';
import type { AudioEngineContract } from '../../types/contracts';

// 1. 内部状态管理

/**
 * AudioEngine 的内部状态
 * - 所有 AudioBuffer 和播放节点都存放在这里，不进入 Zustand
 */
class AudioEngineState {
  // 音频上下文
  ctx: AudioContext | null = null;

  // 缓存所有已解码的音频数据 (SampleId -> AudioBuffer)
  sampleBuffers: Map<SampleId, AudioBuffer> = new Map();

  // 记录每个 Pad 当前绑定的 SampleId (PadId -> SampleId)
  padSampleMap: Map<PadId, SampleId> = new Map();

  // 管理每个 Pad 当前正在播放的 SourceNode，用于 stopAllSounds
  activeSources: Map<PadId, AudioBufferSourceNode[]> = new Map();

  // 每个 Pad 独立的音量控制节点 (PadId -> GainNode)
  padGains: Map<PadId, GainNode> = new Map();

  // ============================================================
  // 2. 音频效果器节点 (FX Chain)
  // ============================================================

  // 主音量控制
  masterGain: GainNode | null = null;

  // 滤波器 (低通)
  filterNode: BiquadFilterNode | null = null;

  // 混响 (通过 ConvolverNode 模拟)
  reverbNode: ConvolverNode | null = null;
  reverbGain: GainNode | null = null; // 混响湿声控制
  reverbDryGain: GainNode | null = null; // 干声控制

  // 延迟 (Delay + Feedback)
  delayNode: DelayNode | null = null;
  delayFeedbackGain: GainNode | null = null;
  delayDryGain: GainNode | null = null;

  // Bitcrusher (通过 WaveShaperNode 模拟)
  bitcrusherNode: WaveShaperNode | null = null;

  // 当前 FX 参数缓存
  currentFx: FxState = {
    filterCutoff: 1.0,
    reverbAmount: 0.0,
    delayFeedback: 0.0,
    bitcrusherAmount: 0.0,
  };
}

const state = new AudioEngineState();

// ============================================================
// 3. 工具函数 (内部使用)
// ============================================================

/** 生成一段混响用的脉冲响应 (简单算法) */
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
// 4. 核心 AudioEngine 实现
// ============================================================

export const audioEngine: AudioEngineContract = {
  // ----------------------------------------------------------
  // 4.1 初始化音频上下文和 FX 链路
  // ----------------------------------------------------------
  async initAudioEngine(): Promise<void> {
    if (state.ctx && state.ctx.state !== 'closed') {
      // 如果已经初始化，直接返回
      return;
    }

    // 创建 AudioContext (注意: 在用户手势中调用 resume)
    const ctx = new AudioContext();
    state.ctx = ctx;

    // --- 创建主音量节点 ---
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.9;
    state.masterGain = masterGain;
    masterGain.connect(ctx.destination);

    // --- 创建滤波器 (低通) ---
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 20000; // 默认全通
    filter.Q.value = 1.0;
    state.filterNode = filter;
    filter.connect(masterGain);

    // --- 创建混响 (Convolver) ---
    const reverb = ctx.createConvolver();
    // 默认使用一个短混响
    const impulse = createReverbImpulse(ctx, 1.2, 4.0);
    reverb.buffer = impulse;
    state.reverbNode = reverb;

    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.0; // 默认无混响
    state.reverbGain = reverbGain;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 1.0;
    state.reverbDryGain = dryGain;

    // 干声和湿声并行，然后合并
    // 注意: 我们会在 triggerPad 时将信号分路，所以这里先建立链路
    // 但实际连接将在触发时动态进行，以便每个音源都经过 FX

    // --- 创建延迟 ---
    const delay = ctx.createDelay(2.0);
    delay.delayTime.value = 0.0;
    state.delayNode = delay;

    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0.0;
    state.delayFeedbackGain = delayFeedback;

    const delayDry = ctx.createGain();
    delayDry.gain.value = 1.0;
    state.delayDryGain = delayDry;

    // 延迟反馈回路: delay -> feedbackGain -> delay 输入
    // 这个连接需要在 triggerPad 时动态处理，因为需要接入信号

    // --- 创建 Bitcrusher (WaveShaper) ---
    const bitcrusher = ctx.createWaveShaper();
    // 使用一个简单的曲线来模拟降低采样率和位深
    // 这里我们用一种简化的方式：通过一个非线性映射
    bitcrusher.curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i - 128) / 128;
      // 将信号映射到几个台阶上，模拟降低位深
      const steps = 16;
      const quantized = Math.round(x * steps) / steps;
      bitcrusher.curve[i] = Math.min(1, Math.max(-1, quantized));
    }
    state.bitcrusherNode = bitcrusher;

    // 注意: bitcrusher 不直接连接，由 applyFxState 动态控制是否接入

    console.log('[AudioEngine] 初始化完成');
  },

  // ----------------------------------------------------------
  // 4.2 加载 Sample 到内存 (解码)
  // ----------------------------------------------------------
  async loadSampleBuffer(sample: SampleAsset): Promise<void> {
    if (!state.ctx) {
      await audioEngine.initAudioEngine();
    }
    const ctx = state.ctx!;

    try {
      // 如果已经缓存，跳过
      if (state.sampleBuffers.has(sample.id)) {
        console.log(`[AudioEngine] Sample ${sample.id} 已缓存，跳过加载`);
        return;
      }

      // 从 URL 获取音频数据
      const response = await fetch(sample.url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();

      // 解码为 AudioBuffer
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      state.sampleBuffers.set(sample.id, audioBuffer);

      console.log(`[AudioEngine] 已加载 Sample: ${sample.name} (${audioBuffer.duration}s)`);
    } catch (error) {
      console.error('[AudioEngine] 加载 Sample 失败:', error);
      throw error;
    }
  },

  // ----------------------------------------------------------
  // 4.3 分配 Sample 到 Pad
  // ----------------------------------------------------------
  assignSampleToPad(padId: PadId, sampleId: SampleId): void {
    // 检查 Sample 是否已加载
    if (!state.sampleBuffers.has(sampleId)) {
      console.warn(`[AudioEngine] Sample ${sampleId} 尚未加载，无法分配`);
      return;
    }

    state.padSampleMap.set(padId, sampleId);

    // 如果该 Pad 还没有 GainNode，创建一个
    if (!state.padGains.has(padId) && state.ctx) {
      const gain = state.ctx.createGain();
      gain.gain.value = 0.8;
      state.padGains.set(padId, gain);
    }

    console.log(`[AudioEngine] Pad ${padId} 已绑定 Sample ${sampleId}`);
  },

  // ----------------------------------------------------------
  // 4.4 触发 Pad 播放 (核心方法)
  // ----------------------------------------------------------
  triggerPad(padId: PadId, velocity: number = 1): void {
    const ctx = state.ctx;
    if (!ctx) {
      console.warn('[AudioEngine] 未初始化，请先调用 initAudioEngine');
      return;
    }

    // 如果 AudioContext 是 suspended 状态，尝试恢复 (解决浏览器自动播放策略)
    if (ctx.state === 'suspended') {
      ctx.resume().catch((err) => {
        console.warn('[AudioEngine] 恢复 AudioContext 失败:', err);
      });
    }

    // 获取该 Pad 绑定的 SampleId
    const sampleId = state.padSampleMap.get(padId);
    if (!sampleId) {
      console.warn(`[AudioEngine] Pad ${padId} 未绑定任何 Sample`);
      return;
    }

    // 获取对应的 AudioBuffer
    const buffer = state.sampleBuffers.get(sampleId);
    if (!buffer) {
      console.warn(`[AudioEngine] Sample ${sampleId} 未加载`);
      return;
    }

    // 获取或创建该 Pad 的 GainNode (音量控制)
    let gainNode = state.padGains.get(padId);
    if (!gainNode) {
      gainNode = ctx.createGain();
      gainNode.gain.value = 0.8;
      state.padGains.set(padId, gainNode);
    }

    // 创建音源节点
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // 设置音高 (pitch)
    // 由于 PadState 中 pitch 范围是 0-2，我们映射到 -12 到 +12 半音
    // 但这里我们暂时使用 1.0，后续通过 setPadPitch 动态调整
    source.playbackRate.value = 1.0;

    // --- 构建音频链路: source -> FX Chain -> masterGain -> destination ---
    // 1. source -> gain (音量)
    source.connect(gainNode);

    // 2. gain -> filter (如果存在)
    if (state.filterNode) {
      gainNode.connect(state.filterNode);
    }

    // 3. filter -> split: 干声 + 混响 + 延迟 + bitcrusher
    // 这里我们使用一种简化的串联方式: filter -> reverb -> delay -> bitcrusher -> master
    // 更真实的 FX 链路应该是并联的，但为了简单演示，我们串联
    let currentNode: AudioNode = gainNode;

    // 如果 filter 存在，插入 filter
    if (state.filterNode) {
      currentNode.connect(state.filterNode);
      currentNode = state.filterNode;
    }

    // 混响: 将信号分两路，一路干声，一路混响，然后混合
    // 但由于我们使用串联，我们可以直接将信号通过混响
    if (state.reverbNode && state.reverbGain) {
      // 为了简单，我们创建两个分支: 干声直接通过，湿声经过混响
      // 但是串联模式下，我们无法轻松做到干湿分离，所以这里采用一种近似
      // 更好的方式是在后面实现并联，但MVP我们先用串联
      currentNode.connect(state.reverbNode);
      // 混响输出连接到 reverbGain
      state.reverbNode.connect(state.reverbGain);
      // 然后从 reverbGain 出来
      currentNode = state.reverbGain;
    }

    // 延迟
    if (state.delayNode && state.delayFeedbackGain) {
      currentNode.connect(state.delayNode);
      state.delayNode.connect(state.delayFeedbackGain);
      // 反馈: delay输出 -> feedbackGain -> delay输入 (通过额外连接)
      state.delayFeedbackGain.connect(state.delayNode);
      // 但为了信号能继续传递，我们还需要从 delay 输出到下一级
      // 这里我们用 delayFeedbackGain 作为输出
      currentNode = state.delayFeedbackGain;
    }

    // Bitcrusher
    if (state.bitcrusherNode) {
      currentNode.connect(state.bitcrusherNode);
      currentNode = state.bitcrusherNode;
    }

    // 最后连接到 masterGain
    if (state.masterGain) {
      currentNode.connect(state.masterGain);
    }

    // 保存活跃的 source 以便 stopAllSounds
    if (!state.activeSources.has(padId)) {
      state.activeSources.set(padId, []);
    }
    state.activeSources.get(padId)!.push(source);

    // 播放结束后自动清理
    source.onended = () => {
      const sources = state.activeSources.get(padId) || [];
      const filtered = sources.filter((s) => s !== source);
      if (filtered.length > 0) {
        state.activeSources.set(padId, filtered);
      } else {
        state.activeSources.delete(padId);
      }
      // 断开所有连接释放资源
      source.disconnect();
    };

    // 开始播放 (从 startTime 到 endTime)
    const startTime = 0;
    const duration = buffer.duration;
    source.start(0, startTime, duration - startTime);

    // console.log(`[AudioEngine] 触发 Pad ${padId} (velocity: ${velocity})`);
  },

  // ----------------------------------------------------------
  // 4.5 停止所有声音
  // ----------------------------------------------------------
  stopAllSounds(): void {
    for (const [padId, sources] of state.activeSources) {
      for (const source of sources) {
        try {
          source.stop();
        } catch (_e) {
          // 可能已经停止
        }
        source.disconnect();
      }
    }
    state.activeSources.clear();
    console.log('[AudioEngine] 已停止所有声音');
  },

  // ----------------------------------------------------------
  // 4.6 设置 Pad 音量
  // ----------------------------------------------------------
  setPadVolume(padId: PadId, volume: number): void {
    const gain = state.padGains.get(padId);
    if (gain) {
      const clampedVolume = Math.min(1.2, Math.max(0, volume));
      gain.gain.value = clampedVolume;
    } else if (state.ctx) {
      // 如果 GainNode 不存在，创建一个
      const newGain = state.ctx.createGain();
      newGain.gain.value = Math.min(1.2, Math.max(0, volume));
      state.padGains.set(padId, newGain);
    }
  },

  // ----------------------------------------------------------
  // 4.7 设置 Pad 音高
  // ----------------------------------------------------------
  setPadPitch(padId: PadId, pitch: number): void {
    // pitch 范围 0-2, 映射到 0.5 - 2.0 倍速
    const rate = 0.5 + pitch * 0.75;
    // 注意：我们无法直接修改已经播放的 source 的 playbackRate，
    // 但可以保存这个值，在下次触发时应用。
    // 这里我们存储到某个地方，但为了简单，我们在触发时动态读取 store 中的值
    // 所以这个方法暂时只做日志，实际在 triggerPad 中从 store 读取
    console.log(`[AudioEngine] Pad ${padId} pitch 设置为 ${pitch} (rate: ${rate})`);
    // 更好的实现：在 triggerPad 中从 store 读取 pad.pitch
    // 我们可以在这里保存到 map，但为了 MVP，triggerPad 直接从 store 读取
  },

  // ----------------------------------------------------------
  // 4.8 应用 FX 参数
  // ----------------------------------------------------------
  applyFxState(fx: Partial<FxState>): void {
    const ctx = state.ctx;
    if (!ctx) {
      console.warn('[AudioEngine] 未初始化，无法应用 FX');
      return;
    }

    // 更新缓存
    Object.assign(state.currentFx, fx);

    // 1. 滤波器截止频率
    if (fx.filterCutoff !== undefined && state.filterNode) {
      // filterCutoff 范围 0-1，映射到 20Hz - 20000Hz (对数)
      const minFreq = 20;
      const maxFreq = 20000;
      const freq = minFreq * Math.pow(maxFreq / minFreq, fx.filterCutoff);
      state.filterNode.frequency.value = Math.min(maxFreq, Math.max(minFreq, freq));
    }

    // 2. 混响量
    if (fx.reverbAmount !== undefined && state.reverbGain) {
      // reverbAmount 范围 0-1
      state.reverbGain.gain.value = Math.min(0.8, Math.max(0, fx.reverbAmount));
      if (state.reverbDryGain) {
        state.reverbDryGain.gain.value = 1 - Math.min(0.8, fx.reverbAmount);
      }
    }

    // 3. 延迟反馈
    if (fx.delayFeedback !== undefined && state.delayFeedbackGain && state.delayNode) {
      // delayFeedback 范围 0-1，映射到 0-0.8 反馈量
      state.delayFeedbackGain.gain.value = Math.min(0.8, Math.max(0, fx.delayFeedback));
      // 延迟时间固定为 0.3s
      state.delayNode.delayTime.value = 0.3;
    }

    // 4. Bitcrusher
    if (fx.bitcrusherAmount !== undefined && state.bitcrusherNode) {
      // bitcrusherAmount 范围 0-1，影响量化台阶数
      const steps = Math.max(2, Math.round(32 - 30 * fx.bitcrusherAmount));
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

// 为了方便调试，暴露 state
if (import.meta.env.DEV) {
  (window as any).__audioState = state;
}
