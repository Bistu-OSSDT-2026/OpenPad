import { applyFxState as applyAudioFxState } from '../audio/audioEngine';
import { useProjectStore } from '../../store/useProjectStore';
import type { FxState, GestureState } from '../../types/project';

const FX_LIMITS: Record<keyof FxState, { min: number; max: number }> = {
  filterCutoff: { min: 200, max: 12000 },
  reverbAmount: { min: 0, max: 1 },
  delayFeedback: { min: 0, max: 0.95 },
  bitcrusherAmount: { min: 0, max: 1 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeFxPatch(fx: Partial<FxState>): Partial<FxState> {
  const normalized: Partial<FxState> = {};

  for (const [name, value] of Object.entries(fx) as Array<[keyof FxState, number]>) {
    const limits = FX_LIMITS[name];

    if (Number.isFinite(value) && limits) {
      normalized[name] = clamp(value, limits.min, limits.max);
    }
  }

  return normalized;
}

export function setFxParam(name: keyof FxState, value: number): void {
  applyFxState({ [name]: value });
}

export function applyFxState(fx: Partial<FxState>): void {
  const normalized = normalizeFxPatch(fx);

  if (Object.keys(normalized).length === 0) {
    return;
  }

  useProjectStore.getState().setFx(normalized);
  applyAudioFxState(normalized);
}

export function mapGestureToFx(gesture: GestureState): Partial<FxState> {
  return normalizeFxPatch({
    filterCutoff: 200 + (1 - gesture.handY) * 11800,
    reverbAmount: gesture.openness,
    delayFeedback: gesture.handX,
  });
}

export function smoothValue(previous: number, next: number, factor: number): number {
  return previous + (next - previous) * clamp(factor, 0, 1);
}
