class AniListResponseError(Exception):
    """AniList returned an invalid response, an HTTP error, or GraphQL errors."""


class AniListUnavailableError(Exception):
    """AniList could not be reached because the upstream service is unavailable."""


class AniListTimeoutError(AniListUnavailableError):
    """AniList did not respond within the configured timeout."""


class AnimeNotFoundError(Exception):
    """The requested AniList anime does not exist."""
