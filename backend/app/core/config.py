from __future__ import annotations

import logging
from dataclasses import dataclass
from os import environ
from typing import Mapping
from urllib.parse import urlparse

from dotenv import load_dotenv
from sqlalchemy.engine import make_url

# Local development is optional. Render supplies configuration through its
# environment and load_dotenv does not override variables already provided there.
load_dotenv()

DEFAULT_ANILIST_API_URL = "https://graphql.anilist.co"
DEFAULT_FRONTEND_ORIGIN = "http://localhost:3000"
DEFAULT_ANILIST_EXACT_PROBE_MAX_PAGE = 250
LOCAL_DATABASE_HOSTS = frozenset(
    {
        "localhost",
        "127.0.0.1",
        "::1",
        "postgres",
        "host.docker.internal",
    }
)


class ConfigurationError(ValueError):
    """Raised when a non-secret deployment setting is invalid."""


@dataclass(frozen=True)
class Settings:
    app_env: str
    database_url: str
    anilist_api_url: str
    external_api_timeout_seconds: float
    cors_allowed_origins: tuple[str, ...]
    cache_ttl_seconds: int
    exact_pagination_cache_ttl_seconds: int
    anilist_exact_probe_response_wait_seconds: float
    anilist_exact_probe_max_page: int
    stale_if_error_seconds: int
    anilist_max_concurrency: int
    anilist_max_retries: int
    anilist_retry_fallback_seconds: float
    anilist_max_retry_delay_seconds: float
    pagination_fresh_hours: float
    pagination_very_stale_days: float
    pagination_probe_timeout_seconds: float
    pagination_max_concurrent_probes: int
    pagination_retry_backoff_seconds: tuple[int, ...]
    browse_cache_max_entries: int
    browse_cache_hot_page_ttl_seconds: int
    browse_cache_warm_page_ttl_seconds: int
    browse_cache_cold_page_ttl_seconds: int
    browse_cache_hot_access_threshold: int
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


def _parse_positive_int(values: Mapping[str, str], name: str, default: int) -> int:
    value = _parse_non_negative_int(values, name, default)
    if value == 0:
        raise ConfigurationError(f"{name} must be greater than zero.")
    return value


def _parse_log_level(values: Mapping[str, str]) -> str:
    level = values.get("LOG_LEVEL", "INFO").upper()
    if level not in logging.getLevelNamesMapping():
        raise ConfigurationError("LOG_LEVEL must be a standard Python logging level.")
    return level


def _parse_backoff(values: Mapping[str, str]) -> tuple[int, ...]:
    raw = values.get("PAGINATION_RETRY_BACKOFF_SECONDS", "300,900,3600,21600")
    try:
        parsed = tuple(int(value.strip()) for value in raw.split(",") if value.strip())
    except ValueError as error:
        raise ConfigurationError(
            "PAGINATION_RETRY_BACKOFF_SECONDS must be comma-separated whole numbers."
        ) from error
    if not parsed or any(value <= 0 for value in parsed):
        raise ConfigurationError("PAGINATION_RETRY_BACKOFF_SECONDS values must be greater than zero.")
    return parsed


def _parse_environment(values: Mapping[str, str]) -> str:
    environment = values.get("ENVIRONMENT")
    legacy_environment = values.get("APP_ENV")
    if (
        environment is not None
        and legacy_environment is not None
        and environment.strip().lower() != legacy_environment.strip().lower()
    ):
        raise ConfigurationError("ENVIRONMENT and APP_ENV must not disagree.")
    parsed = (environment or legacy_environment or "development").strip().lower()
    if parsed not in {"development", "test", "production"}:
        raise ConfigurationError(
            "ENVIRONMENT must be development, test, or production."
        )
    return parsed


def _parse_database_url(values: Mapping[str, str], *, environment: str) -> str:
    database_url = values.get("DATABASE_URL", "").strip()
    if not database_url:
        raise ConfigurationError("DATABASE_URL is required.")

    normalised = database_url
    if normalised.startswith("postgres://"):
        normalised = f"postgresql+psycopg://{normalised.removeprefix('postgres://')}"
    elif normalised.startswith("postgresql://"):
        normalised = (
            f"postgresql+psycopg://{normalised.removeprefix('postgresql://')}"
        )

    try:
        parsed = make_url(normalised)
    except Exception as error:
        raise ConfigurationError("DATABASE_URL must be a valid PostgreSQL URL.") from error
    if parsed.drivername != "postgresql+psycopg":
        raise ConfigurationError("DATABASE_URL must use PostgreSQL with Psycopg 3.")
    if not parsed.database or not parsed.host:
        raise ConfigurationError("DATABASE_URL must include a database name and host.")

    host = parsed.host.lower()
    if environment == "production":
        if not host.endswith(".neon.tech"):
            raise ConfigurationError(
                "Production DATABASE_URL must point to a Neon PostgreSQL host."
            )
        if parsed.query.get("sslmode") not in {"require", "verify-full"}:
            raise ConfigurationError(
                "Production DATABASE_URL must preserve Neon SSL with sslmode=require "
                "or sslmode=verify-full."
            )
    elif host not in LOCAL_DATABASE_HOSTS:
        raise ConfigurationError(
            "Development and test DATABASE_URL must point to local Docker PostgreSQL."
        )
    return normalised


def get_settings(values: Mapping[str, str] | None = None) -> Settings:
    """Read deployment configuration without exposing environment values in errors."""
    source = environ if values is None else values
    app_env = _parse_environment(source)
    database_url = _parse_database_url(source, environment=app_env)
    anilist_api_url = _normalise_http_url(
        source.get("ANILIST_API_URL", DEFAULT_ANILIST_API_URL),
        setting_name="ANILIST_API_URL",
        allow_path=True,
    )
    return Settings(
        app_env=app_env,
        database_url=database_url,
        anilist_api_url=anilist_api_url,
        external_api_timeout_seconds=_parse_positive_float(source, "EXTERNAL_API_TIMEOUT_SECONDS", 10),
        cors_allowed_origins=_parse_origins(source),
        cache_ttl_seconds=_parse_non_negative_int(source, "CACHE_TTL_SECONDS", 3600),
        exact_pagination_cache_ttl_seconds=_parse_non_negative_int(
            source,
            "EXACT_PAGINATION_CACHE_TTL_SECONDS",
            3600,
        ),
        anilist_exact_probe_response_wait_seconds=_parse_positive_float(
            source,
            "ANILIST_EXACT_PROBE_RESPONSE_WAIT_SECONDS",
            3,
        ),
        anilist_exact_probe_max_page=_parse_positive_int(
            source,
            "ANILIST_EXACT_PROBE_MAX_PAGE",
            DEFAULT_ANILIST_EXACT_PROBE_MAX_PAGE,
        ),
        stale_if_error_seconds=_parse_non_negative_int(source, "ANILIST_STALE_IF_ERROR_SECONDS", 3600),
        anilist_max_concurrency=_parse_positive_int(source, "ANILIST_MAX_CONCURRENCY", 4),
        anilist_max_retries=_parse_non_negative_int(source, "ANILIST_MAX_RETRIES", 1),
        anilist_retry_fallback_seconds=_parse_positive_float(
            source,
            "ANILIST_RETRY_FALLBACK_SECONDS",
            1,
        ),
        anilist_max_retry_delay_seconds=_parse_positive_float(
            source,
            "ANILIST_MAX_RETRY_DELAY_SECONDS",
            30,
        ),
        pagination_fresh_hours=_parse_positive_float(source, "PAGINATION_FRESH_HOURS", 24),
        pagination_very_stale_days=_parse_positive_float(source, "PAGINATION_VERY_STALE_DAYS", 7),
        pagination_probe_timeout_seconds=_parse_positive_float(
            source,
            "PAGINATION_PROBE_TIMEOUT_SECONDS",
            15,
        ),
        pagination_max_concurrent_probes=_parse_positive_int(
            source,
            "PAGINATION_MAX_CONCURRENT_PROBES",
            2,
        ),
        pagination_retry_backoff_seconds=_parse_backoff(source),
        browse_cache_max_entries=_parse_positive_int(source, "BROWSE_CACHE_MAX_ENTRIES", 256),
        browse_cache_hot_page_ttl_seconds=_parse_non_negative_int(
            source,
            "BROWSE_CACHE_HOT_PAGE_TTL_SECONDS",
            3600,
        ),
        browse_cache_warm_page_ttl_seconds=_parse_non_negative_int(
            source,
            "BROWSE_CACHE_WARM_PAGE_TTL_SECONDS",
            1800,
        ),
        browse_cache_cold_page_ttl_seconds=_parse_non_negative_int(
            source,
            "BROWSE_CACHE_COLD_PAGE_TTL_SECONDS",
            600,
        ),
        browse_cache_hot_access_threshold=_parse_positive_int(
            source,
            "BROWSE_CACHE_HOT_ACCESS_THRESHOLD",
            5,
        ),
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
