import { useProjectStore } from '../../store/useProjectStore';
import {
  playSequencer,
  stopSequencer,
  resetSequencer,
  setBpm,
  setSwing,
} from '../../modules/sequencer/sequencerEngine';

function velocityOpacity(velocity: number): string {
  if (velocity >= 0.9) return 'opacity-100';
  if (velocity >= 0.6) return 'opacity-70';
  if (velocity >= 0.35) return 'opacity-45';
  return 'opacity-25';
}

function stepLabel(index: number): string {
  // Show beat markers at the start of each beat (1, 5, 9, 13)
  if (index % 4 === 0) return `${index + 1}`;
  return '';
}

export function Sequencer() {
  const pads = useProjectStore((state) => state.pads);
  const pattern = useProjectStore((state) => state.pattern);
  const patterns = useProjectStore((state) => state.patterns);
  const activePatternId = useProjectStore((state) => state.activePatternId);
  const toggleStep = useProjectStore((state) => state.toggleStep);
  const setStepVelocity = useProjectStore((state) => state.setStepVelocity);
  const createPattern = useProjectStore((state) => state.createPattern);
  const duplicatePattern = useProjectStore((state) => state.duplicatePattern);
  const deletePattern = useProjectStore((state) => state.deletePattern);
  const selectPattern = useProjectStore((state) => state.selectPattern);
  const clearActivePatternSteps = useProjectStore((state) => state.clearActivePatternSteps);
  const randomizeActivePatternSteps = useProjectStore((state) => state.randomizeActivePatternSteps);

  function handlePlay() {
    playSequencer();
  }

  function handleStop() {
    stopSequencer();
  }

  function handleReset() {
    resetSequencer();
  }

  function handleBpmChange(next: number) {
    setBpm(next);
  }

  function handleSwingChange(value: number) {
    setSwing(value);
  }

  function handleStepClick(padId: string, stepIndex: number) {
    toggleStep(padId, stepIndex);
  }

  function handleStepContextMenu(event: React.MouseEvent, padId: string, stepIndex: number) {
    event.preventDefault();

    // Right-click cycles velocity: 0.25 → 0.5 → 0.75 → 1.0 → 0.25
    const current = pattern.steps[padId]?.[stepIndex];
    const nextVelocity = current?.velocity ?? 1;

    if (nextVelocity < 0.35) setStepVelocity(padId, stepIndex, 0.5);
    else if (nextVelocity < 0.6) setStepVelocity(padId, stepIndex, 0.75);
    else if (nextVelocity < 0.9) setStepVelocity(padId, stepIndex, 1);
    else setStepVelocity(padId, stepIndex, 0.25);
  }

  function handlePatternSelect(event: React.ChangeEvent<HTMLSelectElement>) {
    selectPattern(event.target.value as any);
  }

  function handleCreatePattern() {
    const name = `Pattern ${patterns.length + 1}`;
    createPattern(name);
  }

  function handleDuplicatePattern() {
    duplicatePattern(activePatternId);
  }

  function handleDeletePattern() {
    if (patterns.length <= 1) return;
    deletePattern(activePatternId);
  }

  const isSoloPattern = patterns.length <= 1;

  return (
    <section className="rounded border border-line bg-panel p-4">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase text-neutral-200">16-Step Sequencer</h2>
        <span className="text-xs text-neutral-500">
          {pattern.isPlaying ? 'Playing' : 'Stopped'}
          {pattern.isPlaying && ` — step ${pattern.currentStep + 1}`}
        </span>
      </div>

      {/* Pattern controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="text-xs font-bold text-neutral-400">Pattern:</label>
        <select
          className="rounded border border-line bg-neutral-950 px-2 py-1 text-xs text-neutral-200"
          onChange={handlePatternSelect}
          value={activePatternId}
        >
          {patterns.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          className="rounded border border-line px-2 py-1 text-[10px] font-bold text-neutral-300 hover:bg-neutral-800"
          onClick={handleCreatePattern}
          type="button"
        >
          + New
        </button>
        <button
          className="rounded border border-line px-2 py-1 text-[10px] font-bold text-neutral-300 hover:bg-neutral-800"
          onClick={handleDuplicatePattern}
          type="button"
        >
          Dup
        </button>
        <button
          className="rounded border border-line px-2 py-1 text-[10px] font-bold text-neutral-300 hover:bg-neutral-800 disabled:opacity-30"
          disabled={isSoloPattern}
          onClick={handleDeletePattern}
          type="button"
        >
          Del
        </button>
        <div className="ml-auto flex gap-1">
          <button
            className="rounded border border-line px-2 py-1 text-[10px] font-bold text-neutral-300 hover:bg-neutral-800"
            onClick={clearActivePatternSteps}
            type="button"
          >
            Clear
          </button>
          <button
            className="rounded border border-line px-2 py-1 text-[10px] font-bold text-neutral-300 hover:bg-neutral-800"
            onClick={randomizeActivePatternSteps}
            type="button"
          >
            Rand
          </button>
        </div>
      </div>

      {/* Transport controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          <button
            className={
              pattern.isPlaying
                ? 'rounded bg-warning px-4 py-2 text-xs font-bold text-neutral-950'
                : 'rounded bg-signal px-4 py-2 text-xs font-bold text-neutral-950'
            }
            onClick={handlePlay}
            type="button"
          >
            {pattern.isPlaying ? '▶ Playing' : '▶ Play'}
          </button>
          <button
            className="rounded border border-line px-3 py-2 text-xs font-bold text-neutral-300 hover:bg-neutral-800"
            onClick={handleStop}
            type="button"
          >
            ■ Stop
          </button>
          <button
            className="rounded border border-line px-3 py-2 text-xs font-bold text-neutral-300 hover:bg-neutral-800"
            onClick={handleReset}
            type="button"
          >
            ↺ Reset
          </button>
        </div>

        {/* BPM */}
        <div className="flex items-center gap-1">
          <label className="text-xs text-neutral-400">BPM</label>
          <button
            className="rounded border border-line px-2 py-1 text-xs font-bold text-neutral-300 hover:bg-neutral-800"
            onClick={() => handleBpmChange(pattern.bpm - 1)}
            type="button"
          >
            −
          </button>
          <input
            className="w-16 rounded border border-line bg-neutral-950 px-2 py-1 text-center text-sm text-neutral-200"
            max={220}
            min={40}
            onChange={(event) => handleBpmChange(Number(event.target.value))}
            type="number"
            value={pattern.bpm}
          />
          <button
            className="rounded border border-line px-2 py-1 text-xs font-bold text-neutral-300 hover:bg-neutral-800"
            onClick={() => handleBpmChange(pattern.bpm + 1)}
            type="button"
          >
            +
          </button>
        </div>

        {/* Swing */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-neutral-400">Swing</label>
          <input
            className="w-20"
            max={1}
            min={0}
            onChange={(event) => handleSwingChange(Number(event.target.value))}
            step={0.01}
            type="range"
            value={pattern.swing}
          />
          <span className="w-8 text-right text-xs text-neutral-400">
            {Math.round(pattern.swing * 100)}%
          </span>
        </div>
      </div>

      {/* Step grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[820px]">
          {/* Beat division header */}
          <div className="mb-1 grid grid-cols-[60px_repeat(16,minmax(44px,1fr))] gap-1 px-1">
            <div />
            {Array.from({ length: 16 }, (_, i) => (
              <div
                className={`text-center text-[10px] font-bold ${
                  i % 4 === 0 ? 'text-neutral-400' : 'text-neutral-700'
                }`}
                key={`beat-${i}`}
              >
                {i % 4 === 0 ? `| ${i / 4 + 1}` : ''}
              </div>
            ))}
          </div>

          {/* Pad rows */}
          <div className="max-h-[520px] space-y-1 overflow-y-auto pr-1">
            {pads.map((pad) => (
              <div
                className="grid grid-cols-[60px_repeat(16,minmax(44px,1fr))] gap-1"
                key={pad.id}
              >
                {/* Pad label */}
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-neutral-400">{pad.name}</span>
                  {pad.muted && (
                    <span className="text-[9px] text-neutral-600">M</span>
                  )}
                </div>

                {/* Step buttons */}
                {pattern.steps[pad.id]?.map((step, stepIndex) => {
                  const isCurrentStep = pattern.currentStep === stepIndex;
                  const isActive = step.active;

                  return (
                    <button
                      aria-label={`${pad.name} step ${stepIndex + 1}`}
                      className={[
                        'aspect-square rounded border text-[9px] font-bold transition-colors',
                        isActive
                          ? `${velocityOpacity(step.velocity)} border-signal bg-signal text-neutral-950`
                          : 'border-line bg-neutral-900 text-neutral-700 hover:border-neutral-600',
                        isCurrentStep ? 'ring-2 ring-warning' : '',
                      ].join(' ')}
                      key={`${pad.id}-${stepIndex}`}
                      onClick={() => handleStepClick(pad.id, stepIndex)}
                      onContextMenu={(event) =>
                        handleStepContextMenu(event, pad.id, stepIndex)
                      }
                      title={
                        isActive
                          ? `Velocity: ${Math.round(step.velocity * 100)}% (right-click to cycle)`
                          : 'Click to activate'
                      }
                      type="button"
                    >
                      {/* Show beat-division numbers on first step of each beat */}
                      {stepLabel(stepIndex)}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-3 flex items-center gap-4 text-[10px] text-neutral-500">
            <span>Left-click: toggle step</span>
            <span>Right-click: cycle velocity</span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-signal opacity-100" />
              = 100%
              <span className="ml-1 inline-block h-2 w-2 rounded-sm bg-signal opacity-45" />
              = 35%
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
