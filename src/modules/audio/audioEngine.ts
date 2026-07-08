import type { FxState, PadId, SampleAsset, SampleId } from '../../types/project';

export async function initAudioEngine(): Promise<void> {
  return Promise.resolve();
}

export function loadSampleBuffer(_sample: SampleAsset): Promise<void> {
  return Promise.resolve();
}

export function assignSampleToPad(_padId: PadId, _sampleId: SampleId): void {}

export function triggerPad(_padId: PadId, _velocity: number = 1): void {}

export function stopAllSounds(): void {}

export function setPadVolume(_padId: PadId, _volume: number): void {}

export function setPadPitch(_padId: PadId, _pitch: number): void {}

export function applyFxState(_fx: Partial<FxState>): void {}
