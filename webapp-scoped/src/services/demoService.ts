import type { DemoDepthStats, DemoDetection } from '../types/project';

const wait = (duration: number) => new Promise((resolve) => window.setTimeout(resolve, duration));

export async function runDetectionDemo(_file: File): Promise<DemoDetection[]> {
  await wait(900);
  return [
    { id: 'demo-1', category: 'Bottle-like object', confidence: 0.87, box: [0.12, 0.19, 0.45, 0.62], color: '#e87652' },
    { id: 'demo-2', category: 'Packaging-like object', confidence: 0.72, box: [0.53, 0.31, 0.86, 0.76], color: '#4b8e77' },
  ];
}

export async function runDepthDemo(_file: File): Promise<DemoDepthStats> {
  await wait(900);
  return { near: 0.18, mean: 0.51, far: 0.84 };
}
