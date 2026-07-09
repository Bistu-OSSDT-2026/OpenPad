# Core Pre-Gesture Integration

This document records the stable integration baseline before the Gesture FX module is added.

## Integrated Modules

- Architecture / shared layer: `src/types/project.ts`, `src/store/useProjectStore.ts`
- Audio / Pad: `src/modules/audio/audioEngine.ts`, `src/components/PadGrid/PadGrid.tsx`
- Sampler / Chop: `src/modules/sampler/`, `src/components/WaveformEditor/WaveformEditor.tsx`
- Sequencer / Pattern: `src/modules/sequencer/sequencerEngine.ts`, `src/components/Sequencer/Sequencer.tsx`

Gesture FX is not part of this baseline.

## Core Data Flow

```txt
Audio file
  -> importSample()
  -> SampleAsset in useProjectStore.samples
  -> chopSample()
  -> SampleAsset slices with startTime/endTime
  -> assignSamplesToPads()
  -> PadState.sampleId
  -> triggerPad(padId, velocity?)
  -> audioEngine plays assigned sample slice
```

Sequencer playback uses the same pad/audio path:

```txt
Sequencer active step
  -> triggerPad(padId, velocity?)
  -> audioEngine
  -> assigned sample slice playback
```

## Important Shared Interfaces

- `SampleAsset`: sample metadata, object URL, duration, slice start/end, waveform peaks.
- `PadState`: pad label, assigned `sampleId`, volume, pitch, mute state.
- `PatternState`: BPM, current step, play state, and per-pad step grid.
- `useProjectStore`: the only shared state store for samples, pads, pattern, FX, and project JSON.
- `triggerPad(padId, velocity?)`: the shared playback entry point used by manual pads and sequencer.

## Core User Flow

1. Upload an audio sample in the sampler panel.
2. Confirm waveform bars appear.
3. Chop the sample into 4, 8, or 16 slices.
4. Assign slices to pads through the shared store.
5. Click pads or use keyboard shortcuts to trigger playback.
6. Toggle sequencer steps.
7. Press Play and confirm active steps trigger the same pad/audio path.
8. Adjust BPM and confirm loop timing changes.
9. Press Stop or Reset.

## Manual Test Checklist

- [ ] App starts successfully
- [ ] Sample can be uploaded
- [ ] Waveform appears
- [ ] Chop 4 works
- [ ] Chop 8 works
- [ ] Chop 16 works
- [ ] Slices can be assigned to pads
- [ ] Pad click produces playback
- [ ] Keyboard pad trigger works if supported
- [ ] Sequencer step can be toggled
- [ ] Sequencer triggers assigned pad
- [ ] BPM change affects timing
- [ ] Loop works
- [ ] Stop works
- [ ] Build passes

## Known Limitations

- FX controls are present, but Gesture FX / webcam integration is still pending.
- Audio sample buffers are cached in memory for the current session only.
- Project JSON stores sample object URLs, which are suitable for current-session demos but not long-term persistence after browser reloads.
- Sequencer timing uses `setInterval`, which is acceptable for the MVP demo but not production-grade musical timing.

## Future Gesture FX Contract

The future Gesture FX module should integrate through the existing `FxState` and store action:

- `setFx(patch)`
- `applyFxState(fx)`
- `GesturePanel`
- `FxPanel`

It should not trigger pads directly and should not create a second audio engine.
