import type { FxState, GestureState } from '../../types/project';

export function setFxParam(_name: keyof FxState, _value: number): void {}

export function applyFxState(_fx: Partial<FxState>): void {}

export function mapGestureToFx(gesture: GestureState): Partial<FxState> {
  return {
    filterCutoff: 200 + gesture.handY * 11800,
    reverbAmount: gesture.openness,
    delayFeedback: Math.min(0.95, gesture.handX),
  };
}

export function smoothValue(previous: number, next: number, factor: number): number {
  return previous + (next - previous) * factor;
}
