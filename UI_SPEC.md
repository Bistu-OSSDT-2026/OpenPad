# UI Spec

The UI uses a dark hardware-sampler style: compact panels, high contrast controls, 4x4 pad grid, waveform strip, sequencer grid, FX sliders, and gesture preview.

## Layout

- Header with project identity and demo status.
- Left column: sampler and pad grid.
- Right column: FX, gesture, project save/load.
- Bottom: 16-step sequencer.

## Component Boundaries

- `Layout`: shell and header.
- `PadGrid`: 16 pads and sample labels.
- `WaveformEditor`: upload/chop/waveform controls.
- `Sequencer`: BPM, play/stop, 16-step grid.
- `FxPanel`: manual FX sliders.
- `GesturePanel`: camera/gesture status and mapped values.
