export type ModuleKey = 'dataset' | 'detection' | 'depth' | 'calibration' | 'volume';

export interface DemoDetection {
  id: string;
  category: string;
  confidence: number;
  box: [number, number, number, number];
  color: string;
}

export interface CalibrationInputs {
  referenceLength: number | null;
  referencePixels: number | null;
  camera: string;
}

export interface DemoDepthStats {
  near: number;
  mean: number;
  far: number;
}
