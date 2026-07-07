// src/components/PadGrid/PadGrid.tsx
import { useEffect } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { audioEngine } from '../../modules/audio/audioEngine';
import type { PadId } from '../../types/project';

// 键盘映射: 按键 -> Pad索引 (0-15)
const KEYBOARD_MAP: Record<string, number> = {
  q: 0,
  w: 1,
  e: 2,
  r: 3,
  a: 4,
  s: 5,
  d: 6,
  f: 7,
  z: 8,
  x: 9,
  c: 10,
  v: 11,
  '1': 12,
  '2': 13,
  '3': 14,
  '4': 15,
};

export function PadGrid() {
  const pads = useProjectStore((state) => state.pads);
  const samples = useProjectStore((state) => state.samples);

  // 处理 Pad 点击
  const handlePadTrigger = (padId: PadId, velocity: number = 1) => {
    audioEngine.triggerPad(padId, velocity);
  };

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果用户正在输入框内，不触发
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();
      const index = KEYBOARD_MAP[key];

      if (index !== undefined && pads[index]) {
        e.preventDefault();
        const pad = pads[index];
        // 如果有 sample 才触发
        if (pad.sampleId) {
          handlePadTrigger(pad.id, 0.8);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pads]);

  return (
    <div className="p-4">
      <h2 className="text-sm font-mono text-gray-400 uppercase tracking-wider mb-3">
        Pad Grid · 键盘: Q W E R / A S D F / Z X C V / 1 2 3 4
      </h2>
      <div className="grid grid-cols-4 gap-3 max-w-md">
        {pads.map((pad, index) => {
          const sample = samples.find((s) => s.id === pad.sampleId);
          const hasSample = !!pad.sampleId;
          const isMuted = pad.muted;

          return (
            <button
              key={pad.id}
              onClick={() => handlePadTrigger(pad.id)}
              className={`
                relative aspect-square rounded-lg shadow-pad transition-all duration-100
                ${hasSample && !isMuted ? 'bg-blue-600 hover:bg-blue-500 active:scale-95' : ''}
                ${hasSample && isMuted ? 'bg-gray-600 opacity-50' : ''}
                ${!hasSample ? 'bg-panelSoft border border-line hover:border-gray-500' : ''}
                text-white font-bold text-sm
                flex flex-col items-center justify-center
              `}
            >
              <span className="text-xs text-gray-400 absolute top-1 left-2 font-mono">
                {['Q','W','E','R','A','S','D','F','Z','X','C','V','1','2','3','4'][index]}
              </span>
              <span className="text-xs truncate max-w-[80%]">
                {pad.name || `Pad ${index + 1}`}
              </span>
              {hasSample && (
                <span className="text-[10px] text-green-400 mt-0.5">●</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
