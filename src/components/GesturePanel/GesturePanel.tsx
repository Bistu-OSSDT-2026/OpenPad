import { useProjectStore } from '../../store/useProjectStore';

export function GesturePanel() {
  const fx = useProjectStore((state) => state.fx);

  return (
    <section className="rounded border border-line bg-panel p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase text-neutral-200">Gesture FX</h2>
        <span className="rounded border border-line px-2 py-1 text-xs text-neutral-400">Idle</span>
      </div>
      <div className="flex aspect-video items-center justify-center rounded bg-neutral-950 text-sm text-neutral-500">
        Camera preview
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-400">
        <Metric label="Hand X" value="0.50" />
        <Metric label="Hand Y" value="0.50" />
        <Metric label="Filter" value={String(Math.round(fx.filterCutoff))} />
        <Metric label="Reverb" value={fx.reverbAmount.toFixed(2)} />
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
