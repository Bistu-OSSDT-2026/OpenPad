import type {
  ChopParts,
  FxParamName,
  FxState,
  GestureState,
  PadId,
  PadState,
  SampleAsset,
  SampleId,
  StepIndex,
} from './project';

export interface AudioEngineContract {
  initAudioEngine(): Promise<void>;
  loadSampleBuffer(sample: SampleAsset): Promise<void>;
  assignSampleToPad(padId: PadId, sampleId: SampleId): void;
  triggerPad(padId: PadId, velocity?: number): void;
  stopAllSounds(): void;
  setPadVolume(padId: PadId, volume: number): void;
  setPadPitch(padId: PadId, pitch: number): void;
  applyFxState(fx: Partial<FxState>): void;
}

export interface SamplerContract {
  importSample(file: File): Promise<SampleAsset>;
  decodeAudioFile(file: File): Promise<AudioBuffer>;
  getWaveformPeaks(buffer: AudioBuffer, points: number): number[];
  trimSample(sampleId: SampleId, startTime: number, endTime: number): SampleAsset;
  chopSample(sampleId: SampleId, parts: ChopParts): Promise<SampleAsset[]>;
  assignChopsToPads(samples: SampleAsset[], startPadIndex?: number): void;
}

export interface SequencerContract {
  playSequencer(): void;
  stopSequencer(): void;
  resetSequencer(): void;
  setBpm(bpm: number): void;
  toggleStep(padId: PadId, stepIndex: StepIndex): void;
  setStepVelocity(padId: PadId, stepIndex: StepIndex, velocity: number): void;
  getCurrentStep(): number;
}

export interface GestureFxContract {
  startGestureTracking(videoElement: HTMLVideoElement): Promise<void>;
  stopGestureTracking(): void;
  onGestureChange(callback: (gesture: GestureState) => void): void;
  setFxParam(name: FxParamName, value: number): void;
  applyFxState(fx: Partial<FxState>): void;
  mapGestureToFx(gesture: GestureState): Partial<FxState>;
  smoothValue(previous: number, next: number, factor: number): number;
}

export interface PadComponentProps {
  pad: PadState;
  sample?: SampleAsset;
  onTrigger(padId: PadId, velocity?: number): void;
}
