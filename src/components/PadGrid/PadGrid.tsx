import { useProjectStore } from '../../store/useProjectStore';

export function PadGrid() {
  const pads = useProjectStore((state) => state.pads);
  const samples = useProjectStore((state) => state.samples);

  return (
    <section className="rounded border border-line bg-panel p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase text-neutral-200">Pad Grid</h2>
        <span className="text-xs text-neutral-500">QWER / ASDF / ZXCV / 1234</span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {pads.map((pad) => {
          const sample = samples.find((item) => item.id === pad.sampleId);

          return (
            <button
              key={pad.id}
              type="button"
              className="aspect-square rounded-md border border-neutral-700 bg-neutral-800 p-3 text-left shadow-pad transition hover:border-signal hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-signal"
            >
              <span className="block text-xl font-black text-white">{pad.name}</span>
              <span className="mt-2 block truncate text-xs text-neutral-400">
                {sample?.name ?? 'Empty'}
              </span>
              <span className="mt-4 block h-1 rounded bg-neutral-700">
                <span
                  className="block h-1 rounded bg-signal"
                  style={{ width: `${pad.volume * 100}%` }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
