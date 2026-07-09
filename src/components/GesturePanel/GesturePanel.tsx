import { useEffect, useMemo, useRef, useState } from 'react';
import { applyFxState, mapGestureToFx, smoothValue } from '../../modules/effects/fxEngine';
import {
  onGestureChange,
  startGestureTracking,
  stopGestureTracking,
} from '../../modules/gesture/gestureTracker';
import { useProjectStore } from '../../store/useProjectStore';
import type { FxState, GestureState } from '../../types/project';

const DEFAULT_GESTURE: GestureState = {
  handX: 0.5,
  handY: 0.5,
  openness: 0,
  confidence: 0,
};

const SMOOTH_FACTOR = 0.18;
const MIN_CONFIDENCE = 0.6;

type TrackingStatus = 'Idle' | 'Requesting' | 'Tracking' | 'Permission denied' | 'Error';

export function GesturePanel() {
  const fx = useProjectStore((state) => state.fx);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [gesture, setGesture] = useState<GestureState>(DEFAULT_GESTURE);
  const [status, setStatus] = useState<TrackingStatus>('Idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    onGestureChange((nextGesture) => {
      setGesture(nextGesture);

      if (nextGesture.confidence < MIN_CONFIDENCE) {
        return;
      }

      const currentFx = useProjectStore.getState().fx;
      const targetFx = mapGestureToFx(nextGesture);
      const smoothedFx: Partial<FxState> = {};

      for (const [name, targetValue] of Object.entries(targetFx) as Array<[keyof FxState, number]>) {
        const nextValue = smoothValue(currentFx[name], targetValue, SMOOTH_FACTOR);

        if (Math.abs(nextValue - currentFx[name]) >= 0.005) {
          smoothedFx[name] = nextValue;
        }
      }

      applyFxState(smoothedFx);
    });

    return () => {
      onGestureChange(() => {});
      stopGestureTracking();
    };
  }, []);

  const mappedFx = useMemo(() => mapGestureToFx(gesture), [gesture]);

  async function handleStartTracking() {
    if (!videoRef.current) {
      return;
    }

    setErrorMessage('');
    setStatus('Requesting');

    try {
      await startGestureTracking(videoRef.current);
      setStatus('Tracking');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start camera tracking.';
      const nextStatus: TrackingStatus =
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Permission denied'
          : 'Error';

      setStatus(nextStatus);
      setErrorMessage(message);
    }
  }

  function handleStopTracking() {
    stopGestureTracking();
    setErrorMessage('');
    setStatus('Idle');
  }

  return (
    <section className="rounded border border-line bg-panel p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase text-neutral-200">Gesture FX</h2>
        <span className="rounded border border-line px-2 py-1 text-xs text-neutral-400">{status}</span>
      </div>
      <div className="relative aspect-video overflow-hidden rounded border border-line bg-neutral-950">
        <video
          className="h-full w-full bg-neutral-950 object-cover"
          muted
          playsInline
          ref={videoRef}
        />
        {status !== 'Tracking' ? (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-neutral-500">
            Camera preview
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          className="rounded bg-signal px-3 py-2 text-xs font-bold text-neutral-950 disabled:opacity-50"
          disabled={status === 'Requesting'}
          onClick={handleStartTracking}
          type="button"
        >
          {status === 'Tracking' ? 'Restart Camera' : 'Start Camera'}
        </button>
        <button
          className="rounded border border-line px-3 py-2 text-xs font-bold text-neutral-200"
          onClick={handleStopTracking}
          type="button"
        >
          Stop
        </button>
      </div>
      {errorMessage ? <p className="mt-3 text-xs text-rose-400">{errorMessage}</p> : null}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-400">
        <Metric label="Hand X" value={gesture.handX.toFixed(2)} />
        <Metric label="Hand Y" value={gesture.handY.toFixed(2)} />
        <Metric label="Open" value={gesture.openness.toFixed(2)} />
        <Metric label="Conf" value={gesture.confidence.toFixed(2)} />
        <Metric label="Filter" value={String(Math.round(mappedFx.filterCutoff ?? fx.filterCutoff))} />
        <Metric label="Reverb" value={(mappedFx.reverbAmount ?? fx.reverbAmount).toFixed(2)} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-panelSoft p-2">
      <div className="text-[10px] uppercase text-neutral-500">{label}</div>
      <div className="font-bold text-neutral-200">{value}</div>
    </div>
  );
}
