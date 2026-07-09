import { create } from 'zustand';
import {
  createDefaultProject,
  exportProjectJson as serializeProject,
  loadProjectJson as parseProject,
} from '../modules/project/saveLoad';
import type {
  FxState,
  PadId,
  PadState,
  ProjectState,
  SampleAsset,
  SampleId,
  StepIndex,
} from '../types/project';

export interface ProjectActions {
  addSample(sample: SampleAsset): void;
  updateSample(sampleId: SampleId, patch: Partial<SampleAsset>): void;
  removeSample(sampleId: SampleId): void;
  assignSampleToPad(padId: PadId, sampleId: SampleId): void;
  assignSamplesToPads(samples: SampleAsset[], startPadIndex?: number): void;
  updatePad(padId: PadId, patch: Partial<PadState>): void;
  clearPad(padId: PadId): void;
  toggleStep(padId: PadId, stepIndex: StepIndex): void;
  setStepVelocity(padId: PadId, stepIndex: StepIndex, velocity: number): void;
  setBpm(bpm: number): void;
  setCurrentStep(stepIndex: number): void;
  setSequencerPlaying(isPlaying: boolean): void;
  setFx(patch: Partial<FxState>): void;
  resetFx(): void;
  resetProject(): void;
  exportProjectJson(): string;
  loadProjectJson(json: string): void;
}

export type ProjectStore = ProjectState & ProjectActions;

const defaultProject = createDefaultProject();

export const useProjectStore = create<ProjectStore>((set, get) => ({
  ...defaultProject,

  addSample: (sample) =>
    set((state) => ({
      samples: [...state.samples, sample],
    })),

  updateSample: (sampleId, patch) =>
    set((state) => ({
      samples: state.samples.map((sample) =>
        sample.id === sampleId ? { ...sample, ...patch } : sample,
      ),
    })),

  removeSample: (sampleId) =>
    set((state) => ({
      samples: state.samples.filter((sample) => sample.id !== sampleId),
      pads: state.pads.map((pad) =>
        pad.sampleId === sampleId ? { ...pad, sampleId: undefined } : pad,
      ),
    })),

  assignSampleToPad: (padId, sampleId) =>
    set((state) => ({
      pads: state.pads.map((pad) =>
        pad.id === padId ? { ...pad, sampleId } : pad,
      ),
    })),

  assignSamplesToPads: (samples, startPadIndex = 0) =>
    set((state) => {
      const nextSamples = [...state.samples];

      for (const sample of samples) {
        if (!nextSamples.some((item) => item.id === sample.id)) {
          nextSamples.push(sample);
        }
      }

      return {
        samples: nextSamples,
        pads: state.pads.map((pad, index) => {
          const sample = samples[index - startPadIndex];

          return sample ? { ...pad, sampleId: sample.id } : pad;
        }),
      };
    }),

  updatePad: (padId, patch) =>
    set((state) => ({
      pads: state.pads.map((pad) =>
        pad.id === padId ? { ...pad, ...patch } : pad,
      ),
    })),

  clearPad: (padId) =>
    set((state) => ({
      pads: state.pads.map((pad) =>
        pad.id === padId ? { ...pad, sampleId: undefined } : pad,
      ),
    })),

  toggleStep: (padId, stepIndex) =>
    set((state) => ({
      pattern: {
        ...state.pattern,
        steps: {
          ...state.pattern.steps,
          [padId]: state.pattern.steps[padId].map((step, index) =>
            index === stepIndex ? { ...step, active: !step.active } : step,
          ),
        },
      },
    })),

  setStepVelocity: (padId, stepIndex, velocity) =>
    set((state) => ({
      pattern: {
        ...state.pattern,
        steps: {
          ...state.pattern.steps,
          [padId]: state.pattern.steps[padId].map((step, index) =>
            index === stepIndex
              ? { ...step, velocity: Math.min(1, Math.max(0, velocity)) }
              : step,
          ),
        },
      },
    })),

  setBpm: (bpm) =>
    set((state) => ({
      pattern: { ...state.pattern, bpm: Math.min(220, Math.max(40, bpm)) },
    })),

  setCurrentStep: (stepIndex) =>
    set((state) => ({
      pattern: { ...state.pattern, currentStep: stepIndex % 16 },
    })),

  setSequencerPlaying: (isPlaying) =>
    set((state) => ({
      pattern: { ...state.pattern, isPlaying },
    })),

  setFx: (patch) =>
    set((state) => ({
      fx: { ...state.fx, ...patch },
    })),

  resetFx: () =>
    set({
      fx: createDefaultProject().fx,
    }),

  resetProject: () => set(createDefaultProject()),

  exportProjectJson: () => serializeProject(get()),

  loadProjectJson: (json) => {
    const loaded = parseProject(json);
    set(loaded);
  },
}));
