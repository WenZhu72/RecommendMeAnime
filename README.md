# RecommendMeAnime

> A full-stack anime discovery platform built with **Next.js** and **FastAPI**.

 **Live Demo:** https://recommend-me-anime.vercel.app/

 **API Documentation:** https://recommendmeanime.onrender.com/docs

> **Note:** The backend is hosted on Render's free tier, so the first request may take a few seconds if the service is waking up.

---

# About

RecommendMeAnime is a personal portfolio project that helps users discover new anime through search and browsing.

I built the project to learn how to design, develop, and deploy a modern full-stack application using a separate frontend and backend. Rather than exposing the AniList API directly to the client, the frontend communicates with a FastAPI backend, which handles requests to AniList's GraphQL API, validates responses, manages caching, and returns consistent error messages.

Along the way, I gained experience with REST APIs, GraphQL, deployment, CI/CD, environment management, and building a clean project structure that is easy to extend.

---

# Features

-  Search for anime using the AniList API
-  Browse, search, filter, sort, and paginate the AniList catalogue
-  Save a personal watchlist in your browser
-  FastAPI REST API
-  Responsive Next.js interface
-  Interactive Swagger documentation
-  Automatic CI/CD with GitHub Actions
-  In-memory response caching
-  Friendly error handling when external services are unavailable

---

# Tech Stack

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

## Backend

- FastAPI
- Python
- Pydantic
- SQLAlchemy
- Alembic
- Psycopg 3
- Uvicorn

## Infrastructure

- Vercel
- Render
- Neon PostgreSQL
- Docker PostgreSQL for local development
- GitHub Actions

## External Services

- AniList GraphQL API

---

# Architecture

```
Browser
      │
      ▼
Next.js Frontend (Vercel)
      │
      ▼
FastAPI Backend (Render)
      │
      ▼
AniList GraphQL API
```

The frontend never communicates directly with AniList or PostgreSQL. Every
request is sent to the FastAPI backend, which validates responses, caches
frequently requested data, and provides a consistent REST interface. Production
pagination metadata is persisted in Neon; local development uses an isolated
Docker PostgreSQL database.

```text
Vercel Next.js -> Render FastAPI -> AniList GraphQL
                               -> Neon PostgreSQL
```

---

# Running Locally

Clone the repository and run both the frontend and backend in separate terminals.

## Backend

Create the local PostgreSQL container once:

```powershell
docker run --name recommend-me-anime-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=development `
  -e POSTGRES_DB=recommend_me_anime `
  -p 5432:5432 `
  -v recommend-me-anime-postgres-data:/var/lib/postgresql/data `
  -d postgres:17
```

The named `recommend-me-anime-postgres-data` volume preserves data when the
container stops, restarts, or is removed.

Then configure and start the backend:

```powershell
cd backend

python -m venv .venv

.\.venv\Scripts\Activate.ps1

pip install -r requirements-dev.txt

Copy-Item .env.example .env

alembic upgrade head

uvicorn app.main:app --reload
```

The API will be available at:

```
http://localhost:8000
```

Swagger documentation:

```
http://localhost:8000/docs
```

## Frontend

```powershell
cd frontend

npm install

Copy-Item .env.example .env.local

npm run dev
```

Open:

```
http://localhost:3000
```

---

# Environment Variables

Example configuration files are included for both the frontend and backend.

## Backend

| Variable | Description |
|----------|-------------|
| `ENVIRONMENT` | `development`, `test`, or `production` |
| `DATABASE_URL` | PostgreSQL URL; local Docker in development and Neon with SSL in production |
| `ANILIST_API_URL` | AniList GraphQL endpoint |
| `EXTERNAL_API_TIMEOUT_SECONDS` | Timeout for requests to AniList |
| `CACHE_TTL_SECONDS` | Cache duration |
| `EXACT_PAGINATION_CACHE_TTL_SECONDS` | Exact Browse metadata cache duration (default: 3600 seconds) |
| `ANILIST_EXACT_PROBE_RESPONSE_WAIT_SECONDS` | Maximum request-time wait for optional exact metadata (default: 3 seconds) |
| `ANILIST_EXACT_PROBE_MAX_PAGE` | Safe ceiling for 50-item exact-pagination probes (default: 100) |
| `ANILIST_STALE_IF_ERROR_SECONDS` | Extra window for cached AniList responses during temporary failures |
| `ANILIST_MAX_CONCURRENCY` | Process-local limit for concurrent AniList requests (default: 4) |
| `ANILIST_MAX_RETRIES` | Bounded retries after AniList HTTP 429 responses (default: 1) |
| `ANILIST_RETRY_FALLBACK_SECONDS` | Delay used when a 429 has no valid `Retry-After` header |
| `ANILIST_MAX_RETRY_DELAY_SECONDS` | Maximum delay used for one 429 retry |
| `PAGINATION_FRESH_HOURS` | Age at which exact metadata refreshes in the background |
| `PAGINATION_VERY_STALE_DAYS` | Age at which metadata is considered very stale |
| `PAGINATION_PROBE_TIMEOUT_SECONDS` | Persistent probe lease and timeout |
| `PAGINATION_MAX_CONCURRENT_PROBES` | Process-local limit for metadata probes |
| `PAGINATION_RETRY_BACKOFF_SECONDS` | Comma-separated retry delays after probe failures |
| `LOG_LEVEL` | Logging level |
| `CORS_ALLOWED_ORIGINS` | Allowed frontend origins |

## Frontend

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | URL of the FastAPI backend |

No secrets or API keys are stored in the repository.

The backend validates environment separation at startup:

- `development` and `test` accept only local Docker hosts such as `localhost`
  or `postgres`.
- `production` accepts only a Neon host ending in `.neon.tech` and requires
  `sslmode=require` or `sslmode=verify-full`.
- `DATABASE_URL` is mandatory. `postgresql://` and `postgres://` URLs are
  normalised to the Psycopg 3 SQLAlchemy driver without changing SSL query
  parameters.

## Local PostgreSQL lifecycle

```powershell
# Start a stopped container
docker start recommend-me-anime-postgres

# Stop it without losing data
docker stop recommend-me-anime-postgres

# Restart it
docker restart recommend-me-anime-postgres

# Remove only the container; the named volume and its data remain
docker stop recommend-me-anime-postgres
docker rm recommend-me-anime-postgres
```

Re-run the earlier `docker run` command with the same volume name to attach the
preserved data to a new container.

Resetting the development database is intentionally destructive:

```powershell
docker rm -f recommend-me-anime-postgres
docker volume rm recommend-me-anime-postgres-data
```

After a reset, run the `docker run` command again followed by:

```powershell
cd backend
alembic upgrade head
```

For PostgreSQL integration tests, create a separate test database and opt in:

```powershell
docker exec recommend-me-anime-postgres createdb -U postgres recommend_me_anime_test
$env:TEST_DATABASE_URL = "postgresql+psycopg://postgres:development@localhost:5432/recommend_me_anime_test"
pytest
```

Tests never use Neon. PostgreSQL integration tests are skipped when
`TEST_DATABASE_URL` is absent; service-level tests still run against an injected
in-memory test double.

## Alembic migrations

Alembic reads the same validated `DATABASE_URL` as FastAPI:

```powershell
cd backend
alembic current
alembic upgrade head
```

Create future revisions from the SQLAlchemy models with:

```powershell
alembic revision --autogenerate -m "describe the schema change"
```

Migrations must complete before FastAPI starts. The Render start command enforces
this with `alembic upgrade head && uvicorn ...`.

---

# Development Checks

Before deploying, run the following checks.

## Backend

```powershell
cd backend

pytest

python -m compileall app tests
```

## Frontend

```powershell
cd frontend

npm run lint

npm run typecheck

npm run build
```

These same checks are run automatically by GitHub Actions whenever code is pushed or a pull request is opened.

---

# Frontend Customization

The frontend design system, component ownership, responsive rules, animation controls, and end-to-end data flow are documented in [`frontend/CUSTOMIZATION.md`](frontend/CUSTOMIZATION.md).

---

# Deployment

The frontend is hosted on **Vercel**, while the FastAPI backend is deployed on **Render**.

The frontend communicates with the deployed backend using the `NEXT_PUBLIC_API_BASE_URL` environment variable. GitHub Actions automatically validates the project by running tests, linting, type checking, and production builds before deployment.

Browse pagination counts are derived from AniList terminal-page evidence and stored
in PostgreSQL; no anime catalogue records are stored there.
Trending, Popular, and Highest Rated share one membership-only metadata record
for identical filters, while their ordered anime pages remain separate cache
entries.
Transformed Browse pages use a separate bounded in-memory cache and may expire
without affecting the persistent count metadata.

## Neon and Render production setup

1. Create a Neon project and database.
2. Copy the Neon connection string, keeping its SSL parameters. Do not add it to
   any committed file.
3. In Render, set `ENVIRONMENT=production`.
4. In Render, set secret `DATABASE_URL` to the Neon connection string.
5. Deploy. The existing `render.yaml` installs dependencies, runs
   `alembic upgrade head`, and only then starts FastAPI.

Render no longer needs a persistent disk for pagination metadata. The
application fails before startup if production points at a local/Docker host or
if development points at Neon.

## Optional SQLite metadata import

The application works without an import: missing metadata regenerates in the
background. To preserve an existing local SQLite cache, migrate PostgreSQL first
and then run the one-time script manually:

```powershell
cd backend
alembic upgrade head
python -m scripts.import_pagination_metadata --sqlite-path data/pagination_metadata.db
```

The script opens SQLite read-only, consolidates compatible legacy sort-specific
keys, preserves counters and timestamps, and uses PostgreSQL `ON CONFLICT`.
It is safe to rerun and never runs during application startup. Keep a backup of
the SQLite file until the imported rows have been checked.

---

# Security

Although this is a portfolio project, I followed a number of good development practices throughout the application.

- Environment variables are used for configuration.
- Sensitive information is never committed to the repository.
- User input is safely passed to AniList using GraphQL variables.
- Upstream errors are sanitised before being returned to the client.
- CORS is explicitly configured rather than allowing unrestricted access.
- Build artefacts, virtual environments, and temporary files are excluded from version control.

---

# Future Improvements

Some features I'd like to add in future versions include:

- User authentication
- Cloud-synchronised watchlists
- Personalised recommendations
- Recommendation history
- User ratings and reviews
- Advanced filtering and sorting
- Recommendation explanations using AI

---

# License

This project was created for educational and portfolio purposes.
