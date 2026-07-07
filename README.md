# OpenPad Lab

OpenPad Lab is an open-source browser pad sampler MVP. The target demo flow is:

Upload sample -> Chop -> Assign to pads -> Play 16-step sequence -> Control FX by gesture -> Save project JSON.

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS
- Zustand
- Web Audio API or Tone.js behind `modules/audio`
- MediaPipe Hands or a lightweight browser hand tracker behind `modules/gesture`

## Development

```bash
npm install
npm run dev
npm run build
```

## Module Ownership

- UI / Architecture: `src/App.tsx`, `src/components/Layout`, `src/store`, `src/types`
- Audio / Pad: `src/components/PadGrid`, `src/modules/audio`
- Sampler / Chop: `src/components/WaveformEditor`, `src/modules/sampler`
- Sequencer: `src/components/Sequencer`, `src/modules/sequencer`
- Gesture FX: `src/components/FxPanel`, `src/components/GesturePanel`, `src/modules/effects`, `src/modules/gesture`

All shared data must go through `src/store/useProjectStore.ts`.

See `docs/BCDE_MODULE_CONTRACTS.md` for the exact B/C/D/E development standards, shared types, store actions, and module APIs.
