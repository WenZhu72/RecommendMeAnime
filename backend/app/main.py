from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.anime import router as anime_router
from app.api.recommendations import router as recommendations_router
from app.clients.anilist import AniListClient
from app.core.config import Settings, configure_logging, settings
from app.core.exceptions import (
    AniListRateLimitError,
    AniListResponseError,
    AniListTimeoutError,
    AniListUnavailableError,
    AniListUpstreamError,
)
from app.repositories.pagination_metadata import PaginationMetadataStore
from app.services.browse_cache import BrowsePageCache
from app.services.pagination_metadata import PaginationMetadataService

configure_logging(settings.log_level)
logger = logging.getLogger(__name__)


def create_app(
    config: Settings = settings,
    *,
    pagination_store: PaginationMetadataStore | None = None,
) -> FastAPI:
    """Create the API application with explicit, deployment-safe configuration."""

    pagination_store = pagination_store or PaginationMetadataStore(config.database_url)
    browse_page_cache = BrowsePageCache(
        max_entries=config.browse_cache_max_entries,
        hot_ttl_seconds=config.browse_cache_hot_page_ttl_seconds,
        warm_ttl_seconds=config.browse_cache_warm_page_ttl_seconds,
        cold_ttl_seconds=config.browse_cache_cold_page_ttl_seconds,
        hot_access_threshold=config.browse_cache_hot_access_threshold,
    )

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        timeout = httpx.Timeout(config.external_api_timeout_seconds)
        await pagination_store.initialise()
        async with httpx.AsyncClient(base_url=config.anilist_api_url, timeout=timeout) as http_client:
            application.state.anilist_client = AniListClient(
                http_client,
                cache_ttl_seconds=config.cache_ttl_seconds,
                exact_pagination_cache_ttl_seconds=config.exact_pagination_cache_ttl_seconds,
                exact_probe_response_wait_seconds=config.anilist_exact_probe_response_wait_seconds,
                exact_probe_max_page=config.anilist_exact_probe_max_page,
                stale_if_error_seconds=config.stale_if_error_seconds,
                max_concurrency=config.anilist_max_concurrency,
                max_retries=config.anilist_max_retries,
                retry_fallback_seconds=config.anilist_retry_fallback_seconds,
                max_retry_delay_seconds=config.anilist_max_retry_delay_seconds,
            )
            application.state.settings = config
            application.state.pagination_metadata_store = pagination_store
            application.state.browse_page_cache = browse_page_cache
            application.state.pagination_services = {
                id(application.state.anilist_client): PaginationMetadataService(
                    store=pagination_store,
                    client=application.state.anilist_client,
                    settings=config,
                )
            }
            logger.info(
                "Starting RecommendMeAnime API (environment=%s, cors_origins=%d, cache_ttl_seconds=%d, "
                "exact_cache_ttl_seconds=%d, exact_probe_wait_seconds=%.1f, "
                "exact_probe_max_page=%d, anilist_max_concurrency=%d)",
                config.app_env,
                len(config.cors_allowed_origins),
                config.cache_ttl_seconds,
                config.exact_pagination_cache_ttl_seconds,
                config.anilist_exact_probe_response_wait_seconds,
                config.anilist_exact_probe_max_page,
                config.anilist_max_concurrency,
            )
            try:
                yield
            finally:
                logger.info("Stopping RecommendMeAnime API")
                await application.state.browse_page_cache.shutdown()
                await asyncio.gather(
                    *(
                        service.shutdown()
                        for service in application.state.pagination_services.values()
                    ),
                    return_exceptions=True,
                )
                await pagination_store.close()

    application = FastAPI(
        title="RecommendMeAnime API",
        version="1.0.0",
        description="A typed FastAPI proxy between RecommendMeAnime and AniList.",
        lifespan=lifespan,
    )
    # These state objects are also available to ASGI harnesses that do not run
    # lifespan events. The repository initialises lazily on first access.
    application.state.settings = config
    application.state.pagination_metadata_store = pagination_store
    application.state.browse_page_cache = browse_page_cache
    application.state.pagination_services = {}
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(config.cors_allowed_origins),
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @application.exception_handler(AniListTimeoutError)
    async def anilist_timeout_handler(_: Request, error: AniListTimeoutError) -> JSONResponse:
        logger.warning("AniList request timed out: %s", error.__class__.__name__)
        return JSONResponse(
            status_code=503,
            content={"detail": "The catalogue provider is temporarily unavailable. Please try again shortly."},
        )

    @application.exception_handler(AniListRateLimitError)
    async def anilist_rate_limit_handler(_: Request, error: AniListRateLimitError) -> JSONResponse:
        logger.warning(
            "AniList rate limit persisted attempts=%d retry_after=%s",
            error.attempts,
            error.retry_after,
        )
        return JSONResponse(
            status_code=503,
            content={"detail": "The catalogue provider is temporarily unavailable. Please try again shortly."},
        )

    @application.exception_handler(AniListUpstreamError)
    async def anilist_upstream_handler(_: Request, error: AniListUpstreamError) -> JSONResponse:
        logger.warning("AniList temporary upstream failure status=%d", error.status_code)
        return JSONResponse(
            status_code=503,
            content={"detail": "The catalogue provider is temporarily unavailable. Please try again shortly."},
        )

    @application.exception_handler(AniListUnavailableError)
    async def anilist_unavailable_handler(_: Request, error: AniListUnavailableError) -> JSONResponse:
        logger.warning("AniList is unavailable: %s", error.__class__.__name__)
        return JSONResponse(
            status_code=503,
            content={"detail": "The catalogue provider is temporarily unavailable. Please try again shortly."},
        )

    @application.exception_handler(AniListResponseError)
    async def anilist_response_handler(_: Request, error: AniListResponseError) -> JSONResponse:
        logger.warning("AniList returned an unusable response: %s", error.__class__.__name__)
        return JSONResponse(status_code=502, content={"detail": "Unable to retrieve anime data from AniList."})

    @application.exception_handler(RequestValidationError)
    async def validation_error_handler(_: Request, error: RequestValidationError) -> JSONResponse:
        # Do not log the validation payload because it may contain user-provided data.
        del error
        logger.info("Invalid API request parameters")
        return JSONResponse(status_code=400, content={"detail": "Invalid request parameters."})

    @application.exception_handler(Exception)
    async def unexpected_error_handler(_: Request, error: Exception) -> JSONResponse:
        logger.exception("Unexpected API error", exc_info=error)
        return JSONResponse(status_code=500, content={"detail": "An unexpected server error occurred."})

    application.include_router(anime_router)
    application.include_router(recommendations_router)

    @application.get("/health", tags=["Health"], summary="Check API availability")
    @application.get("/api/health", include_in_schema=False)
    async def health() -> dict[str, str]:
        """A lightweight Render health check that intentionally does not call AniList."""
        return {"status": "ok"}

    return application


app = create_app()
