import { useEffect } from 'react';
import { initAudioEngine, triggerPad } from '../../modules/audio/audioEngine';
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
const MAX_PAD_SLICE_LENGTH_SECONDS = 3;

function triggerPadFromUserInput(padId: string): void {
  void initAudioEngine().finally(() => triggerPad(padId));
}

export function PadGrid() {
  const pads = useProjectStore((state) => state.pads);
  const samples = useProjectStore((state) => state.samples);
  const updateSample = useProjectStore((state) => state.updateSample);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat) {
        return;
      }

      const padId = padKeys.get(event.key.toLowerCase());

      if (padId) {
        event.preventDefault();
        triggerPadFromUserInput(padId);
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
          const sampleLength = sample ? Math.max(0.1, sample.endTime - sample.startTime) : 0;
          const maxLength = sample
            ? Math.max(
                0.1,
                Math.min(MAX_PAD_SLICE_LENGTH_SECONDS, sample.duration - sample.startTime),
              )
            : MAX_PAD_SLICE_LENGTH_SECONDS;

          return (
            <div
              key={pad.id}
              className="aspect-square rounded-md border border-neutral-700 bg-neutral-800 p-3 shadow-pad transition hover:border-signal hover:bg-neutral-700"
            >
              <button
                className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-signal"
                onClick={() => triggerPadFromUserInput(pad.id)}
                type="button"
              >
                <span className="block text-xl font-black text-white">{pad.name}</span>
                <span className="mt-2 block truncate text-xs text-neutral-400">
                  {sample?.name ?? 'Empty'}
                </span>
              </button>
              <label className="mt-4 block text-[10px] text-neutral-500">
                <span className="mb-1 flex justify-between">
                  <span>Length</span>
                  <span>{sample ? `${sampleLength.toFixed(2)}s` : '--'}</span>
                </span>
                <input
                  className="block h-1 w-full accent-signal"
                  disabled={!sample}
                  max={maxLength}
                  min={0.1}
                  onChange={(event) => {
                    if (!sample) {
                      return;
                    }

                    updateSample(sample.id, {
                      endTime: Math.min(
                        sample.duration,
                        sample.startTime + Number(event.target.value),
                      ),
                    });
                  }}
                  step={0.05}
                  type="range"
                  value={sample ? Math.min(sampleLength, maxLength) : 0.1}
                />
              </label>
            </div>
          );
        })}
      </div>
    </section>
  );
}
