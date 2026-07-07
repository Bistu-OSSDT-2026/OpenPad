import type { SampleAsset, SampleId } from '../../types/project';

export async function importSample(file: File): Promise<SampleAsset> {
  return {
    id: crypto.randomUUID(),
    name: file.name,
    url: URL.createObjectURL(file),
    duration: 0,
    startTime: 0,
    endTime: 0,
  };
}

export async function decodeAudioFile(_file: File): Promise<AudioBuffer> {
  throw new Error('decodeAudioFile must be implemented by the Sampler module.');
}

export function getWaveformPeaks(_buffer: AudioBuffer, points: number): number[] {
  return Array.from({ length: points }, () => 0);
}

export function trimSample(
  sampleId: SampleId,
  startTime: number,
  endTime: number,
): SampleAsset {
  return {
    id: sampleId,
    name: `Trim ${sampleId}`,
    url: '',
    duration: Math.max(0, endTime - startTime),
    startTime,
    endTime,
  };
}
