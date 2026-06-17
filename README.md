# F1 Telemetry Comparisons

Formula 1 telemetry visualization app — FastAPI backend powered by [Fast-F1](https://github.com/theOehrly/Fast-F1) + React/TypeScript frontend.

## Structure

```
backend/    FastAPI + Fast-F1 JSON API
frontend/   React + Recharts visualization app
```

## Run with Docker (recommended)

```bash
docker compose up --build
```

The frontend is served at **http://localhost:80**. The backend API is accessible internally via the nginx proxy at `/api/`.

To expose the backend directly add a port mapping to `docker-compose.yml`:

```yaml
backend:
  ports:
    - "8000:8000"
```

## Local development

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
fast-f1-backend
# API: http://127.0.0.1:8000
# Docs: http://127.0.0.1:8000/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# App: http://localhost:5173
```

The Vite dev server proxies `/api` to `http://127.0.0.1:8000` by default.
Override with `VITE_API_BASE_URL` in `frontend/.env`.

## Environment variables

### Backend

| Variable | Default | Purpose |
|---|---|---|
| `HOST` | `127.0.0.1` | Bind host. Use `0.0.0.0` for Docker. |
| `PORT` | `8000` | Server port. |
| `RELOAD` | `false` | Auto-reload for local development. |
| `LOG_LEVEL` | `info` | Log level. |
| `FASTF1_CACHE_DIR` | `.cache/fastf1` | Fast-F1 data cache directory. |
| `SESSION_CACHE_SIZE` | `16` | In-process session LRU cache size. |

### Frontend

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Backend URL for Vite dev proxy (local dev only). |
| `BACKEND_URL` | Backend URL injected into nginx at container startup. |

## API endpoints

| Endpoint | Description |
|---|---|
| `GET /events/{year}` | Season schedule |
| `GET /sessions/{year}/{event}/{session}/laps` | Lap timing & tyre data |
| `GET /sessions/{year}/{event}/{session}/results` | Session classification |
| `GET /sessions/{year}/{event}/{session}/weather` | Weather samples |
| `GET /sessions/{year}/{event}/{session}/corners` | Circuit corner data |
| `GET /sessions/{year}/{event}/{session}/track_status` | Safety car / flag events |
| `GET /sessions/{year}/{event}/{session}/telemetry/{driver}/{lap}` | Per-lap car telemetry |

Interactive docs: http://localhost:8000/docs
