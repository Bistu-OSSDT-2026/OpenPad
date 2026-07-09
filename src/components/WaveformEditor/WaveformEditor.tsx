import { useId, useMemo, useState, type ChangeEvent } from 'react';
import { assignChopsToPads, chopSample } from '../../modules/sampler/chop';
import { importSample } from '../../modules/sampler/sampleManager';
import { useProjectStore } from '../../store/useProjectStore';

export function WaveformEditor() {
  const inputId = useId();
  const samples = useProjectStore((state) => state.samples);
  const addSample = useProjectStore((state) => state.addSample);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sliceLength, setSliceLength] = useState(1);

  const selectedSample = useMemo(
    () => samples.find((sample) => sample.id === selectedSampleId) ?? samples[0] ?? null,
    [samples, selectedSampleId],
  );

  const waveformPeaks = selectedSample?.waveformPeaks ?? Array.from({ length: 64 }, () => 0.18);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const importedSample = await importSample(file);
      addSample(importedSample);
      setSelectedSampleId(importedSample.id);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to import audio sample.');
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  };

  const handleChop = async (parts: 4 | 8 | 16) => {
    if (!selectedSample) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const choppedSamples = await chopSample(selectedSample.id, parts, sliceLength);
      if (choppedSamples.length > 0) {
        choppedSamples.forEach((sample) => addSample(sample));
        assignChopsToPads(choppedSamples, 0);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to chop audio sample.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="rounded border border-line bg-panel p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase text-neutral-200">Sampler / Chop</h2>
        <label
          className="cursor-pointer rounded bg-signal px-3 py-2 text-xs font-bold text-neutral-950"
          htmlFor={inputId}
        >
          {isLoading ? 'Working…' : 'Upload'}
        </label>
        <input accept="audio/*" className="hidden" id={inputId} onChange={handleUpload} type="file" />
      </div>
      <div className="flex h-28 items-end gap-1 rounded bg-neutral-950 p-3">
        {waveformPeaks.map((value, index) => (
          <span
            className="flex-1 rounded-sm bg-signal/70"
            key={index}
            style={{ height: `${Math.max(12, value * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
        <span>{selectedSample ? `Selected: ${selectedSample.name}` : 'No sample selected'}</span>
        {selectedSample?.duration ? <span>• {selectedSample.duration.toFixed(2)}s</span> : null}
      </div>
      <label className="mt-4 grid gap-2 text-xs text-neutral-400">
        <span>Slice length: {sliceLength.toFixed(2)}s</span>
        <input
          className="w-full"
          max={8}
          min={0.1}
          onChange={(event) => setSliceLength(Number(event.target.value))}
          step={0.05}
          type="range"
          value={sliceLength}
        />
      </label>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[4, 8, 16].map((parts) => (
          <button
            className="rounded border border-line bg-panelSoft px-3 py-2 text-sm font-semibold text-neutral-200 hover:border-signal disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!selectedSample || isLoading}
            key={parts}
            onClick={() => handleChop(parts as 4 | 8 | 16)}
            type="button"
          >
            Chop {parts}
          </button>
        ))}
      </div>
      {error ? <p className="mt-3 text-xs text-amber-400">{error}</p> : null}
      <p className="mt-3 text-xs text-neutral-500">
        Loaded samples: {samples.length}. Uploading and chopping now flow through the sampler module.
      </p>
    </section>
  );
}
