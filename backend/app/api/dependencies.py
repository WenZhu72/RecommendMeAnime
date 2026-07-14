from fastapi import Request

from app.clients.anilist import AniListClient


def get_anilist_client(request: Request) -> AniListClient:
    return request.app.state.anilist_client
