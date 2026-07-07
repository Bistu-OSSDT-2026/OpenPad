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
// 导出所有 Sequencer.tsx 需要的方法
// ============================================================

// 核心方法
export const playSequencer = sequencerEngine.playSequencer.bind(sequencerEngine);
export const stopSequencer = sequencerEngine.stopSequencer.bind(sequencerEngine);
export const resetSequencer = sequencerEngine.resetSequencer.bind(sequencerEngine);
export const setBpm = sequencerEngine.setBpm.bind(sequencerEngine);
export const toggleStep = sequencerEngine.toggleStep.bind(sequencerEngine);
export const setStepVelocity = sequencerEngine.setStepVelocity.bind(sequencerEngine);
export const getCurrentStep = sequencerEngine.getCurrentStep.bind(sequencerEngine);

// ============================================================
// 临时实现：Sequencer.tsx 需要但尚未完成的功能
// ============================================================

// 1. setSwing - 暂时只做日志
export function setSwing(value: number): void {
  console.log('[Sequencer] Swing 设置为:', value);
  // 实际应该更新 store 中的 swing 值
}

// 2. Pattern 管理 - 临时使用内存存储
let tempPatterns: any[] = [];
let tempActivePatternId: string | null = null;

// 初始化默认 pattern
const defaultPattern = {
  id: 'pattern-default',
  name: 'Pattern 1',
  steps: {},
};
tempPatterns = [defaultPattern];
tempActivePatternId = defaultPattern.id;

export function getPatterns(): any[] {
  return tempPatterns;
}

export function getActivePatternId(): string | null {
  return tempActivePatternId;
}

export function createPattern(name: string): void {
  const newPattern = {
    id: `pattern-${Date.now()}`,
    name: name || `Pattern ${tempPatterns.length + 1}`,
    steps: {},
  };
  tempPatterns = [...tempPatterns, newPattern];
  tempActivePatternId = newPattern.id;
  console.log('[Sequencer] 创建 Pattern:', newPattern);
}

export function duplicatePattern(patternId: string): void {
  const original = tempPatterns.find((p) => p.id === patternId);
  if (!original) return;
  const newPattern = {
    ...original,
    id: `pattern-${Date.now()}`,
    name: `${original.name} (Copy)`,
  };
  tempPatterns = [...tempPatterns, newPattern];
  tempActivePatternId = newPattern.id;
  console.log('[Sequencer] 复制 Pattern:', newPattern);
}

export function deletePattern(patternId: string): void {
  if (tempPatterns.length <= 1) return;
  tempPatterns = tempPatterns.filter((p) => p.id !== patternId);
  tempActivePatternId = tempPatterns[0]?.id || null;
  console.log('[Sequencer] 删除 Pattern:', patternId);
}

export function selectPattern(patternId: string): void {
  const exists = tempPatterns.some((p) => p.id === patternId);
  if (exists) {
    tempActivePatternId = patternId;
    console.log('[Sequencer] 选择 Pattern:', patternId);
  }
}

export function clearActivePatternSteps(): void {
  const state = useProjectStore.getState();
  const pads = state.pads;
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
  console.log('[Sequencer] 清除所有步骤');
}

export function randomizeActivePatternSteps(): void {
  const state = useProjectStore.getState();
  const pads = state.pads;
  for (const pad of pads) {
    const steps = state.pattern.steps[pad.id];
    if (steps) {
      for (let i = 0; i < steps.length; i++) {
        const shouldActivate = Math.random() < 0.3;
        if (shouldActivate !== steps[i].active) {
          state.toggleStep(pad.id, i);
        }
        if (steps[i].active) {
          const velocity = 0.25 + Math.random() * 0.75;
          state.setStepVelocity(pad.id, i, velocity);
        }
      }
    }
  }
  console.log('[Sequencer] 随机化步骤');
}

// 导出默认
export default sequencerEngine;
