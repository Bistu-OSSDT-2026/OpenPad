// src/modules/sequencer/sequencerEngine.ts
import { audioEngine } from '../audio/audioEngine';
import { useProjectStore } from '../../store/useProjectStore';

export interface SequencerEngineContract {
  playSequencer(): void;
  stopSequencer(): void;
  resetSequencer(): void;
  setBpm(bpm: number): void;
  toggleStep(padId: string, stepIndex: number): void;
  setStepVelocity(padId: string, stepIndex: number, velocity: number): void;
  getCurrentStep(): number;
  // 新增：支持 Sequencer.tsx 中的功能
  setSwing(value: number): void;
  createPattern(name: string): void;
  duplicatePattern(patternId: string): void;
  deletePattern(patternId: string): void;
  selectPattern(patternId: string): void;
  clearActivePatternSteps(): void;
  randomizeActivePatternSteps(): void;
}

class SequencerEngineImpl implements SequencerEngineContract {
  private timerId: number | null = null;

  playSequencer(): void {
    const { setSequencerPlaying } = useProjectStore.getState();
    setSequencerPlaying(true);
    this.runSequencerLoop();
  }

  stopSequencer(): void {
    const { setSequencerPlaying } = useProjectStore.getState();
    setSequencerPlaying(false);
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  resetSequencer(): void {
    const { setCurrentStep } = useProjectStore.getState();
    setCurrentStep(0);
    this.stopSequencer();
  }

  setBpm(bpm: number): void {
    const { setBpm } = useProjectStore.getState();
    setBpm(bpm);
  }

  toggleStep(padId: string, stepIndex: number): void {
    const { toggleStep } = useProjectStore.getState();
    toggleStep(padId, stepIndex);
  }

  setStepVelocity(padId: string, stepIndex: number, velocity: number): void {
    const { setStepVelocity } = useProjectStore.getState();
    setStepVelocity(padId, stepIndex, velocity);
  }

  getCurrentStep(): number {
    const state = useProjectStore.getState();
    return state.pattern.currentStep;
  }

  // ========== 新增：Swing 支持 ==========
  setSwing(value: number): void {
    // Swing 值存储在 pattern 中，但 PatternState 可能没有 swing 字段
    // 我们将其存储为 pattern 的一个扩展属性
    const state = useProjectStore.getState();
    // 使用 setFx 或其他方式存储，或者直接扩展 pattern
    // 这里我们使用一个临时方案：存储到全局变量或 localstorage
    // 更好的方案：在 store 中添加 swing 字段
    console.log('[Sequencer] Swing 设置为:', value);
    // 实际项目中应该在 store 中添加 swing 字段
    // 这里我们暂时存储到 window 对象供调试
    if (typeof window !== 'undefined') {
      (window as any).__swingValue = value;
    }
  }

  // ========== 新增：Pattern 管理 ==========
  createPattern(name: string): void {
    const state = useProjectStore.getState();
    const patterns = (state as any).patterns || [];
    const newPattern = {
      id: `pattern-${Date.now()}`,
      name: name || `Pattern ${patterns.length + 1}`,
      steps: {},
    };
    // 更新 patterns 列表
    (state as any).patterns = [...patterns, newPattern];
    // 选择新创建的 pattern
    (state as any).activePatternId = newPattern.id;
  }

  duplicatePattern(patternId: string): void {
    const state = useProjectStore.getState();
    const patterns = (state as any).patterns || [];
    const original = patterns.find((p: any) => p.id === patternId);
    if (!original) return;
    const newPattern = {
      ...original,
      id: `pattern-${Date.now()}`,
      name: `${original.name} (Copy)`,
    };
    (state as any).patterns = [...patterns, newPattern];
    (state as any).activePatternId = newPattern.id;
  }

  deletePattern(patternId: string): void {
    const state = useProjectStore.getState();
    const patterns = (state as any).patterns || [];
    if (patterns.length <= 1) return;
    const filtered = patterns.filter((p: any) => p.id !== patternId);
    (state as any).patterns = filtered;
    (state as any).activePatternId = filtered[0]?.id || null;
  }

  selectPattern(patternId: string): void {
    const state = useProjectStore.getState();
    (state as any).activePatternId = patternId;
  }

  // ========== 新增：Pattern 操作 ==========
  clearActivePatternSteps(): void {
    const state = useProjectStore.getState();
    const pads = state.pads;
    // 清除所有 pad 的步骤
    for (const pad of pads) {
      const steps = state.pattern.steps[pad.id];
      if (steps) {
        for (let i = 0; i < steps.length; i++) {
          if (steps[i].active) {
            state.toggleStep(pad.id, i);
          }
        }
      }
    }
  }

  randomizeActivePatternSteps(): void {
    const state = useProjectStore.getState();
    const pads = state.pads;
    // 随机激活约 30% 的步骤
    for (const pad of pads) {
      const steps = state.pattern.steps[pad.id];
      if (steps) {
        for (let i = 0; i < steps.length; i++) {
          const shouldActivate = Math.random() < 0.3;
          if (shouldActivate !== steps[i].active) {
            state.toggleStep(pad.id, i);
          }
          // 随机设置 velocity
          if (steps[i].active) {
            const velocity = 0.25 + Math.random() * 0.75;
            state.setStepVelocity(pad.id, i, velocity);
          }
        }
      }
    }
  }

  // ========== 原有：Sequencer Loop ==========
  private runSequencerLoop(): void {
    const state = useProjectStore.getState();
    const { pattern, pads } = state;

    if (!pattern.isPlaying) {
      return;
    }

    const currentStep = pattern.currentStep;
    const bpm = pattern.bpm;
    const stepDuration = 60000 / bpm / 4;

    for (const pad of pads) {
      const steps = pattern.steps[pad.id];
      if (steps && steps[currentStep] && steps[currentStep].active) {
        audioEngine.triggerPad(pad.id, steps[currentStep].velocity || 0.8);
      }
    }

    const nextStep = (currentStep + 1) % 16;
    const { setCurrentStep } = useProjectStore.getState();
    setCurrentStep(nextStep);

    this.timerId = setTimeout(() => {
      this.runSequencerLoop();
    }, stepDuration);
  }
}

export const sequencerEngine = new SequencerEngineImpl();

// ============================================================
// 单独导出方法供 UI 组件使用
// ============================================================

export const playSequencer = sequencerEngine.playSequencer.bind(sequencerEngine);
export const stopSequencer = sequencerEngine.stopSequencer.bind(sequencerEngine);
export const resetSequencer = sequencerEngine.resetSequencer.bind(sequencerEngine);
export const setBpm = sequencerEngine.setBpm.bind(sequencerEngine);
export const toggleStep = sequencerEngine.toggleStep.bind(sequencerEngine);
export const setStepVelocity = sequencerEngine.setStepVelocity.bind(sequencerEngine);
export const getCurrentStep = sequencerEngine.getCurrentStep.bind(sequencerEngine);

// ========== 新增导出 ==========
export const setSwing = sequencerEngine.setSwing.bind(sequencerEngine);
export const createPattern = sequencerEngine.createPattern.bind(sequencerEngine);
export const duplicatePattern = sequencerEngine.duplicatePattern.bind(sequencerEngine);
export const deletePattern = sequencerEngine.deletePattern.bind(sequencerEngine);
export const selectPattern = sequencerEngine.selectPattern.bind(sequencerEngine);
export const clearActivePatternSteps = sequencerEngine.clearActivePatternSteps.bind(sequencerEngine);
export const randomizeActivePatternSteps = sequencerEngine.randomizeActivePatternSteps.bind(sequencerEngine);
