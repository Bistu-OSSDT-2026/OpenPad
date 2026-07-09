# Gesture FX Controls

## Default State

When OpenPad starts, all FX values are `0`.

- `Filter = 0`: filter is treated as off / neutral.
- `Reverb = 0`: no reverb send.
- `Delay = 0`: no delay feedback.
- `Crush = 0`: no bitcrusher effect.

This keeps the default pad and sequencer sound dry until the user moves a slider or starts Gesture FX.

## Hand Mapping

Gesture FX reads one hand from the camera and maps it to FX parameters:

- Horizontal hand position, `Hand X`, controls `Delay`.
- Vertical hand position, `Hand Y`, controls `Filter`.
- Hand openness controls `Reverb`.

`Crush` is manual-only for now. It is not controlled by hand tracking because it can make the demo sound too harsh very quickly.

## Axis Details

### Hand X -> Delay

- Move hand left: less delay feedback.
- Move hand right: more delay feedback.
- Range: `0.00` to `0.95`.

### Hand Y -> Filter

The camera coordinate system has `0` at the top and `1` at the bottom.

- Move hand up: higher filter cutoff, brighter sound.
- Move hand down: lower filter cutoff, darker sound.
- Range while controlled by gesture: about `200 Hz` to `12000 Hz`.
- Value `0` means filter is off / neutral before gesture control starts.

### Hand Openness -> Reverb

- Closed hand: less reverb.
- Open hand: more reverb.
- Range: `0.00` to `1.00`.

## Stability Rules

- Gesture updates only apply when hand tracking confidence is at least `0.60`.
- FX values are smoothed before being applied, so parameter movement should not jump too sharply.
- Stopping camera tracking stops camera resources, but it does not automatically reset FX. Use the FX panel Reset button to return all values to `0`.
