from fastapi import APIRouter, HTTPException

from app.services.anilist_service import search_anilist_media

router = APIRouter()


@router.get("/search")
def search_media(query: str, media_type: str = "ANIME"):
    media_type = media_type.upper()

    if media_type not in ["ANIME", "MANGA"]:
        raise HTTPException(
            status_code=400,
            detail="media_type must be ANIME or MANGA"
        )

    try:
        return search_anilist_media(query, media_type)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )