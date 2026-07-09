import { useEffect } from 'react';
import { initAudioEngine, loadSampleBuffer, triggerPad } from '../../modules/audio/audioEngine';
import { useProjectStore } from '../../store/useProjectStore';

const padKeys = new Map([
  ['q', 'pad-1'],
  ['w', 'pad-2'],
  ['e', 'pad-3'],
  ['r', 'pad-4'],
  ['a', 'pad-5'],
  ['s', 'pad-6'],
  ['d', 'pad-7'],
  ['f', 'pad-8'],
  ['z', 'pad-9'],
  ['x', 'pad-10'],
  ['c', 'pad-11'],
  ['v', 'pad-12'],
  ['1', 'pad-13'],
  ['2', 'pad-14'],
  ['3', 'pad-15'],
  ['4', 'pad-16'],
]);

export function PadGrid() {
  const pads = useProjectStore((state) => state.pads);
  const samples = useProjectStore((state) => state.samples);

  useEffect(() => {
    for (const sample of samples) {
      void loadSampleBuffer(sample);
    }
  }, [samples]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat) {
        return;
      }

      const padId = padKeys.get(event.key.toLowerCase());

      if (padId) {
        event.preventDefault();
        triggerPad(padId);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
              onPointerDown={() => void initAudioEngine()}
              onClick={() => triggerPad(pad.id)}
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
