# EcoWatch AI — Scoped Prototype

A standalone React + TypeScript frontend for the project's five current technical modules: TACO preprocessing, YOLOv8n detection workflow, MiDaS relative depth, camera calibration, and preliminary volume estimation. This app has its own manifest and lockfile and does not import code from `webapp/`.

## Run locally

Requires Node.js 20.19+ or 22.12+ and npm.

```powershell
cd webapp-scoped
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). No backend, model weights, database, login, or original website is needed.

## Checks

```powershell
npm run check
npm run lint
npm run build
npm run preview
```

## Demo boundaries

Image upload is validated in the browser and its preview remains local. Detection boxes and relative-depth statistics are simulated by `src/services/demoService.ts`; they are not YOLOv8n or MiDaS results. Dataset statistics are labeled illustrative. Calibration is a user-entered scale exercise and does not constitute camera calibration. Metric volume is intentionally unavailable unless verified geometry and calibration are supplied; this prototype does not fabricate a litre estimate.

There are no routes or functional sections for maps/hotspots, severity or density analytics, observation history, city-wide analytics, persistence, authentication, backend APIs, or live inference.
