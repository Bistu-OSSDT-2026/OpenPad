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
    const stepDuration = 60000 / bpm / 4; // 16分音符的毫秒数

    // 触发当前步进中所有激活的 Pad
    for (const pad of pads) {
      const steps = pattern.steps[pad.id];
      if (steps && steps[currentStep] && steps[currentStep].active) {
        // 使用 audioEngine.triggerPad 播放
        audioEngine.triggerPad(pad.id, steps[currentStep].velocity || 0.8);
      }
    }

    // 更新到下一步
    const nextStep = (currentStep + 1) % 16;
    const { setCurrentStep } = useProjectStore.getState();
    setCurrentStep(nextStep);

    // 调度下一次循环
    this.timerId = setTimeout(() => {
      this.runSequencerLoop();
    }, stepDuration);
  }
}

export const sequencerEngine = new SequencerEngineImpl();
