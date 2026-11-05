# EcoWatch AI frontend

The React application connects to the FastAPI backend in `../backend`. It uses real account, report, hotspot, and admin analytics data; it does not include mock reports or AI results.

## Run locally

Use Node.js 20.19+ or 22.12+.

```powershell
# Terminal 1
cd backend
python -m uvicorn app.main:app --reload

# Terminal 2
cd webapp
npm install
npm run dev
```

The frontend defaults to `http://localhost:8000` for the API, matching the backend development server. For local development, set `VITE_API_URL` in `webapp/.env` if needed. For deployment, set `VITE_API_URL` in the frontend hosting provider's build environment; Vite embeds it in the generated bundle at build time.

## Deployment configuration

The backend reads settings from environment variables directly, so a `.env` file is not needed in a deployed service. Add these variables in the backend hosting provider's environment settings:

| Variable | Production value |
|---|---|
| `DATABASE_URL` | PostgreSQL URL using `postgresql+asyncpg://...`; use a managed database or other persistent database |
| `SECRET_KEY` | A strong, unique random value; generate one with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `CORS_ORIGINS` | Comma-separated URLs of the deployed frontend, with no trailing slash |
| `ENVIRONMENT` | `production` |
| `MODEL_PATH` | Optional path to a deployed YOLO checkpoint; leave unset if inference is not configured |

`ACCESS_TOKEN_EXPIRE_MINUTES`, `MAX_UPLOAD_SIZE_MB`, and the `HOTSPOT_*` settings are optional and have defaults. Do not use the example secret or SQLite database for a production deployment. Ensure the provider gives the API access to the configured model file if `MODEL_PATH` is set.

Build the frontend with its `VITE_API_URL` set to the deployed API's base URL (for example, `https://api.example.com`). Before starting a non-SQLite backend for the first time or after an update, run `alembic upgrade head` from `backend/`. Start the API with `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000` (adjust the port to the value supplied by the hosting provider).

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and create the production bundle |
| `npm run lint` | Run Oxlint |
| `npm run preview` | Preview the production bundle |

## Roles and routes

- Users can submit reports with an image and a map-selected location, see their reports, open report details, view actual detections when available, and retry failed analysis.
- Admins can view system statistics, list and filter all reports, update review status, see real hotspot clusters, and view analytics available from the API.
- Admin-only pages are protected in the frontend and by backend authorization.

## Backend integration

The centralized API wrappers are in `src/api/endpoints.ts`; authenticated requests are handled by `src/api/client.ts`.
Uploaded report images are stored as database BLOBs by the backend, alongside their report metadata. SQLite startup upgrades existing report tables and imports any available legacy images from `LEGACY_UPLOAD_DIR` (default: `uploads`) once; new submissions never create or write to that directory. For non-SQLite deployments, run `alembic upgrade head` from `backend/` before starting the updated API.

| Feature | Backend endpoint |
|---|---|
| Register, login, current profile | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Submit report | `POST /api/reports` (`multipart/form-data`: `image`, `latitude`, `longitude`, optional `description`) |
| User reports / admin reports | `GET /api/reports/my`, `GET /api/reports` |
| Report details, image, retry, review update | `GET /api/reports/{id}`, `GET /api/reports/{id}/image`, `POST /api/reports/{id}/retry`, `PATCH /api/reports/{id}/status` |
| Hotspots | `GET /api/hotspots` |
| Admin dashboard and trends | `GET /api/dashboard/stats`, `GET /api/dashboard/trends` |
| Health and model status | `GET /api/health`, `GET /api/health/model` |

## AI and measurement limitations

The backend returns genuine YOLO detections only when its checkpoint is configured. Without a checkpoint, reports remain pending or fail with the backend's processing status and explanation; the frontend never invents detections or confidence values. The current report API does not expose MiDaS depth, camera calibration, or volume estimates, so those measurements are not presented as available features.

The hotspot map and chart tiles use OpenStreetMap. Report counts, locations, categories, and chart values come from backend responses.
