import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppShell from './components/AppShell';
import OverviewPage from './pages/OverviewPage';
import ImageAnalysisPage from './pages/ImageAnalysisPage';
import HotspotMapPage from './pages/HotspotMapPage';
import AnalyticsPage from './pages/AnalyticsPage';
import HistoryPage from './pages/HistoryPage';
import AboutPage from './pages/AboutPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="analysis" element={<ImageAnalysisPage />} />
          <Route path="map" element={<HotspotMapPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="about" element={<AboutPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
