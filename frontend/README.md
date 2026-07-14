# RecommendMeAnime frontend

The Next.js application for browsing anime, saving a local watchlist, and submitting a temporary recommendation questionnaire. It never communicates with AniList from the browser or Next.js server components; all anime data comes from the FastAPI API.

## Setup

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Set the API base URL in `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Start the backend before loading data pages. See the [root deployment guide](../README.md) for setup, environment variables, and Swagger documentation.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run start
```

## Data flow

```text
User searches for an anime
→ Next.js calls FastAPI
→ FastAPI queries AniList
→ FastAPI normalises the response
→ Next.js renders the results
```

The typed REST client is in `src/lib/api/`. It uses `NEXT_PUBLIC_API_BASE_URL` for both server-rendered pages and browser-side recommendation requests.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page with trending and popular anime |
| `/browse` | Trending, popular, top-rated, and filtered browsing |
| `/search?q=naruto` | URL-driven FastAPI title search |
| `/anime/[id]` | Detailed anime information and related anime |
| `/recommend` | Preference questionnaire |
| `/recommend/results` | FastAPI-backed temporary recommendations |
| `/watchlist` | Browser-local saved anime |
| `/about` | Project explanation |

The watchlist intentionally uses browser local storage only. It has no account or database support yet.
