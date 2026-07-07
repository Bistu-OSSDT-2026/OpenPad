import { useEffect } from 'react';
import { FxPanel } from './components/FxPanel/FxPanel';
import { GesturePanel } from './components/GesturePanel/GesturePanel';
import { Layout } from './components/Layout/Layout';
import { PadGrid } from './components/PadGrid/PadGrid';
// import { Sequencer } from './components/Sequencer/Sequencer';  // ← 暂时注释掉
import { WaveformEditor } from './components/WaveformEditor/WaveformEditor';
import { useProjectStore } from './store/useProjectStore';
import { audioEngine } from './modules/audio/audioEngine';

export default function App() {
  const exportProjectJson = useProjectStore((state) => state.exportProjectJson);
  const loadProjectJson = useProjectStore((state) => state.loadProjectJson);

  // ===== 初始化 AudioEngine =====
  useEffect(() => {
    audioEngine.initAudioEngine().catch((err) => {
      console.warn('AudioEngine 初始化失败:', err);
    });
  }, []);

  function handleExport() {
    const blob = new Blob([exportProjectJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'openpad-lab-project.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    file.text().then(loadProjectJson).catch(() => {
      window.alert('Project JSON could not be loaded.');
    });
  }

  return (
    <Layout>
      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-5">
          <WaveformEditor />
          <PadGrid />
        </div>
        <div className="grid gap-5">
          <FxPanel />
          <GesturePanel />
          <div className="rounded border border-line bg-panel p-4">
            <h2 className="mb-3 text-sm font-bold uppercase text-neutral-200">Project</h2>
            <div className="flex gap-2">
              <button
                className="rounded bg-signal px-3 py-2 text-xs font-bold text-neutral-950"
                onClick={handleExport}
                type="button"
              >
                Export JSON
              </button>
              <label className="cursor-pointer rounded border border-line px-3 py-2 text-xs font-bold text-neutral-200">
                Import JSON
                <input accept="application/json" className="hidden" onChange={handleImport} type="file" />
              </label>
            </div>
          </div>
        </div>
      </section>
      {/* <Sequencer /> */}  {/* ← 暂时注释掉 */}
    </Layout>
  );
}
