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
- Uvicorn

## Infrastructure

- Vercel
- Render
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

The frontend never communicates directly with AniList. Every request is sent to the FastAPI backend, which handles communication with the external API, validates responses, caches frequently requested data, and provides a consistent REST interface for the frontend.

---

# Running Locally

Clone the repository and run both the frontend and backend in separate terminals.

## Backend

```powershell
cd backend

python -m venv .venv

.\.venv\Scripts\Activate.ps1

pip install -r requirements-dev.txt

Copy-Item .env.example .env

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
| `APP_ENV` | Application environment |
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
| `LOG_LEVEL` | Logging level |
| `CORS_ALLOWED_ORIGINS` | Allowed frontend origins |

## Frontend

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | URL of the FastAPI backend |

No secrets or API keys are stored in the repository.

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
- PostgreSQL database
- Cloud-synchronised watchlists
- Personalised recommendations
- Recommendation history
- User ratings and reviews
- Docker support
- Advanced filtering and sorting
- Recommendation explanations using AI

---

# License

This project was created for educational and portfolio purposes.
