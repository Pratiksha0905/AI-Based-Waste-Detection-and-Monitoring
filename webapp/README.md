# EcoWatch AI — webapp

**Smart City Waste Intelligence** — Frontend prototype for the AI-Based Waste Detection and Monitoring project.

> **DEMO MODE:** All data displayed is simulated. The real YOLOv8n detection model and MiDaS depth estimation model are not yet connected.

---

## Quick Start

```bash
# From the webapp/ directory:
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Available Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the development server (hot reload) |
| `npm run build` | Build production bundle into `dist/` |
| `npm run preview` | Preview production build locally |
| `npx tsc --noEmit` | TypeScript type check (no output) |
| `npm run lint` | Run ESLint |

---

## Project Structure

```
webapp/
  public/
    favicon.svg
  src/
    components/           Shared UI components
      AppShell.tsx        Main layout: sidebar + header + outlet
      Header.tsx          Top bar with page title and DEMO MODE badge
      Sidebar.tsx         Navigation sidebar (desktop + mobile drawer)
      SeverityBadge.tsx   Reusable severity indicator
    data/
      mockObservations.ts 15 demo observations, 6 hotspots, time-series data
    pages/
      OverviewPage.tsx    City dashboard: metrics, charts, recent activity
      ImageAnalysisPage.tsx  Image upload + demo AI analysis workflow
      HotspotMapPage.tsx  Interactive Leaflet map with severity markers
      AnalyticsPage.tsx   Recharts analytics with line, bar, and pie charts
      HistoryPage.tsx     Searchable, sortable table with detail panel
      AboutPage.tsx       Tech stack + future integration documentation
    services/
      analysisService.ts  Mock data service — future API integration boundary
    types/
      observation.ts      Core TypeScript types (integration contract)
    utils/
      display.ts          Severity colors, formatting, accessibility helpers
    App.tsx               React Router configuration
    main.tsx              React 19 entry point
    index.css             Tailwind CSS v4 design system
  index.html
  vite.config.ts
  tsconfig.json
  package.json
```

---

## Pages

| Page | Route | Description |
|---|---|---|
| Overview | `/` | Dashboard with metrics, category and severity charts, recent observations |
| Image Analysis | `/analysis` | Drag-and-drop upload with demo detection, depth, calibration, volume |
| Hotspot Map | `/map` | Interactive Leaflet map with severity-based markers and filters |
| Analytics | `/analytics` | Time-series charts for observations and simulated volume |
| Observation History | `/history` | Searchable, sortable table with detail side panel |
| About | `/about` | Integration documentation and setup guide |

---

## Future AI Integration

The integration boundary is `src/services/analysisService.ts`. Each function returns mock data now. Replace the function bodies with real API calls when the backend is available:

| Mock Function | Future API Endpoint |
|---|---|
| `analyzeImage(file)` | `POST /api/analyze` (multipart/form-data) |
| `getObservations(filters)` | `GET /api/observations` |
| `getObservationById(id)` | `GET /api/observations/:id` |
| `getDashboardSummary()` | `GET /api/dashboard/summary` |
| `getHotspots(filters)` | `GET /api/hotspots` |
| `getAnalytics(filters)` | `GET /api/analytics` |

The real AI pipeline should return objects conforming to the TypeScript interfaces in `src/types/observation.ts`:

- `Detection` — category, confidence, bounding box, relative depth
- `DepthResult` — min/max/mean relative depth from MiDaS
- `CalibrationInfo` — calibration status and reference availability
- `VolumeEstimate` — estimated volume and method details

### Planned AI Pipeline

- **YOLOv8n** — Waste detection and classification
- **MiDaS** — Monocular depth estimation
- **Calibration** — Camera scale estimation
- **Volume** — Geometric estimation from depth and detection

---

## Requirements

- Node.js 18 or later
- No GPU, Python, model weights, or external API required
- Internet connection needed only for OpenStreetMap tiles on the Hotspot Map page

---

## Repository Isolation

This `webapp/` directory is entirely self-contained. No files outside this directory were modified during its creation.
