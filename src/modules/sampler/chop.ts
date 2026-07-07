import type { SampleAsset, SampleId } from '../../types/project';

export async function chopSample(_sampleId: SampleId, _parts: 4 | 8 | 16): Promise<SampleAsset[]> {
  return [];
}

export function assignChopsToPads(_samples: SampleAsset[], _startPadIndex = 0): void {}
