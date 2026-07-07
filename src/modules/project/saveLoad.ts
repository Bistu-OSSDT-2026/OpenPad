import {
  PAD_KEY_LABELS,
  STEP_COUNT,
  type PatternId,
  type ProjectState,
} from '../../types/project';

export function createDefaultProject(): ProjectState {
  const pads = PAD_KEY_LABELS.map((name, index) => ({
    id: `pad-${index + 1}`,
    name,
    volume: 0.85,
    pitch: 0,
    muted: false,
  }));

  const steps = Object.fromEntries(
    pads.map((pad) => [
      pad.id,
      Array.from({ length: STEP_COUNT }, () => ({ active: false, velocity: 1 })),
    ]),
  );

  const firstPatternId = 'pattern-1' as PatternId;

  return {
    pads,
    samples: [],
    pattern: {
      bpm: 96,
      isPlaying: false,
      currentStep: 0,
      steps,
      swing: 0,
      noteLength: 16,
    },
    patterns: [
      {
        id: firstPatternId,
        name: 'Pattern 1',
        steps: structuredClone(steps),
      },
    ],
    activePatternId: firstPatternId,
    fx: {
      filterCutoff: 8400,
      reverbAmount: 0.18,
      delayFeedback: 0.22,
      bitcrusherAmount: 0,
    },
  };
}

export function validateProjectState(project: ProjectState): boolean {
  return (
    Array.isArray(project.pads) &&
    Array.isArray(project.samples) &&
    Array.isArray(project.patterns) &&
    Boolean(project.pattern?.steps) &&
    typeof project.pattern?.bpm === 'number' &&
    typeof project.pattern?.swing === 'number' &&
    typeof project.activePatternId === 'string' &&
    typeof project.fx?.filterCutoff === 'number'
  );
}

export function exportProjectJson(project: ProjectState): string {
  return JSON.stringify(project, null, 2);
}

export function loadProjectJson(json: string): ProjectState {
  const parsed = JSON.parse(json) as ProjectState;

  if (!validateProjectState(parsed)) {
    throw new Error('Invalid OpenPad Lab project JSON');
  }

  return parsed;
}
