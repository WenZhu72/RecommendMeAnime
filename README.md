# RecommendMeAnime

RecommendMeAnime is a full-stack anime discovery application. The Next.js frontend talks only to the FastAPI backend, which queries AniList's GraphQL API and returns a stable REST response.

```text
Browser → Vercel-hosted Next.js → Render-hosted FastAPI → AniList GraphQL API
```

The app has no database or authentication service. The watchlist is stored only in the visitor's browser.

## Local development

Use two terminals from the repository root.

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

For Command Prompt, activate the virtual environment with:

```cmd
.venv\Scripts\activate
```

The API is available at `http://localhost:8000`, its health check is at `http://localhost:8000/health`, and Swagger UI is at `http://localhost:8000/docs`.

### Frontend

```powershell
cd frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

Copy the committed example files; never commit the local files they produce.

| File | Variable | Purpose |
| --- | --- | --- |
| `backend/.env` | `APP_ENV` | `development` locally and `production` on Render. |
| `backend/.env` | `ANILIST_API_URL` | AniList endpoint; defaults to `https://graphql.anilist.co`. |
| `backend/.env` | `EXTERNAL_API_TIMEOUT_SECONDS` | Upstream request timeout; defaults to `10`. |
| `backend/.env` | `CACHE_TTL_SECONDS` | In-memory AniList response cache TTL; defaults to `3600`, or `0` to disable. |
| `backend/.env` | `LOG_LEVEL` | Python log level; defaults to `INFO`. |
| `backend/.env` | `CORS_ALLOWED_ORIGINS` | Required browser origins, comma-separated, for example `http://localhost:3000,https://your-app.vercel.app`. |
| `frontend/.env.local` | `NEXT_PUBLIC_API_BASE_URL` | Public FastAPI base URL, for example `http://localhost:8000` locally. |

`NEXT_PUBLIC_` values are embedded in the browser bundle. Do not put keys, tokens, passwords, or any other secret in them. `FRONTEND_ORIGIN` and `FRONTEND_URL` remain supported as single-origin backend compatibility fallbacks, but new deployments should use `CORS_ALLOWED_ORIGINS`.

The backend normalises trailing slashes and rejects wildcard CORS origins. It permits only `GET` and `POST` API requests, with credential-compatible explicit origins.

## Checks

Run these before deploying:

```powershell
# backend
cd backend
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m compileall app tests

# frontend
cd frontend
npm run lint
npm run typecheck
npm run build
```

GitHub Actions runs the same backend tests plus frontend lint, type-check, and production build on every push and pull request. It uses `npm ci` because `frontend/package-lock.json` is committed.

## Deploy the backend to Render

The repository includes [`render.yaml`](./render.yaml). Create a Render Blueprint from the GitHub repository, or enter these exact dashboard settings:

| Render setting | Value |
| --- | --- |
| Service type | Web Service |
| Runtime | Python |
| Root directory | `backend` |
| Build command | `pip install -r requirements.txt` |
| Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health-check path | `/health` |

Set these Render environment variables (replace the Vercel URL after the frontend is deployed):

```env
APP_ENV=production
ANILIST_API_URL=https://graphql.anilist.co
EXTERNAL_API_TIMEOUT_SECONDS=10
CACHE_TTL_SECONDS=3600
LOG_LEVEL=INFO
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://your-app.vercel.app
```

No port environment variable is needed: Render provides `PORT` and the start command uses it. The `/health` endpoint is intentionally local-only work—it does not query AniList or require authentication.

The cache is process-local. On a multi-instance service, each instance has a separate cache; it is cleared by a redeploy, restart, or Render instance sleep. Cache misses and cache errors never prevent an AniList request.

## Deploy the frontend to Vercel

Import the same GitHub repository in Vercel and use:

| Vercel setting | Value |
| --- | --- |
| Root directory | `frontend` |
| Framework preset | Next.js (auto-detected) |
| Install command | `npm ci` (set in `frontend/vercel.json`) |
| Build command | `npm run build` (default) |

Set this environment variable for Production (and Preview if those deployments should be functional):

```env
NEXT_PUBLIC_API_BASE_URL=https://your-render-service.onrender.com
```

`frontend/vercel.json` intentionally contains only the `npm ci` install override; Vercel's normal Next.js defaults handle the framework and build command. The homepage, browse page, and search page are dynamic so the Vercel build never requires a reachable Render service.

## Reliability, rollback, and operating notes

AniList calls are asynchronous, time-bounded, use GraphQL variables, and validate HTTP, JSON, and GraphQL error responses. The API returns stable errors instead of upstream response bodies: `502` for unusable upstream responses, `503` for an unreachable dependency, and `504` for an upstream timeout. The frontend presents a loading state, clear failures, and one short retry for safe `GET` requests—helpful when a Render instance is waking from sleep.

To roll back, redeploy an earlier Vercel deployment from the Vercel dashboard and redeploy an earlier Render commit from the Render dashboard. For a repository-level rollback, create and push a revert with `git revert <commit>`; the integrations will deploy the reverted commit. Do not rewrite shared Git history to roll back production.

## Security and repository hygiene

`.env`, `.env.local`, virtual environments, Python caches, `node_modules`, `.next`, test coverage, and build artefacts are ignored. The committed example files contain only safe placeholders. The application does not accept user-controlled upstream URLs, does not interpolate user input into GraphQL queries, does not render raw upstream HTML, and does not expose AniList response bodies or stack traces to users.
