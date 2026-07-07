import { useId } from 'react';
import { useProjectStore } from '../../store/useProjectStore';

export function WaveformEditor() {
  const inputId = useId();
  const samples = useProjectStore((state) => state.samples);

  return (
    <section className="rounded border border-line bg-panel p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase text-neutral-200">Sampler / Chop</h2>
        <label
          className="cursor-pointer rounded bg-signal px-3 py-2 text-xs font-bold text-neutral-950"
          htmlFor={inputId}
        >
          Upload
        </label>
        <input accept="audio/*" className="hidden" id={inputId} type="file" />
      </div>
      <div className="flex h-28 items-end gap-1 rounded bg-neutral-950 p-3">
        {Array.from({ length: 64 }, (_, index) => (
          <span
            className="flex-1 rounded-sm bg-signal/70"
            key={index}
            style={{ height: `${18 + ((index * 17) % 76)}%` }}
          />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[4, 8, 16].map((parts) => (
          <button
            className="rounded border border-line bg-panelSoft px-3 py-2 text-sm font-semibold text-neutral-200 hover:border-signal"
            key={parts}
            type="button"
          >
            Chop {parts}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-neutral-500">
        Loaded samples: {samples.length}. Audio decoding and waveform peaks belong in
        modules/sampler.
      </p>
    </section>
  );
}
