from pydantic import BaseModel


class AnimeResponse(BaseModel):
    id: int
    title: str
    romajiTitle: str | None = None
    description: str | None = None
    coverImage: str | None = None
    averageScore: int | None = None
    genres: list[str]
    episodes: int | None = None
    chapters: int | None = None