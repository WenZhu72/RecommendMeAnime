from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from app.api.dependencies import get_anilist_client
from app.clients.anilist import AniListClient
from app.core.exceptions import AnimeNotFoundError
from app.schemas.anime import Anime, AnimeListResponse
from app.services.anime_service import SORTS, get_anime_by_id, get_anime_list

router = APIRouter(prefix="/api/anime", tags=["Anime"])

Page = Annotated[int, Query(ge=1, description="One-indexed page number.")]
PerPage = Annotated[int, Query(ge=1, le=50, description="Number of titles to return (maximum 50).")]
Client = Annotated[AniListClient, Depends(get_anilist_client)]
AnimeFormat = Literal["TV", "MOVIE", "OVA", "ONA", "SPECIAL"]
AnimeSeason = Literal["WINTER", "SPRING", "SUMMER", "FALL"]
BrowseSort = Literal["trending", "popular", "top-rated"]


def _required_query(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Search query cannot be blank.")
    return cleaned


@router.get("/search", response_model=AnimeListResponse, summary="Search anime by title")
async def search_anime(
    client: Client,
    q: Annotated[str, Query(min_length=1, description="Anime title to search for.")],
    page: Page = 1,
    per_page: PerPage = 20,
) -> AnimeListResponse:
    return await get_anime_list(client, page=page, per_page=per_page, search=_required_query(q), sort=SORTS["search"])


@router.get("/trending", response_model=AnimeListResponse, summary="Get currently trending anime")
async def trending_anime(client: Client, page: Page = 1, per_page: PerPage = 20) -> AnimeListResponse:
    return await get_anime_list(client, page=page, per_page=per_page, sort=SORTS["trending"])


@router.get("/popular", response_model=AnimeListResponse, summary="Get anime ordered by popularity")
async def popular_anime(client: Client, page: Page = 1, per_page: PerPage = 20) -> AnimeListResponse:
    return await get_anime_list(client, page=page, per_page=per_page, sort=SORTS["popular"])


@router.get("/top-rated", response_model=AnimeListResponse, summary="Get highly rated anime")
async def top_rated_anime(client: Client, page: Page = 1, per_page: PerPage = 20) -> AnimeListResponse:
    return await get_anime_list(client, page=page, per_page=per_page, sort=SORTS["top-rated"])


@router.get("/genre/{genre}", response_model=AnimeListResponse, summary="Get anime in a genre")
async def anime_by_genre(
    client: Client,
    genre: Annotated[str, Path(min_length=1, max_length=64)],
    page: Page = 1,
    per_page: PerPage = 20,
) -> AnimeListResponse:
    cleaned_genre = genre.strip()
    if not cleaned_genre:
        raise HTTPException(status_code=400, detail="Genre cannot be blank.")
    return await get_anime_list(client, page=page, per_page=per_page, genre=cleaned_genre, sort=SORTS["popular"])


@router.get("/browse", response_model=AnimeListResponse, summary="Browse anime with optional filters")
async def browse_anime(
    client: Client,
    page: Page = 1,
    per_page: PerPage = 20,
    search: Annotated[str | None, Query(max_length=100, description="Optional title search.")] = None,
    genres: Annotated[list[str] | None, Query(alias="genre")] = None,
    anime_format: Annotated[AnimeFormat | None, Query(alias="format")] = None,
    season: AnimeSeason | None = None,
    season_year: Annotated[int | None, Query(ge=1940, le=2100)] = None,
    minimum_score: Annotated[int | None, Query(ge=0, le=100)] = None,
    sort: BrowseSort = "popular",
) -> AnimeListResponse:
    cleaned_search = _required_query(search) if search is not None else None
    cleaned_genres = [genre.strip() for genre in (genres or [])]
    if any(not genre or len(genre) > 64 for genre in cleaned_genres):
        raise HTTPException(status_code=400, detail="Genres must contain between 1 and 64 characters.")
    if len(cleaned_genres) > 10:
        raise HTTPException(status_code=400, detail="A maximum of 10 genres can be selected.")
    return await get_anime_list(
        client, page=page, per_page=per_page, search=cleaned_search, genre_in=cleaned_genres or None,
        anime_format=anime_format, season=season, season_year=season_year,
        minimum_score=minimum_score, sort=SORTS[sort],
    )


@router.get("/{anime_id}", response_model=Anime, summary="Get detailed anime information")
async def anime_details(
    client: Client,
    anime_id: Annotated[int, Path(gt=0)],
) -> Anime:
    try:
        return await get_anime_by_id(client, anime_id)
    except AnimeNotFoundError:
        raise HTTPException(status_code=404, detail="Anime not found.") from None
