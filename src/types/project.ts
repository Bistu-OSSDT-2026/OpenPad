export type PadId = string;
export type SampleId = string;
export type StepIndex = number;
export type ChopParts = 4 | 8 | 16;
export type FxParamName = keyof FxState;

export const PAD_COUNT = 16;
export const STEP_COUNT = 16;
export const PAD_KEY_LABELS = [
  'Q',
  'W',
  'E',
  'R',
  'A',
  'S',
  'D',
  'F',
  'Z',
  'X',
  'C',
  'V',
  '1',
  '2',
  '3',
  '4',
] as const;

export interface SampleAsset {
  id: SampleId;
  name: string;
  url: string;
  duration: number;
  startTime: number;
  endTime: number;
  sourceFileName?: string;
  waveformPeaks?: number[];
}

export interface PadState {
  id: PadId;
  name: string;
  sampleId?: SampleId;
  volume: number;
  pitch: number;
  muted: boolean;
}

export interface StepState {
  active: boolean;
  velocity: number;
}

export interface PatternState {
  bpm: number;
  isPlaying: boolean;
  currentStep: number;
  steps: Record<PadId, StepState[]>;
}

export interface FxState {
  filterCutoff: number;
  reverbAmount: number;
  delayFeedback: number;
  bitcrusherAmount: number;
}

export interface ProjectState {
  pads: PadState[];
  samples: SampleAsset[];
  pattern: PatternState;
  fx: FxState;
}

export interface GestureState {
  handX: number;
  handY: number;
  openness: number;
  confidence: number;
}

export interface ProjectMeta {
  name: string;
  updatedAt: string;
  schemaVersion: 1;
}
