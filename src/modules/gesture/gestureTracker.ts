import type { GestureState } from '../../types/project';

let changeCallback: ((gesture: GestureState) => void) | undefined;

export async function startGestureTracking(_videoElement: HTMLVideoElement): Promise<void> {
  changeCallback?.({
    handX: 0.5,
    handY: 0.5,
    openness: 0.5,
    confidence: 0,
  });
}

export function stopGestureTracking(): void {}

export function onGestureChange(callback: (gesture: GestureState) => void): void {
  changeCallback = callback;
}
