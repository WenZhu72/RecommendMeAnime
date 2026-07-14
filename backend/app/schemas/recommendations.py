from typing import Literal

from pydantic import Field, field_validator

from app.schemas.anime import ApiModel

AnimeFormat = Literal["TV", "MOVIE", "OVA", "ONA", "SPECIAL"]
AnimeLength = Literal["short", "medium", "long", "any"]
ReleasePeriod = Literal["recent", "modern", "classic", "any"]
PopularityPreference = Literal["popular", "hidden-gems", "any"]
ContentTone = Literal["light-hearted", "dark", "emotional", "action-focused"]


class RecommendationPreferences(ApiModel):
    favorite_genres: list[str] = Field(min_length=1, validation_alias="favoriteGenres")
    avoided_genres: list[str] = Field(default_factory=list, validation_alias="avoidedGenres")
    formats: list[AnimeFormat] = Field(default_factory=list)
    preferred_length: AnimeLength = Field(validation_alias="preferredLength")
    release_period: ReleasePeriod = Field(validation_alias="releasePeriod")
    minimum_score: int = Field(ge=0, le=100, validation_alias="minimumScore")
    popularity: PopularityPreference
    tones: list[ContentTone] = Field(default_factory=list)

    @field_validator("favorite_genres", "avoided_genres")
    @classmethod
    def clean_genres(cls, values: list[str]) -> list[str]:
        cleaned = list(dict.fromkeys(value.strip() for value in values if value.strip()))
        return cleaned

    @field_validator("favorite_genres")
    @classmethod
    def require_favorite_genre(cls, values: list[str]) -> list[str]:
        if not values:
            raise ValueError("Choose at least one favourite genre.")
        return values
