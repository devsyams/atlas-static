"""Seed the database from the exported MBG crisis dashboard JSON (feature P3, AC3).

Maps ``apps/web/mbg-crisis-data-v2.json`` into the spec §9 tables so the dashboard can
render from Postgres in dev/demo. Source publishers are derived from article bylines
(the export has no separate sources list). Run with: ``uv run python -m db.seed``.
"""

from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

from sqlalchemy import create_engine, func, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from db.models import (
    ActorPost,
    Article,
    ArticleEnrichment,
    City,
    CityMetric,
    CrisisSnapshot,
    Insight,
    Keyword,
    Leader,
    LeaderArticle,
    LeaderSentiment,
    MarketTicker,
    Prediction,
    SocialActor,
    Source,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
JSON_PATH = REPO_ROOT / "apps" / "web" / "mbg-crisis-data-v2.json"


def _dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return None


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def seed(engine: Engine, json_path: Path | str = JSON_PATH) -> None:
    """Load the export into a freshly-migrated (empty) database."""
    raw = json.loads(Path(json_path).read_text(encoding="utf-8"))
    now = datetime.now(timezone.utc)

    with Session(engine) as s:
        cs = raw["crisis_score"]
        s.add(
            CrisisSnapshot(
                captured_at=now,
                score=cs["score"],
                level=cs.get("level"),
                article_count=cs.get("article_count", 0),
                high_crisis_count=cs.get("high_crisis_count", 0),
                mapped_count=raw.get("mapped_article_count", 0),
                unmapped_count=raw.get("unmapped_article_count", 0),
            )
        )

        if raw.get("insight"):
            ins = raw["insight"]
            s.add(Insight(captured_at=now, title=ins.get("title"), text=ins.get("text"), action=ins.get("action")))

        for p in raw.get("predictions", []):
            s.add(
                Prediction(
                    captured_at=now,
                    question=p["question"],
                    probability=p.get("probability"),
                    answer_label=p.get("answer_label"),
                    reasoning=p.get("reasoning"),
                    timeframe=p.get("timeframe"),
                    tone=p.get("tone"),
                )
            )

        for m in raw.get("market_ticker", []):
            s.add(MarketTicker(captured_at=now, label=m["label"], value=m.get("value"), delta=m.get("delta")))

        for k in raw.get("top_keywords", []):
            s.add(Keyword(captured_at=now, term=k["keyword"], count=k.get("count", 0), sentiment=k.get("sentiment")))

        # cities (deduped across both city collections) + per-city metrics
        cities: dict[str, dict] = {}
        for c in raw.get("city_map_points", []) + raw.get("top_cities", []):
            cities.setdefault(c["city_key"], c)
        for key, c in cities.items():
            s.add(City(city_key=key, city=c.get("city"), province=c.get("province"), lat=c.get("lat"), lng=c.get("lng")))
        for c in raw.get("city_map_points", []):
            s.add(
                CityMetric(
                    city_key=c["city_key"],
                    captured_at=now,
                    heat=c.get("heat"),
                    severity_sum=c.get("severity_sum"),
                    article_count=c.get("article_count", 0),
                    dominant_issue=c.get("dominant_issue"),
                )
            )

        # sources derived from article bylines, then articles + enrichment
        source_ids: dict[str, int] = {}
        for a in raw.get("articles", []):
            name = a.get("source") or "Unknown"
            if name not in source_ids:
                src = Source(name=name, type="rss", enabled=True)
                s.add(src)
                s.flush()
                source_ids[name] = src.id
            art = Article(
                source_id=source_ids[name],
                url=a["link"],
                canonical_url=a.get("link"),
                content_hash=_hash(a["link"]),
                title=a.get("title"),
                body=a.get("summary"),
                published_at=_dt(a.get("date")),
            )
            s.add(art)
            s.flush()
            loc = a.get("location") or {}
            s.add(
                ArticleEnrichment(
                    article_id=art.id,
                    score=a.get("score"),
                    level=a.get("level"),
                    dominant_issue=a.get("dominant_issue"),
                    secondary_issues=a.get("secondary_issues"),
                    ai_reasoning=a.get("ai_reasoning"),
                    city=loc.get("city"),
                    province=loc.get("province"),
                    lat=loc.get("lat"),
                    lng=loc.get("lng"),
                    enriched_at=now,
                )
            )

        # social actors + their top posts
        for ac in (raw.get("actor_thread_analysis") or {}).get("actors", []):
            actor = SocialActor(
                handle=ac["handle"],
                name=ac.get("name"),
                platform=ac.get("platform"),
                status=ac.get("status"),
                followers=ac.get("followers"),
                influence=ac.get("influence"),
                credibility=ac.get("credibility"),
                sentiment=ac.get("sentiment"),
                risk_level=ac.get("risk_level"),
                posts_7d=ac.get("posts_7d"),
                brand_mentions=ac.get("brand_mentions"),
                avg_engagement=ac.get("avg_engagement"),
                total_engagement=ac.get("total_engagement"),
                avatar=ac.get("avatar"),
                themes=ac.get("themes"),
                brand_summary=ac.get("brand_summary"),
                influence_analysis=ac.get("influence_analysis"),
                collab_opportunity=ac.get("collab_opportunity"),
                recommended_actions=ac.get("recommended_actions"),
                updated_at=now,
            )
            s.add(actor)
            s.flush()
            for tp in ac.get("top_posts", []):
                s.add(
                    ActorPost(
                        actor_id=actor.id,
                        text=tp.get("text"),
                        likes=tp.get("likes"),
                        comments=tp.get("comments"),
                        views=tp.get("views"),
                    )
                )

        # leaders + sentiment + recent articles
        for ld in (raw.get("leadership_sentiment") or {}).get("leaders", []):
            leader = Leader(
                name=ld["name"],
                position=ld.get("position"),
                organization=ld.get("organization"),
                photo_uri=ld.get("photo"),
            )
            s.add(leader)
            s.flush()
            sent = ld.get("sentiment") or {}
            s.add(
                LeaderSentiment(
                    leader_id=leader.id,
                    captured_at=now,
                    score=sent.get("score"),
                    trend=sent.get("trend"),
                    article_count=sent.get("article_count"),
                    insight=ld.get("insight"),
                    prediction=ld.get("prediction"),
                )
            )
            for ra in ld.get("recent_articles", []):
                s.add(
                    LeaderArticle(
                        leader_id=leader.id,
                        title=ra.get("title"),
                        source=ra.get("source"),
                        published_at=_dt(ra.get("date")),
                        sentiment=ra.get("sentiment"),
                        crisis_score=ra.get("crisis_score"),
                    )
                )

        s.commit()


def main() -> None:
    url = os.environ.get("DATABASE_URL", "postgresql+psycopg://atlas:atlas@127.0.0.1:55432/atlas")
    engine = create_engine(url)
    with Session(engine) as s:
        if s.scalar(select(func.count()).select_from(Article)):
            print("Database already has articles; skipping seed.")
            return
    seed(engine)
    print(f"Seeded from {JSON_PATH}")


if __name__ == "__main__":
    main()
