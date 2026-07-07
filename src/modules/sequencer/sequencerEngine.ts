import { triggerPad } from '../audio/audioEngine';
import { useProjectStore } from '../../store/useProjectStore';

let timeoutId: ReturnType<typeof setTimeout> | null = null;

function getStepIntervalMs(bpm: number): number {
  // 16th note interval: (60 / bpm) / 4 * 1000 = 15000 / bpm
  return Math.max(25, 15000 / bpm);
}

function tick(): void {
  const state = useProjectStore.getState();

  if (!state.pattern.isPlaying) return;

  const { pattern, pads } = state;
  const step = pattern.currentStep;

  // Trigger every active, non-muted pad at the current step
  for (const pad of pads) {
    if (pad.muted) continue;

    const stepState = pattern.steps[pad.id]?.[step];

    if (stepState?.active && pad.sampleId) {
      triggerPad(pad.id, stepState.velocity);
    }
  }

  // Advance to the next step
  state.setCurrentStep((step + 1) % 16);
}

function scheduleNext(bpm: number, swing: number): void {
  const state = useProjectStore.getState();

  if (!state.pattern.isPlaying) return;

  const interval = getStepIntervalMs(bpm);
  const nextStep = state.pattern.currentStep;

  // Apply swing delay on odd-numbered steps (the "off" 16th notes)
  const swingOffset = nextStep % 2 === 1 ? swing * interval : 0;
  const delay = Math.max(5, interval + swingOffset);

  timeoutId = setTimeout(() => {
    tick();
    scheduleNext(bpm, swing);
  }, delay);
}

export function playSequencer(): void {
  const state = useProjectStore.getState();

  if (state.pattern.isPlaying) return;

  state.setSequencerPlaying(true);

  // Fire the first step immediately for responsive feel
  tick();

  // Schedule subsequent steps
  scheduleNext(state.pattern.bpm, state.pattern.swing);
}

export function stopSequencer(): void {
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }

  useProjectStore.getState().setSequencerPlaying(false);
}

export function resetSequencer(): void {
  stopSequencer();
  useProjectStore.getState().setCurrentStep(0);
}

export function setBpm(bpm: number): void {
  const clamped = Math.min(220, Math.max(40, Math.round(bpm)));
  const state = useProjectStore.getState();

  state.setBpm(clamped);

  // Restart playback with new timing if currently active
  if (state.pattern.isPlaying) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    scheduleNext(clamped, state.pattern.swing);
  }
}

export function setSwing(swing: number): void {
  const clamped = Math.min(1, Math.max(0, swing));
  const state = useProjectStore.getState();

  state.setSwing(clamped);

  // Restart timing so swing takes effect immediately
  if (state.pattern.isPlaying) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    scheduleNext(state.pattern.bpm, clamped);
  }
}

export function getCurrentStep(): number {
  return useProjectStore.getState().pattern.currentStep;
}
