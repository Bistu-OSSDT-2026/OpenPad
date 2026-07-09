import { stopAllSounds, triggerPad } from '../audio/audioEngine';
import { useProjectStore } from '../../store/useProjectStore';
import type { PadId, StepIndex } from '../../types/project';

let timerId: number | undefined;

function getStepIntervalMs(bpm: number): number {
  return (60_000 / Math.max(40, Math.min(220, bpm))) / 4;
}

function clearSequencerTimer(): void {
  if (timerId !== undefined) {
    window.clearInterval(timerId);
    timerId = undefined;
  }
}

function tick(): void {
  const state = useProjectStore.getState();
  const stepIndex = state.pattern.currentStep;

  for (const pad of state.pads) {
    const step = state.pattern.steps[pad.id]?.[stepIndex];

    if (step?.active) {
      triggerPad(pad.id, step.velocity);
    }
  }

  useProjectStore.getState().setCurrentStep((stepIndex + 1) % 16);
}

export function playSequencer(): void {
  clearSequencerTimer();
  const { pattern, setSequencerPlaying } = useProjectStore.getState();

  setSequencerPlaying(true);
  tick();
  timerId = window.setInterval(tick, getStepIntervalMs(pattern.bpm));
}

export function stopSequencer(): void {
  clearSequencerTimer();
  stopAllSounds();
  useProjectStore.getState().setSequencerPlaying(false);
}

export function resetSequencer(): void {
  clearSequencerTimer();
  stopAllSounds();
  const store = useProjectStore.getState();
  store.setCurrentStep(0);
  store.setSequencerPlaying(false);
}

export function setBpm(bpm: number): void {
  const store = useProjectStore.getState();
  const wasPlaying = store.pattern.isPlaying;

  store.setBpm(bpm);

  if (wasPlaying) {
    playSequencer();
  }
}

export function toggleStep(padId: PadId, stepIndex: StepIndex): void {
  useProjectStore.getState().toggleStep(padId, stepIndex);
}

export function setStepVelocity(padId: PadId, stepIndex: StepIndex, velocity: number): void {
  useProjectStore.getState().setStepVelocity(padId, stepIndex, velocity);
}

export function getSequencerBpm(): number {
  return useProjectStore.getState().pattern.bpm;
}

export function getCurrentStep(): number {
  return useProjectStore.getState().pattern.currentStep;
}
