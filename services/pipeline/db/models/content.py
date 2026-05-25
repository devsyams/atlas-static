"""Sources & raw content: sources, articles, article_enrichment (spec §9.1)."""

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Computed,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    type: Mapped[str] = mapped_column(String(50))  # rss | news_api | x | instagram | ...
    platform: Mapped[str | None] = mapped_column(String(50))
    endpoint: Mapped[str | None] = mapped_column(Text)
    cadence_sec: Mapped[int] = mapped_column(Integer, default=1800, server_default="1800")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    config: Mapped[dict | None] = mapped_column("config_jsonb", JSONB)


class Article(Base):
    __tablename__ = "articles"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    source_id: Mapped[int | None] = mapped_column(
        ForeignKey("sources.id", ondelete="SET NULL"), index=True
    )
    url: Mapped[str] = mapped_column(Text, unique=True)
    canonical_url: Mapped[str | None] = mapped_column(Text)
    content_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    title: Mapped[str | None] = mapped_column(Text)
    body: Mapped[str | None] = mapped_column(Text)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    raw_uri: Mapped[str | None] = mapped_column(Text)
    # Generated full-text search vector over title + body (spec §9.1 "fts tsvector").
    fts: Mapped[str | None] = mapped_column(
        TSVECTOR,
        Computed(
            "to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body, ''))",
            persisted=True,
        ),
    )

    __table_args__ = (Index("ix_articles_fts", "fts", postgresql_using="gin"),)


class ArticleEnrichment(Base):
    __tablename__ = "article_enrichment"

    article_id: Mapped[int] = mapped_column(
        ForeignKey("articles.id", ondelete="CASCADE"), primary_key=True
    )
    score: Mapped[float | None] = mapped_column(Numeric(4, 2))
    level: Mapped[str | None] = mapped_column(String(20))
    dominant_issue: Mapped[str | None] = mapped_column(String(100))
    secondary_issues: Mapped[list | None] = mapped_column(JSONB)
    ai_reasoning: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(120))
    province: Mapped[str | None] = mapped_column(String(120))
    lat: Mapped[float | None] = mapped_column(Numeric(9, 6))
    lng: Mapped[float | None] = mapped_column(Numeric(9, 6))
    sentiment: Mapped[str | None] = mapped_column(String(20))
    model: Mapped[str | None] = mapped_column(String(100))
    tokens: Mapped[int | None] = mapped_column(Integer)
    cost: Mapped[float | None] = mapped_column(Numeric(10, 6))
    enriched_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
