# Architecture

OpenPad Lab uses one shared `ProjectState` type and one shared Zustand store. Feature modules expose functions through stable files under `src/modules`, while UI components read and write shared state through `useProjectStore`.

## Data Flow

Sampler creates `SampleAsset` records -> store saves samples -> pads reference `sampleId` -> Audio module triggers pad playback -> Sequencer calls Audio trigger APIs -> Gesture maps hand state to `FxState` -> Audio FX engine applies FX.

## Rules

- Sequencer does not implement audio playback.
- Gesture does not trigger pads directly.
- Sampler does not play audio directly.
- App layout, shared types, and store changes need project-lead review.
- P0 favors demo stability over feature count.

## Contract Files

- Shared state shape: `src/types/project.ts`
- Module API interfaces: `src/types/contracts.ts`
- Store actions: `src/store/useProjectStore.ts`
- Member development rules: `docs/BCDE_MODULE_CONTRACTS.md`
