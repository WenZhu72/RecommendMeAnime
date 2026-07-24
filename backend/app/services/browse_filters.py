from __future__ import annotations

import unicodedata
from dataclasses import dataclass
from typing import Literal
from urllib.parse import quote, unquote


ORDERING_ONLY_SORTS = frozenset(
    {
        "POPULARITY_DESC",
        "SCORE_DESC",
        "TRENDING_DESC",
    }
)
SortSemantics = Literal["ordering_only", "sort_specific"]


def _clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = " ".join(unicodedata.normalize("NFKC", value).strip().split())
    return cleaned or None


def _normalise_text(value: str | None) -> str | None:
    cleaned = _clean_text(value)
    return cleaned.casefold() if cleaned is not None else None


def _normalise_enum(value: str | None) -> str | None:
    cleaned = _normalise_text(value)
    return cleaned.upper() if cleaned is not None else None


def _normalise_genres(values: list[str] | tuple[str, ...] | None) -> tuple[str, ...]:
    by_identity: dict[str, str] = {}
    for value in values or ():
        cleaned = _clean_text(value)
        if cleaned is not None:
            by_identity.setdefault(cleaned.casefold(), cleaned)
    return tuple(by_identity[key] for key in sorted(by_identity))


def _normalise_sort(values: list[str] | tuple[str, ...] | None) -> tuple[str, ...]:
    cleaned = [
        normalised
        for value in (values or ("POPULARITY_DESC",))
        if (normalised := _normalise_enum(value)) is not None
    ]
    return tuple(dict.fromkeys(cleaned)) or ("POPULARITY_DESC",)


def _encode(value: object) -> str:
    return quote(str(value), safe="-_.~,")


def sort_semantics(values: tuple[str, ...]) -> SortSemantics:
    """Classify whether a known sort tuple can affect result membership.

    AniList defines these values as ordering arguments. The allow-list keeps
    unknown or future values isolated until their semantics are reviewed.
    """

    return (
        "ordering_only"
        if values and all(value in ORDERING_ONLY_SORTS for value in values)
        else "sort_specific"
    )


@dataclass(frozen=True)
class BrowseFilterSet:
    """Normalised values that define one AniList Browse result set."""

    search: str | None
    genres: tuple[str, ...]
    anime_format: str | None
    season: str | None
    season_year: int | None
    minimum_score: int | None
    sort: tuple[str, ...]
    per_page: int
    is_adult: bool = False

    @classmethod
    def create(
        cls,
        *,
        search: str | None = None,
        genres: list[str] | tuple[str, ...] | None = None,
        anime_format: str | None = None,
        season: str | None = None,
        season_year: int | None = None,
        minimum_score: int | None = None,
        sort: list[str] | tuple[str, ...] | None = None,
        per_page: int = 20,
        is_adult: bool = False,
    ) -> BrowseFilterSet:
        return cls(
            search=_clean_text(search),
            genres=_normalise_genres(genres),
            anime_format=_normalise_enum(anime_format),
            season=_normalise_enum(season),
            season_year=season_year,
            minimum_score=minimum_score,
            sort=_normalise_sort(sort),
            per_page=per_page,
            is_adult=is_adult,
        )

    def anilist_arguments(self) -> dict[str, object]:
        return {
            "search": self.search,
            "genre": None,
            "genre_in": list(self.genres) or None,
            "anime_format": self.anime_format,
            "format_in": None,
            "season": self.season,
            "season_year": self.season_year,
            "minimum_score": self.minimum_score,
            "sort": list(self.sort),
        }

    def is_narrow(self) -> bool:
        signals = sum(
            (
                len(self.genres) >= 2,
                self.season is not None and self.season_year is not None,
                self.anime_format is not None,
                self.minimum_score is not None and self.minimum_score >= 75,
                self.search is not None and bool(self.genres or self.anime_format),
            )
        )
        return signals >= 1

    def is_default(self) -> bool:
        return (
            self.search is None
            and not self.genres
            and self.anime_format is None
            and self.season is None
            and self.season_year is None
            and self.minimum_score is None
            and self.sort == ("POPULARITY_DESC",)
        )


def _canonical_filter_key(filters: BrowseFilterSet, *, include_sort: bool) -> str:
    values: dict[str, object] = {
        "format": filters.anime_format,
        "genres": ",".join(
            normalised
            for genre in filters.genres
            if (normalised := _normalise_enum(genre)) is not None
        ) or None,
        "is_adult": str(filters.is_adult).lower(),
        "minimum_score": filters.minimum_score,
        "per_page": filters.per_page,
        "search": _normalise_text(filters.search),
        "season": filters.season,
        "season_year": filters.season_year,
    }
    if include_sort or sort_semantics(filters.sort) != "ordering_only":
        values["sort"] = ",".join(filters.sort)
    return "|".join(
        f"{name}={_encode(value)}"
        for name, value in sorted(values.items())
        if value is not None and value != ""
    )


def metadata_filter_key(filters: BrowseFilterSet) -> str:
    """Identify matching membership and exact-pagination metadata.

    Page and reviewed ordering-only sorts are excluded. ``per_page`` remains
    mandatory because it changes the terminal page.
    """

    return _canonical_filter_key(filters, include_sort=False)


def ordered_filter_key(filters: BrowseFilterSet) -> str:
    """Identify one ordered result set while excluding only page number."""

    return _canonical_filter_key(filters, include_sort=True)


def canonical_filter_key(filters: BrowseFilterSet) -> str:
    """Backward-compatible name for the canonical metadata identity."""

    return metadata_filter_key(filters)


def legacy_metadata_filter_key(filter_key: str) -> str:
    """Convert a previous sort-specific key when its sort is known-safe.

    Existing deployed rows used the ordered filter key for pagination facts.
    Unknown sort values are deliberately left untouched.
    """

    parts = filter_key.split("|")
    sort_parts = [part for part in parts if part.startswith("sort=")]
    if len(sort_parts) != 1:
        return filter_key
    encoded_sort = sort_parts[0].split("=", 1)[1]
    sort = tuple(value for value in unquote(encoded_sort).split(",") if value)
    if sort_semantics(sort) != "ordering_only":
        return filter_key
    return "|".join(part for part in parts if not part.startswith("sort="))


def browse_page_cache_key(ordered_key: str, page: int) -> str:
    return f"browse:{ordered_key}:page:{page}"
