# BCDE Module Contracts

This document is the development baseline for members B, C, D, and E. Everyone works inside the same React + TypeScript + Vite project and shares the same `ProjectState` through Zustand.

## 1. Runnable Project Skeleton

Project root:

```txt
openpad-lab/
  src/
    App.tsx
    components/
      PadGrid/
      WaveformEditor/
      Sequencer/
      FxPanel/
      GesturePanel/
    modules/
      audio/
      sampler/
      sequencer/
      effects/
      gesture/
      project/
    store/useProjectStore.ts
    types/project.ts
    types/contracts.ts
```

Required commands:

```bash
npm install
npm run dev
npm run build
```

Before opening a PR, `npm run build` must pass.

## 2. Shared TypeScript Types

All shared data types live in `src/types/project.ts`.

Core types:

- `SampleAsset`: audio file or chopped slice metadata.
- `PadState`: one pad in the 4x4 grid.
- `StepState`: one sequencer cell.
- `PatternState`: BPM, play state, current step, and pad step matrix.
- `FxState`: filter, reverb, delay, and bitcrusher params.
- `GestureState`: normalized hand state from gesture tracking.
- `ProjectState`: complete save/load state.

Do not create duplicate versions of these types inside module folders. If a module needs a shared shape, add it to `src/types/project.ts` after review.

## 3. Store Contract

All shared app state must go through `src/store/useProjectStore.ts`.

Allowed actions:

```ts
addSample(sample)
updateSample(sampleId, patch)
removeSample(sampleId)
assignSampleToPad(padId, sampleId)
assignSamplesToPads(samples, startPadIndex)
updatePad(padId, patch)
clearPad(padId)
toggleStep(padId, stepIndex)
setStepVelocity(padId, stepIndex, velocity)
setBpm(bpm)
setCurrentStep(stepIndex)
setSequencerPlaying(isPlaying)
setFx(patch)
resetFx()
resetProject()
exportProjectJson()
loadProjectJson(json)
```

Rules:

- No module creates a second global store.
- Components read state with `useProjectStore`.
- Audio runtime objects such as `AudioContext` and decoded `AudioBuffer` should stay inside `modules/audio`, not inside Zustand.
- Camera streams and detector instances should stay inside `modules/gesture`, not inside Zustand.
- Store contains serializable project data only.

## 4. Interface Standards

Module API contracts live in `src/types/contracts.ts`.

### B. Audio + Pad

Owned files:

- `src/components/PadGrid/`
- `src/modules/audio/audioEngine.ts`

Required API:

```ts
initAudioEngine(): Promise<void>
loadSampleBuffer(sample): Promise<void>
assignSampleToPad(padId, sampleId): void
triggerPad(padId, velocity?): void
stopAllSounds(): void
setPadVolume(padId, volume): void
setPadPitch(padId, pitch): void
applyFxState(fx): void
```

Acceptance:

- Clicking a pad can trigger its assigned sample.
- Keyboard labels Q/W/E/R, A/S/D/F, Z/X/C/V, 1/2/3/4 trigger pads.
- `triggerPad` can be called by the sequencer without importing React components.

### C. Sampler + Chop

Owned files:

- `src/components/WaveformEditor/`
- `src/modules/sampler/sampleManager.ts`
- `src/modules/sampler/chop.ts`

Required API:

```ts
importSample(file): Promise<SampleAsset>
decodeAudioFile(file): Promise<AudioBuffer>
getWaveformPeaks(buffer, points): number[]
trimSample(sampleId, startTime, endTime): SampleAsset
chopSample(sampleId, parts): Promise<SampleAsset[]>
assignChopsToPads(samples, startPadIndex?): void
```

Acceptance:

- Uploading mp3/wav creates a `SampleAsset`.
- Waveform can render from `waveformPeaks`.
- Chop 4/8/16 creates slice samples.
- Assigning chops calls store action `assignSamplesToPads`.

### D. Sequencer

Owned files:

- `src/components/Sequencer/`
- `src/modules/sequencer/sequencerEngine.ts`

Required API:

```ts
playSequencer(): void
stopSequencer(): void
resetSequencer(): void
setBpm(bpm): void
toggleStep(padId, stepIndex): void
setStepVelocity(padId, stepIndex, velocity): void
getCurrentStep(): number
```

Acceptance:

- 16-step loop follows store BPM.
- Active steps call B module `triggerPad(padId, velocity)`.
- Sequencer does not decode audio or play audio directly.

### E. Gesture FX

Owned files:

- `src/components/FxPanel/`
- `src/components/GesturePanel/`
- `src/modules/effects/fxEngine.ts`
- `src/modules/gesture/gestureTracker.ts`

Required API:

```ts
startGestureTracking(videoElement): Promise<void>
stopGestureTracking(): void
onGestureChange(callback): void
setFxParam(name, value): void
applyFxState(fx): void
mapGestureToFx(gesture): Partial<FxState>
smoothValue(previous, next, factor): number
```

Acceptance:

- Manual FX sliders always work even if camera permission fails.
- Gesture maps to FX only, never directly to pad triggering.
- Values are smoothed before writing to store.

## PR Checklist

- I changed only my owned component/module folders unless discussed.
- I imported shared types from `src/types/project.ts`.
- I used `useProjectStore` actions instead of creating a new global state.
- I did not bypass another member's module boundary.
- `npm run build` passes.
