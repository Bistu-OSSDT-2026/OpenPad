import type { FxState } from '../../types/project';
import { useProjectStore } from '../../store/useProjectStore';

const controls: Array<{ key: keyof FxState; label: string; max: number; min: number; step: number }> = [
  { key: 'filterCutoff', label: 'Filter', min: 200, max: 12000, step: 100 },
  { key: 'reverbAmount', label: 'Reverb', min: 0, max: 1, step: 0.01 },
  { key: 'delayFeedback', label: 'Delay', min: 0, max: 0.95, step: 0.01 },
  { key: 'bitcrusherAmount', label: 'Crush', min: 0, max: 1, step: 0.01 },
];

export function FxPanel() {
  const fx = useProjectStore((state) => state.fx);
  const setFx = useProjectStore((state) => state.setFx);
  const resetFx = useProjectStore((state) => state.resetFx);

  return (
    <section className="rounded border border-line bg-panel p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase text-neutral-200">FX</h2>
        <button className="text-xs font-bold text-signal" onClick={resetFx} type="button">
          Reset
        </button>
      </div>
      <div className="grid gap-4">
        {controls.map((control) => (
          <label className="grid gap-2" key={control.key}>
            <span className="flex justify-between text-xs text-neutral-400">
              <span>{control.label}</span>
              <span>{Number(fx[control.key]).toFixed(control.key === 'filterCutoff' ? 0 : 2)}</span>
            </span>
            <input
              max={control.max}
              min={control.min}
              onChange={(event) => setFx({ [control.key]: Number(event.target.value) })}
              step={control.step}
              type="range"
              value={fx[control.key]}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
