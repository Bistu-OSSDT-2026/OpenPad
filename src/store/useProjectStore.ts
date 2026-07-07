import { create } from 'zustand';
import {
  createDefaultProject,
  exportProjectJson as serializeProject,
  loadProjectJson as parseProject,
} from '../modules/project/saveLoad';
import type {
  FxState,
  NoteLength,
  PadId,
  PadState,
  Pattern,
  PatternId,
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
  setSwing(swing: number): void;
  setNoteLength(noteLength: NoteLength): void;
  selectPattern(patternId: PatternId): void;
  createPattern(name: string): void;
  duplicatePattern(patternId: PatternId): void;
  deletePattern(patternId: PatternId): void;
  clearActivePatternSteps(): void;
  randomizeActivePatternSteps(): void;
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
    set((state) => {
      const updatedSteps = {
        ...state.pattern.steps,
        [padId]: state.pattern.steps[padId].map((step, index) =>
          index === stepIndex ? { ...step, active: !step.active } : step,
        ),
      };
      return {
        pattern: { ...state.pattern, steps: updatedSteps },
        patterns: state.patterns.map((p) =>
          p.id === state.activePatternId ? { ...p, steps: updatedSteps } : p,
        ),
      };
    }),

  setStepVelocity: (padId, stepIndex, velocity) =>
    set((state) => {
      const updatedSteps = {
        ...state.pattern.steps,
        [padId]: state.pattern.steps[padId].map((step, index) =>
          index === stepIndex
            ? { ...step, velocity: Math.min(1, Math.max(0, velocity)) }
            : step,
        ),
      };
      return {
        pattern: { ...state.pattern, steps: updatedSteps },
        patterns: state.patterns.map((p) =>
          p.id === state.activePatternId ? { ...p, steps: updatedSteps } : p,
        ),
      };
    }),

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

  setSwing: (swing) =>
    set((state) => ({
      pattern: {
        ...state.pattern,
        swing: Math.min(1, Math.max(0, swing)),
      },
    })),

  setNoteLength: (noteLength) =>
    set((state) => ({
      pattern: { ...state.pattern, noteLength },
    })),

  selectPattern: (patternId) =>
    set((state) => {
      const pattern = state.patterns.find((p) => p.id === patternId);
      if (!pattern) return state;
      return {
        activePatternId: patternId,
        pattern: {
          ...state.pattern,
          steps: structuredClone(pattern.steps),
        },
      };
    }),

  createPattern: (name) =>
    set((state) => {
      const id = `pattern-${Date.now()}` as PatternId;
      const newPattern: Pattern = {
        id,
        name,
        steps: structuredClone(state.pattern.steps),
      };
      return {
        patterns: [...state.patterns, newPattern],
        activePatternId: id,
      };
    }),

  duplicatePattern: (patternId) =>
    set((state) => {
      const source = state.patterns.find((p) => p.id === patternId);
      if (!source) return state;
      const id = `pattern-${Date.now()}` as PatternId;
      const dup: Pattern = {
        id,
        name: `${source.name} (copy)`,
        steps: structuredClone(source.steps),
      };
      return {
        patterns: [...state.patterns, dup],
        activePatternId: id,
        pattern: {
          ...state.pattern,
          steps: structuredClone(dup.steps),
        },
      };
    }),

  deletePattern: (patternId) =>
    set((state) => {
      if (state.patterns.length <= 1) return state;
      const filtered = state.patterns.filter((p) => p.id !== patternId);
      if (filtered.length === state.patterns.length) return state;
      const nextActive = filtered[0];
      return {
        patterns: filtered,
        activePatternId: nextActive.id,
        pattern: {
          ...state.pattern,
          steps: structuredClone(nextActive.steps),
        },
      };
    }),

  clearActivePatternSteps: () =>
    set((state) => {
      const cleared = Object.fromEntries(
        Object.entries(state.pattern.steps).map(([padId, steps]) => [
          padId,
          steps.map((s) => ({ ...s, active: false })),
        ]),
      );
      return {
        pattern: { ...state.pattern, steps: cleared },
      };
    }),

  randomizeActivePatternSteps: () =>
    set((state) => {
      const randomized = Object.fromEntries(
        Object.entries(state.pattern.steps).map(([padId, steps]) => [
          padId,
          steps.map(() => ({
            active: Math.random() > 0.65,
            velocity: 0.25 + Math.random() * 0.75,
          })),
        ]),
      );
      return {
        pattern: { ...state.pattern, steps: randomized },
      };
    }),

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
