from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests

app = FastAPI(title="RecommendMeAnime API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ANILIST_URL = "https://graphql.anilist.co"


@app.get("/")
def root():
    return {"message": "RecommendMeAnime backend is running"}


@app.get("/search")
def search_media(query: str, media_type: str = "ANIME"):
    media_type = media_type.upper()

    if media_type not in ["ANIME", "MANGA"]:
        raise HTTPException(status_code=400, detail="media_type must be ANIME or MANGA")

    graphql_query = """
    query ($search: String, $type: MediaType) {
      Page(page: 1, perPage: 10) {
        media(search: $search, type: $type) {
          id
          title {
            romaji
            english
          }
          description(asHtml: false)
          averageScore
          genres
          episodes
          chapters
          coverImage {
            large
          }
        }
      }
    }
    """

    variables = {
        "search": query,
        "type": media_type
    }

    response = requests.post(
        ANILIST_URL,
        json={"query": graphql_query, "variables": variables}
    )

    if response.status_code != 200:
        raise HTTPException(status_code=500, detail="Failed to fetch data from AniList")

    return response.json()