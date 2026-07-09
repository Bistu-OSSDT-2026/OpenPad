import { initAudioEngine, loadSampleBuffer, stopAllSounds, triggerPad } from '../audio/audioEngine';
import { useProjectStore } from '../../store/useProjectStore';
import type { PadId, StepIndex } from '../../types/project';

let timerId: number | undefined;
let playbackRequestId = 0;

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

  if (stepIndex === 0) {
    stopAllSounds();
  }

  for (const pad of state.pads) {
    const step = state.pattern.steps[pad.id]?.[stepIndex];

    if (step?.active) {
      triggerPad(pad.id, step.velocity);
    }
  }

  useProjectStore.getState().setCurrentStep((stepIndex + 1) % 16);
}

async function prepareSequencerSamples(): Promise<void> {
  const state = useProjectStore.getState();
  const sampleIds = new Set<string>();

  for (const pad of state.pads) {
    const hasActiveStep = state.pattern.steps[pad.id]?.some((step) => step.active);

    if (hasActiveStep && pad.sampleId) {
      sampleIds.add(pad.sampleId);
    }
  }

  await initAudioEngine();
  await Promise.all(
    state.samples
      .filter((sample) => sampleIds.has(sample.id))
      .map((sample) => loadSampleBuffer(sample)),
  );
}

export function playSequencer(): void {
  clearSequencerTimer();
  const requestId = playbackRequestId + 1;
  playbackRequestId = requestId;

  void prepareSequencerSamples()
    .catch((error: unknown) => console.error(error))
    .finally(() => {
      if (requestId !== playbackRequestId) {
        return;
      }

      const { pattern, setSequencerPlaying } = useProjectStore.getState();

      setSequencerPlaying(true);
      tick();
      timerId = window.setInterval(tick, getStepIntervalMs(pattern.bpm));
    });
}

export function stopSequencer(): void {
  playbackRequestId += 1;
  clearSequencerTimer();
  stopAllSounds();
  useProjectStore.getState().setSequencerPlaying(false);
}

export function resetSequencer(): void {
  playbackRequestId += 1;
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
