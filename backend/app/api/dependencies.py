from typing import Annotated

from fastapi import Depends, Request

from app.clients.anilist import AniListClient
from app.services.browse_service import BrowseService
from app.services.pagination_metadata import PaginationMetadataService


def get_anilist_client(request: Request) -> AniListClient:
    return request.app.state.anilist_client


def get_browse_service(
    request: Request,
    client: Annotated[AniListClient, Depends(get_anilist_client)],
) -> BrowseService:
    services: dict[int, PaginationMetadataService] = request.app.state.pagination_services
    pagination = services.get(id(client))
    if pagination is None:
        pagination = PaginationMetadataService(
            store=request.app.state.pagination_metadata_store,
            client=client,
            settings=request.app.state.settings,
        )
        services[id(client)] = pagination
    return BrowseService(
        client=client,
        cache=request.app.state.browse_page_cache,
        pagination=pagination,
        settings=request.app.state.settings,
    )
