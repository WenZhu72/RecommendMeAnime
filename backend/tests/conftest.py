from __future__ import annotations

import os

# Configuration is validated while app modules are imported. Unit tests inject
# an in-memory repository, so this URL is parsed but never contacted.
os.environ["ENVIRONMENT"] = "test"
os.environ["APP_ENV"] = "test"
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:development@localhost:5432/recommend_me_anime_test",
)
