````markdown
# RecommendMeAnime

> A full-stack anime discovery web application built with **Next.js** and **FastAPI**.

 **Live Demo:** https://recommend-me-anime.vercel.app/

 **API Documentation:** https://recommendmeanime.onrender.com/docs

---

## About

RecommendMeAnime is a full-stack web application that helps users discover new anime through search and browsing.

I built this project to gain experience developing a modern full-stack application using a separate frontend and backend. Rather than allowing the frontend to communicate directly with AniList, every request passes through a FastAPI backend, which is responsible for communicating with AniList's GraphQL API, validating responses, handling errors, and caching results.

The project also gave me experience deploying a real application using **Vercel**, **Render**, and **GitHub Actions**, while following common software engineering practices such as environment configuration, REST APIs, continuous integration, and clean project structure.

---

## Features

-  Search for anime using the AniList API
-  Browse popular and trending anime
-  Save a personal watchlist in your browser
-  FastAPI REST backend
-  Responsive Next.js frontend
-  Interactive Swagger API documentation
-  Automated deployment with GitHub Actions
-  In-memory caching to reduce repeated API requests
-  Graceful error handling when upstream services are unavailable

---

## Tech Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend

- FastAPI
- Python
- Pydantic
- Uvicorn

### Infrastructure

- Vercel
- Render
- GitHub Actions

### External API

- AniList GraphQL API

---

## Architecture

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

The frontend never communicates directly with AniList. Instead, every request is sent to the FastAPI backend, which provides a stable REST API, validates responses, caches frequently requested data, and returns consistent error messages if the upstream API is unavailable.

---

## Running the Project Locally

Clone the repository and start the backend and frontend in separate terminals.

### Backend

```powershell
cd backend

python -m venv .venv

.\.venv\Scripts\Activate.ps1

pip install -r requirements-dev.txt

Copy-Item .env.example .env

uvicorn app.main:app --reload
```

The backend will be available at:

```
http://localhost:8000
```

Swagger documentation:

```
http://localhost:8000/docs
```

---

### Frontend

```powershell
cd frontend

npm install

Copy-Item .env.example .env.local

npm run dev
```

The frontend will be available at:

```
http://localhost:3000
```

---

## Environment Variables

Example configuration files are included in the repository.

### Backend

| Variable | Description |
|----------|-------------|
| `APP_ENV` | Application environment |
| `ANILIST_API_URL` | AniList GraphQL endpoint |
| `EXTERNAL_API_TIMEOUT_SECONDS` | Timeout for upstream requests |
| `CACHE_TTL_SECONDS` | Cache lifetime in seconds |
| `LOG_LEVEL` | Logging level |
| `CORS_ALLOWED_ORIGINS` | Allowed frontend origins |

### Frontend

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | URL of the deployed FastAPI backend |

No secrets or API keys are committed to the repository.

---

## Quality Checks

Before deployment, the following checks can be run locally.

### Backend

```powershell
cd backend

pytest

python -m compileall app tests
```

### Frontend

```powershell
cd frontend

npm run lint

npm run typecheck

npm run build
```

GitHub Actions automatically runs these checks whenever code is pushed or a pull request is opened.

---

## Deployment

The application is deployed using **Render** for the backend and **Vercel** for the frontend.

The FastAPI backend exposes a REST API that the frontend communicates with using the `NEXT_PUBLIC_API_BASE_URL` environment variable.

Because the frontend and backend are deployed independently, new versions can be released without affecting the other service. GitHub Actions automatically verifies the project before deployment by running the backend tests together with the frontend linting, type checking, and production build.

---

## Security

A few practices followed throughout the project include:

- Environment variables are used for configuration.
- No secrets are committed to the repository.
- User input is never directly interpolated into GraphQL queries.
- Upstream API errors are sanitised before being returned to users.
- Only explicitly configured CORS origins are allowed.
- Temporary build files and virtual environments are excluded from version control.

---

## Future Improvements

There are several features I'd like to add in future versions of the project:

- User authentication
- PostgreSQL database
- Cloud-synchronised watchlists
- Personalised recommendations
- Recommendation history
- User ratings and reviews
- Docker support
- More advanced filtering options

---

## License

This project was created for educational and portfolio purposes.
````
