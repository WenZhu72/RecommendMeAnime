from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ApiModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


class AnimeTitle(ApiModel):
    english: str | None = None
    romaji: str | None = None
    native: str | None = None


class AnimeDate(ApiModel):
    year: int | None = None
    month: int | None = None
    day: int | None = None


class Anime(ApiModel):
    id: int
    title: str
    titles: AnimeTitle
    description: str | None = None
    cover_image: str | None = Field(default=None, serialization_alias="coverImage")
    color: str | None = None
    banner_image: str | None = Field(default=None, serialization_alias="bannerImage")
    average_score: int | None = Field(default=None, serialization_alias="averageScore")
    mean_score: int | None = Field(default=None, serialization_alias="meanScore")
    popularity: int | None = None
    genres: list[str] = Field(default_factory=list)
    format: str | None = None
    status: str | None = None
    episodes: int | None = None
    duration: int | None = None
    season: str | None = None
    season_year: int | None = Field(default=None, serialization_alias="seasonYear")
    start_date: AnimeDate | None = Field(default=None, serialization_alias="startDate")
    end_date: AnimeDate | None = Field(default=None, serialization_alias="endDate")
    studios: list[str] = Field(default_factory=list)
    source: str | None = None
    country_of_origin: str | None = Field(default=None, serialization_alias="countryOfOrigin")
    synonyms: list[str] = Field(default_factory=list)
    site_url: str | None = Field(default=None, serialization_alias="siteUrl")
    is_adult: bool = Field(serialization_alias="isAdult")
    relations: list[Anime] = Field(default_factory=list)
    recommendations: list[Anime] = Field(default_factory=list)


class PageInfo(ApiModel):
    current_page: int = Field(serialization_alias="currentPage")
    has_next_page: bool = Field(serialization_alias="hasNextPage")
    last_page: int = Field(serialization_alias="lastPage")
    per_page: int = Field(serialization_alias="perPage")
    total: int = 0
    is_exact: bool = Field(default=True, serialization_alias="isExact")


class BrowsePageInfo(ApiModel):
    current_page: int = Field(serialization_alias="currentPage")
    has_next_page: bool = Field(serialization_alias="hasNextPage")
    last_page: int | None = Field(default=None, serialization_alias="lastPage")
    per_page: int = Field(serialization_alias="perPage")
    total: int | None = None
    is_exact: bool = Field(default=True, serialization_alias="isExact")
    verification_status: Literal["verified", "stale", "calculating", "estimated", "failed"] = Field(
        default="verified",
        serialization_alias="verificationStatus",
    )
    last_verified_at: datetime | None = Field(default=None, serialization_alias="lastVerifiedAt")


class AnimeListResponse(ApiModel):
    items: list[Anime] = Field(default_factory=list)
    page_info: PageInfo = Field(serialization_alias="pageInfo")


class BrowseAnimeListResponse(ApiModel):
    items: list[Anime] = Field(default_factory=list)
    page_info: BrowsePageInfo = Field(serialization_alias="pageInfo")
