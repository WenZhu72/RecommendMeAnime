from app.clients.anilist import AniListClient
from app.schemas.anime import AnimeListResponse, PageInfo
from app.schemas.recommendations import RecommendationPreferences
from app.services.anime_service import SORTS, get_anime_list

TONE_GENRES = {
    "light-hearted": {"Comedy", "Slice of Life"},
    "dark": {"Psychological", "Thriller", "Horror"},
    "emotional": {"Drama", "Romance"},
    "action-focused": {"Action", "Adventure"},
}


def _matches_length(episodes: int | None, preference: str) -> bool:
    if preference == "any" or episodes is None:
        return True
    if preference == "short":
        return episodes <= 13
    if preference == "medium":
        return 13 < episodes <= 39
    return episodes > 39


async def get_recommendations(
    client: AniListClient,
    preferences: RecommendationPreferences,
) -> AnimeListResponse:
    """Temporary filtering boundary: replace this function with the final algorithm."""
    period_filters: dict[str, tuple[int | None, int | None]] = {
        "recent": (2021, None), "modern": (2010, 2020), "classic": (None, 2009), "any": (None, None),
    }
    lower_year, upper_year = period_filters[preferences.release_period]
    # AniList only accepts one exact season year in this query. Broad periods are
    # filtered below after fetching candidates ordered by a safe server-side sort.
    candidates = await get_anime_list(
        client, page=1, per_page=50, genre_in=preferences.favorite_genres,
        format_in=list(preferences.formats), minimum_score=max(0, preferences.minimum_score - 1),
        sort=SORTS["popular"] if preferences.popularity == "popular" else SORTS["top-rated"],
    )
    tone_genres = set().union(*(TONE_GENRES.get(tone, set()) for tone in preferences.tones))
    items = [
        anime for anime in candidates.items
        if not any(genre in preferences.avoided_genres for genre in anime.genres)
        and _matches_length(anime.episodes, preferences.preferred_length)
        and (lower_year is None or (anime.season_year is not None and anime.season_year >= lower_year))
        and (upper_year is None or (anime.season_year is not None and anime.season_year <= upper_year))
    ]
    items.sort(key=lambda anime: sum(genre in tone_genres for genre in anime.genres), reverse=True)
    final_items = items[:18]
    return AnimeListResponse(
        items=final_items,
        page_info=PageInfo(current_page=1, has_next_page=False, last_page=1, per_page=len(final_items), total=len(final_items)),
    )
