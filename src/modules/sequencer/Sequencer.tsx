// src/components/Sequencer/Sequencer.tsx
import { sequencerEngine } from '../../modules/sequencer/sequencerEngine';
import { useProjectStore } from '../../store/useProjectStore';

export function Sequencer() {
  const pads = useProjectStore((state) => state.pads);
  const pattern = useProjectStore((state) => state.pattern);
  const currentStep = pattern.currentStep;

  const handlePlayToggle = () => {
    if (pattern.isPlaying) {
      sequencerEngine.stopSequencer();
    } else {
      sequencerEngine.playSequencer();
    }
  };

  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const bpm = parseInt(e.target.value, 10);
    if (!isNaN(bpm) && bpm > 0) {
      sequencerEngine.setBpm(bpm);
    }
  };

  const handleStepClick = (padId: string, stepIndex: number) => {
    sequencerEngine.toggleStep(padId, stepIndex);
  };

  return (
    <div className="rounded border border-line bg-panel p-4">
      <div className="flex items-center gap-4 mb-3">
        <button
          onClick={handlePlayToggle}
          className={`px-4 py-2 rounded text-sm font-bold ${
            pattern.isPlaying
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-green-500 hover:bg-green-600'
          } text-white`}
        >
          {pattern.isPlaying ? '⏹ Stop' : '▶ Play'}
        </button>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">BPM:</label>
          <input
            type="number"
            value={pattern.bpm}
            onChange={handleBpmChange}
            className="w-16 bg-panelSoft border border-line rounded px-2 py-1 text-white text-sm"
            min="40"
            max="220"
          />
        </div>
        <span className="text-sm text-gray-500">
          Step: {currentStep + 1}/16
        </span>
      </div>

      <div className="grid grid-cols-16 gap-1 overflow-x-auto">
        {pads.map((pad) => (
          <div key={pad.id} className="flex flex-col items-center min-w-[60px]">
            <span className="text-[10px] text-gray-500 truncate max-w-[40px]">
              {pad.name || pad.id.slice(0, 4)}
            </span>
            <div className="flex gap-0.5">
              {Array.from({ length: 16 }, (_, stepIndex) => {
                const steps = pattern.steps[pad.id];
                const isActive = steps?.[stepIndex]?.active || false;
                const isCurrent = stepIndex === currentStep;

                return (
                  <button
                    key={stepIndex}
                    onClick={() => handleStepClick(pad.id, stepIndex)}
                    className={`
                      w-5 h-5 rounded-sm transition-all
                      ${isActive ? 'bg-blue-500' : 'bg-panelSoft border border-line'}
                      ${isCurrent ? 'ring-1 ring-yellow-400' : ''}
                      hover:opacity-80
                    `}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
