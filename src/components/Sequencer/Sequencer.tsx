import { useEffect, useState } from 'react';
import {
  playSequencer,
  resetSequencer,
  setBpm as setEngineBpm,
  stopSequencer,
  toggleStep as toggleEngineStep,
} from '../../modules/sequencer/sequencerEngine';
import { useProjectStore } from '../../store/useProjectStore';

export function Sequencer() {
  const pads = useProjectStore((state) => state.pads);
  const pattern = useProjectStore((state) => state.pattern);
  const [bpmInput, setBpmInput] = useState(String(pattern.bpm));

  useEffect(() => {
    setBpmInput(String(pattern.bpm));
  }, [pattern.bpm]);

  function commitBpmInput() {
    const nextBpm = Number(bpmInput);

    if (Number.isFinite(nextBpm)) {
      setEngineBpm(nextBpm);
    } else {
      setBpmInput(String(pattern.bpm));
    }
  }

  return (
    <section className="rounded border border-line bg-panel p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase text-neutral-200">16-Step Sequencer</h2>
        <div className="flex items-center gap-2">
          <input
            className="w-20 rounded border border-line bg-neutral-950 px-2 py-1 text-sm"
            inputMode="numeric"
            onBlur={commitBpmInput}
            onChange={(event) => setBpmInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitBpmInput();
                event.currentTarget.blur();
              }
            }}
            type="text"
            value={bpmInput}
          />
          <button
            className="rounded bg-warning px-3 py-2 text-xs font-bold text-neutral-950"
            onClick={() => (pattern.isPlaying ? stopSequencer() : playSequencer())}
            type="button"
          >
            {pattern.isPlaying ? 'Stop' : 'Play'}
          </button>
          <button
            className="rounded border border-line px-3 py-2 text-xs font-bold text-neutral-200"
            onClick={resetSequencer}
            type="button"
          >
            Reset
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[760px] gap-2">
          {pads.slice(0, 8).map((pad) => (
            <div className="grid grid-cols-[44px_repeat(16,minmax(28px,1fr))] gap-1" key={pad.id}>
              <div className="flex items-center text-xs font-bold text-neutral-400">{pad.name}</div>
              {pattern.steps[pad.id].map((step, index) => (
                <button
                  aria-label={`${pad.name} step ${index + 1}`}
                  className={[
                    'aspect-square rounded border text-[10px] font-bold',
                    step.active
                      ? 'border-signal bg-signal text-neutral-950'
                      : 'border-line bg-neutral-900 text-neutral-600',
                    pattern.currentStep === index ? 'ring-2 ring-warning' : '',
                  ].join(' ')}
                  key={`${pad.id}-${index}`}
                  onClick={() => toggleEngineStep(pad.id, index)}
                  type="button"
                >
                  {index + 1}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
