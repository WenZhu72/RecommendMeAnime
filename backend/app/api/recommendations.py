from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.dependencies import get_anilist_client
from app.clients.anilist import AniListClient
from app.schemas.anime import AnimeListResponse
from app.schemas.recommendations import RecommendationPreferences
from app.services.recommendation_service import get_recommendations

router = APIRouter(prefix="/api/recommendations", tags=["Recommendations"])
Client = Annotated[AniListClient, Depends(get_anilist_client)]


@router.post("", response_model=AnimeListResponse, summary="Get temporary anime recommendations")
async def recommendations(
    preferences: RecommendationPreferences,
    client: Client,
) -> AnimeListResponse:
    return await get_recommendations(client, preferences)
