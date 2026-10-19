import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import { DemoProvider } from './state/DemoContext';
import OverviewPage from './pages/OverviewPage';
import DatasetPage from './pages/DatasetPage';
import DetectionPage from './pages/DetectionPage';
import DepthPage from './pages/DepthPage';
import CalibrationPage from './pages/CalibrationPage';
import VolumePage from './pages/VolumePage';

export default function App() {
  return (
    <DemoProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<OverviewPage />} />
            <Route path="dataset" element={<DatasetPage />} />
            <Route path="detection" element={<DetectionPage />} />
            <Route path="depth" element={<DepthPage />} />
            <Route path="calibration" element={<CalibrationPage />} />
            <Route path="volume" element={<VolumePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DemoProvider>
  );
}
