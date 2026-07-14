from __future__ import annotations

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
from app.core.exceptions import AniListResponseError, AniListTimeoutError, AniListUnavailableError

configure_logging(settings.log_level)
logger = logging.getLogger(__name__)


def create_app(config: Settings = settings) -> FastAPI:
    """Create the API application with explicit, deployment-safe configuration."""

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        timeout = httpx.Timeout(config.external_api_timeout_seconds)
        async with httpx.AsyncClient(base_url=config.anilist_api_url, timeout=timeout) as http_client:
            application.state.anilist_client = AniListClient(
                http_client,
                cache_ttl_seconds=config.cache_ttl_seconds,
            )
            application.state.settings = config
            logger.info(
                "Starting RecommendMeAnime API (environment=%s, cors_origins=%d, cache_ttl_seconds=%d)",
                config.app_env,
                len(config.cors_allowed_origins),
                config.cache_ttl_seconds,
            )
            try:
                yield
            finally:
                logger.info("Stopping RecommendMeAnime API")

    application = FastAPI(
        title="RecommendMeAnime API",
        version="1.0.0",
        description="A typed FastAPI proxy between RecommendMeAnime and AniList.",
        lifespan=lifespan,
    )
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
            status_code=504,
            content={"detail": "AniList is taking too long to respond. Please try again shortly."},
        )

    @application.exception_handler(AniListUnavailableError)
    async def anilist_unavailable_handler(_: Request, error: AniListUnavailableError) -> JSONResponse:
        logger.warning("AniList is unavailable: %s", error.__class__.__name__)
        return JSONResponse(
            status_code=503,
            content={"detail": "AniList is temporarily unavailable. Please try again shortly."},
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
