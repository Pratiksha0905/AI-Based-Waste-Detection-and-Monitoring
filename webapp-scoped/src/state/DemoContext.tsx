import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DemoDepthStats, DemoDetection } from '../types/project';
import { runDepthDemo, runDetectionDemo } from '../services/demoService';

interface DemoContextValue {
  file: File | null;
  previewUrl: string | null;
  detections: DemoDetection[] | null;
  depthStats: DemoDepthStats | null;
  busy: 'detection' | 'depth' | null;
  error: string | null;
  selectFile: (file: File) => void;
  clearFile: () => void;
  detect: () => Promise<void>;
  estimateDepth: () => Promise<void>;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [detections, setDetections] = useState<DemoDetection[] | null>(null);
  const [depthStats, setDepthStats] = useState<DemoDepthStats | null>(null);
  const [busy, setBusy] = useState<'detection' | 'depth' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const selectFile = (nextFile: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(nextFile.type)) {
      setError('Choose a JPEG, PNG or WebP image.');
      return;
    }
    if (nextFile.size > 20 * 1024 * 1024) {
      setError('This image exceeds the 20 MB demo limit.');
      return;
    }
    setError(null);
    setDetections(null);
    setDepthStats(null);
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
  };

  const clearFile = () => {
    setFile(null);
    setPreviewUrl(null);
    setDetections(null);
    setDepthStats(null);
    setError(null);
  };

  const detect = async () => {
    if (!file) return;
    setBusy('detection');
    setError(null);
    try {
      setDetections(await runDetectionDemo(file));
    } catch {
      setError('The local demonstration could not complete. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const estimateDepth = async () => {
    if (!file) return;
    setBusy('depth');
    setError(null);
    try {
      setDepthStats(await runDepthDemo(file));
    } catch {
      setError('The local demonstration could not complete. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const value = useMemo(() => ({ file, previewUrl, detections, depthStats, busy, error, selectFile, clearFile, detect, estimateDepth }), [file, previewUrl, detections, depthStats, busy, error]);
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error('useDemo must be used inside DemoProvider');
  return value;
}
