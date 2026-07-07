import type { PadId } from '../../types/project';

let currentStep = 0;
let bpm = 96;

export function playSequencer(): void {}

export function stopSequencer(): void {}

export function resetSequencer(): void {
  currentStep = 0;
}

export function setBpm(nextBpm: number): void {
  bpm = nextBpm;
}

export function toggleStep(_padId: PadId, _stepIndex: number): void {}

export function setStepVelocity(_padId: PadId, _stepIndex: number, _velocity: number): void {}

export function getCurrentStep(): number {
  return currentStep;
}

export function getSequencerBpm(): number {
  return bpm;
}
