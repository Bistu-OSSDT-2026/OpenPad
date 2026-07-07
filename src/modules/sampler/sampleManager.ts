import type { SampleAsset, SampleId } from '../../types/project';

function getAudioContext(): AudioContext {
  const AudioContextCtor =
    window.AudioContext ||
    (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    throw new Error('Web Audio is not available in this browser.');
  }

  return new AudioContextCtor();
}

async function decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const audioContext = getAudioContext();

  try {
    return await audioContext.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    if (audioContext.state !== 'closed') {
      await audioContext.close().catch(() => undefined);
    }
  }
}

export async function importSample(file: File): Promise<SampleAsset> {
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await decodeAudioData(arrayBuffer);
  const waveformPeaks = getWaveformPeaks(audioBuffer, 64);

  return {
    id: crypto.randomUUID(),
    name: file.name.replace(/\.[^.]+$/, ''),
    url: URL.createObjectURL(file),
    duration: audioBuffer.duration,
    startTime: 0,
    endTime: audioBuffer.duration,
    sourceFileName: file.name,
    waveformPeaks,
  };
}

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  return decodeAudioData(await file.arrayBuffer());
}

export function getWaveformPeaks(buffer: AudioBuffer, points: number): number[] {
  const channelData = buffer.getChannelData(0);
  const length = channelData.length;
  const maxPoints = Math.max(1, points);
  const step = Math.max(1, Math.floor(length / maxPoints));
  const peaks: number[] = [];

  for (let index = 0; index < maxPoints; index += 1) {
    const start = index * step;
    const end = Math.min(length, start + step);
    let max = 0;

    for (let cursor = start; cursor < end; cursor += 1) {
      const value = Math.abs(channelData[cursor]);
      if (value > max) {
        max = value;
      }
    }

    peaks.push(Number(max.toFixed(4)));
  }

  return peaks;
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
    waveformPeaks: [],
  };
}
