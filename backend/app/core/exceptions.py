class AniListError(Exception):
    """Base class for failures while communicating with AniList."""


class AniListResponseError(AniListError):
    """AniList returned a non-temporary response that the API cannot use."""


class AniListGraphQLError(AniListResponseError):
    """AniList returned GraphQL errors in an otherwise valid HTTP response."""


class AniListMalformedResponseError(AniListResponseError):
    """AniList returned invalid JSON or omitted required response data."""


class AniListRequestError(AniListResponseError):
    """AniList rejected a request because it was invalid or unsupported."""

    def __init__(self, status_code: int) -> None:
        self.status_code = status_code
        super().__init__(f"AniList rejected the request with HTTP {status_code}")


class AniListUnavailableError(AniListError):
    """AniList could not be reached because the upstream service is unavailable."""


class AniListTimeoutError(AniListUnavailableError):
    """AniList did not respond within the configured timeout."""


class AniListRateLimitError(AniListUnavailableError):
    """AniList remained rate limited after the bounded retry policy."""

    def __init__(self, *, retry_after: float | None, attempts: int) -> None:
        self.retry_after = retry_after
        self.attempts = attempts
        super().__init__("AniList rate limit retry budget was exhausted")


class AniListUpstreamError(AniListUnavailableError):
    """AniList returned a temporary server-side HTTP error."""

    def __init__(self, status_code: int) -> None:
        self.status_code = status_code
        super().__init__(f"AniList returned temporary HTTP {status_code}")


class AnimeNotFoundError(Exception):
    """The requested AniList anime does not exist."""
