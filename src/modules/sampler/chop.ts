import type { SampleAsset, SampleId } from '../../types/project';
import { useProjectStore } from '../../store/useProjectStore';
import { getWaveformPeaks } from './sampleManager';

const DEFAULT_CHOP_DURATION_SECONDS = 0.75;
const MIN_CHOP_DURATION_SECONDS = 0.1;
const MAX_CHOP_DURATION_SECONDS = 8;

function getAudioContext(): AudioContext {
  const AudioContextCtor =
    window.AudioContext ||
    (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    throw new Error('Web Audio is not available in this browser.');
  }

  return new AudioContextCtor();
}

async function decodeSampleFromUrl(url: string): Promise<AudioBuffer> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Unable to load sample from ${url}`);
  }

  const audioContext = getAudioContext();
  const arrayBuffer = await response.arrayBuffer();

  try {
    return await audioContext.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    if (audioContext.state !== 'closed') {
      await audioContext.close().catch(() => undefined);
    }
  }
}

function normalizeChopDuration(durationSeconds = DEFAULT_CHOP_DURATION_SECONDS): number {
  return Math.min(
    MAX_CHOP_DURATION_SECONDS,
    Math.max(MIN_CHOP_DURATION_SECONDS, durationSeconds),
  );
}

export async function chopSample(
  sampleId: SampleId,
  parts: 4 | 8 | 16,
  durationSeconds?: number,
): Promise<SampleAsset[]> {
  const sample = useProjectStore.getState().samples.find((item) => item.id === sampleId);

  if (!sample) {
    return [];
  }

  const audioBuffer = await decodeSampleFromUrl(sample.url);
  const sliceSpacing = audioBuffer.duration / parts;
  const sliceDuration = normalizeChopDuration(durationSeconds);
  const baseName = sample.name.replace(/\.[^.]+$/, '');
  const choppedSamples: SampleAsset[] = [];

  for (let index = 0; index < parts; index += 1) {
    const startTime = Math.min(index * sliceSpacing, audioBuffer.duration);
    const endTime = Math.min(audioBuffer.duration, startTime + sliceDuration);
    const duration = Math.max(0.001, endTime - startTime);

    choppedSamples.push({
      id: crypto.randomUUID(),
      name: `${baseName} Slice ${index + 1}/${parts}`,
      url: sample.url,
      duration,
      startTime,
      endTime,
      sourceFileName: sample.sourceFileName ?? sample.name,
      waveformPeaks: getWaveformPeaks(audioBuffer, 32),
    });
  }

  return choppedSamples;
}

export function assignChopsToPads(samples: SampleAsset[], startPadIndex = 0): void {
  useProjectStore.getState().assignSamplesToPads(samples, startPadIndex);
}
