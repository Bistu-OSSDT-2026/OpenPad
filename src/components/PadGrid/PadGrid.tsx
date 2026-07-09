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
const MIN_PAD_SLICE_LENGTH_SECONDS = 0.1;

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
          const trimWindowStartTime = sample?.trimWindowStartTime ?? sample?.startTime ?? 0;
          const trimWindowEndTime =
            sample?.trimWindowEndTime ?? sample?.duration ?? trimWindowStartTime;
          const trimWindowLength = Math.max(
            MIN_PAD_SLICE_LENGTH_SECONDS,
            trimWindowEndTime - trimWindowStartTime,
          );
          const startOffset = sample
            ? Math.max(0, sample.startTime - trimWindowStartTime)
            : 0;
          const endOffset = sample
            ? Math.max(MIN_PAD_SLICE_LENGTH_SECONDS, sample.endTime - trimWindowStartTime)
            : MIN_PAD_SLICE_LENGTH_SECONDS;

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
              <div className="mt-4 grid gap-2 text-[10px] text-neutral-500">
                <span className="mb-1 flex justify-between">
                  <span>Trim</span>
                  <span>
                    {sample
                      ? `${startOffset.toFixed(2)}-${endOffset.toFixed(2)}s`
                      : '--'}
                  </span>
                </span>
                <label>
                  <span className="sr-only">Start</span>
                  <input
                    className="block h-1 w-full accent-signal"
                    disabled={!sample}
                    max={sample ? Math.max(0, endOffset - MIN_PAD_SLICE_LENGTH_SECONDS) : 0}
                    min={0}
                    onChange={(event) => {
                      if (!sample) {
                        return;
                      }

                      updateSample(sample.id, {
                        startTime: trimWindowStartTime + Number(event.target.value),
                      });
                    }}
                    step={0.05}
                    type="range"
                    value={startOffset}
                  />
                </label>
                <label>
                  <span className="sr-only">End</span>
                  <input
                    className="block h-1 w-full accent-warning"
                    disabled={!sample}
                    max={trimWindowLength}
                    min={sample ? startOffset + MIN_PAD_SLICE_LENGTH_SECONDS : MIN_PAD_SLICE_LENGTH_SECONDS}
                    onChange={(event) => {
                      if (!sample) {
                        return;
                      }

                      updateSample(sample.id, {
                        endTime: trimWindowStartTime + Number(event.target.value),
                      });
                    }}
                    step={0.05}
                    type="range"
                    value={endOffset}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
