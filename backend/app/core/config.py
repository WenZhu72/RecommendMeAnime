from __future__ import annotations

import logging
from dataclasses import dataclass
from os import environ
from typing import Mapping
from urllib.parse import urlparse

from dotenv import load_dotenv

# Local development is optional. Render supplies configuration through its
# environment and load_dotenv does not override variables already provided there.
load_dotenv()

DEFAULT_ANILIST_API_URL = "https://graphql.anilist.co"
DEFAULT_FRONTEND_ORIGIN = "http://localhost:3000"


class ConfigurationError(ValueError):
    """Raised when a non-secret deployment setting is invalid."""


@dataclass(frozen=True)
class Settings:
    app_env: str
    anilist_api_url: str
    external_api_timeout_seconds: float
    cors_allowed_origins: tuple[str, ...]
    cache_ttl_seconds: int
    log_level: str


def _normalise_http_url(value: str, *, setting_name: str, allow_path: bool = False) -> str:
    parsed = urlparse(value.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ConfigurationError(f"{setting_name} must be an absolute HTTP(S) URL.")
    if parsed.params or parsed.query or parsed.fragment or (not allow_path and parsed.path.rstrip("/")):
        raise ConfigurationError(f"{setting_name} must not include a path, query string, or fragment.")
    return value.strip().rstrip("/")


def _parse_origins(values: Mapping[str, str]) -> tuple[str, ...]:
    raw_origins = (
        values.get("CORS_ALLOWED_ORIGINS")
        or values.get("FRONTEND_ORIGIN")  # Backwards-compatible local setting.
        or values.get("FRONTEND_URL")
        or DEFAULT_FRONTEND_ORIGIN
    )
    origins: list[str] = []
    for raw_origin in raw_origins.split(","):
        origin = raw_origin.strip()
        if not origin:
            continue
        if origin == "*":
            raise ConfigurationError("CORS_ALLOWED_ORIGINS must list explicit origins; '*' is not allowed.")
        normalised = _normalise_http_url(origin, setting_name="CORS_ALLOWED_ORIGINS")
        if normalised not in origins:
            origins.append(normalised)
    if not origins:
        raise ConfigurationError("CORS_ALLOWED_ORIGINS must include at least one origin.")
    return tuple(origins)


def _parse_positive_float(values: Mapping[str, str], name: str, default: float) -> float:
    raw = values.get(name)
    if raw is None and name == "EXTERNAL_API_TIMEOUT_SECONDS":
        raw = values.get("ANILIST_REQUEST_TIMEOUT")
    try:
        value = float(raw) if raw is not None else default
    except ValueError as error:
        raise ConfigurationError(f"{name} must be a number.") from error
    if value <= 0:
        raise ConfigurationError(f"{name} must be greater than zero.")
    return value


def _parse_non_negative_int(values: Mapping[str, str], name: str, default: int) -> int:
    try:
        value = int(values.get(name, str(default)))
    except ValueError as error:
        raise ConfigurationError(f"{name} must be a whole number.") from error
    if value < 0:
        raise ConfigurationError(f"{name} must be zero or greater.")
    return value


def _parse_log_level(values: Mapping[str, str]) -> str:
    level = values.get("LOG_LEVEL", "INFO").upper()
    if level not in logging.getLevelNamesMapping():
        raise ConfigurationError("LOG_LEVEL must be a standard Python logging level.")
    return level


def get_settings(values: Mapping[str, str] | None = None) -> Settings:
    """Read deployment configuration without exposing environment values in errors."""
    source = environ if values is None else values
    app_env = source.get("APP_ENV", "development").strip().lower() or "development"
    anilist_api_url = _normalise_http_url(
        source.get("ANILIST_API_URL", DEFAULT_ANILIST_API_URL),
        setting_name="ANILIST_API_URL",
        allow_path=True,
    )
    return Settings(
        app_env=app_env,
        anilist_api_url=anilist_api_url,
        external_api_timeout_seconds=_parse_positive_float(source, "EXTERNAL_API_TIMEOUT_SECONDS", 10),
        cors_allowed_origins=_parse_origins(source),
        cache_ttl_seconds=_parse_non_negative_int(source, "CACHE_TTL_SECONDS", 3600),
        log_level=_parse_log_level(source),
    )


def configure_logging(log_level: str) -> None:
    """Configure concise logs suitable for both local development and Render."""
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )
    logging.getLogger().setLevel(log_level)


try:
    settings = get_settings()
except ConfigurationError as error:
    logging.basicConfig(format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
    logging.getLogger(__name__).error("Invalid application configuration: %s", error)
    raise
