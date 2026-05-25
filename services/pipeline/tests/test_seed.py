"""P3 AC3: seeding from mbg-crisis-data-v2.json populates the tables with row counts
that match the source export."""

import json
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from db.models import (
    ActorPost,
    Article,
    ArticleEnrichment,
    City,
    CityMetric,
    CrisisSnapshot,
    Keyword,
    Leader,
    LeaderArticle,
    LeaderSentiment,
    MarketTicker,
    Prediction,
    SocialActor,
)
from db.seed import JSON_PATH, seed


def _count(s: Session, model) -> int:
    return s.scalar(select(func.count()).select_from(model))


def test_seed_row_counts_match_source(migrated_db):
    raw = json.loads(Path(JSON_PATH).read_text(encoding="utf-8"))
    seed(migrated_db, JSON_PATH)

    actors = raw["actor_thread_analysis"]["actors"]
    leaders = raw["leadership_sentiment"]["leaders"]
    distinct_cities = {c["city_key"] for c in raw["city_map_points"]} | {
        c["city_key"] for c in raw["top_cities"]
    }

    with Session(migrated_db) as s:
        assert _count(s, Article) == len(raw["articles"])
        assert _count(s, ArticleEnrichment) == len(raw["articles"])
        assert _count(s, Prediction) == len(raw["predictions"])
        assert _count(s, Keyword) == len(raw["top_keywords"])
        assert _count(s, MarketTicker) == len(raw["market_ticker"])
        assert _count(s, City) == len(distinct_cities)
        assert _count(s, CityMetric) == len(raw["city_map_points"])
        assert _count(s, SocialActor) == len(actors)
        assert _count(s, ActorPost) == sum(len(a.get("top_posts", [])) for a in actors)
        assert _count(s, Leader) == len(leaders)
        assert _count(s, LeaderSentiment) == len(leaders)
        assert _count(s, LeaderArticle) == sum(len(l.get("recent_articles", [])) for l in leaders)
        assert _count(s, CrisisSnapshot) == 1
