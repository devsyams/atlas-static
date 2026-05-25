"""Social & leadership (spec §9.1): monitored actors + posts, leaders + sentiment."""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class SocialActor(Base):
    __tablename__ = "social_actors"

    id: Mapped[int] = mapped_column(primary_key=True)
    handle: Mapped[str] = mapped_column(String(120), index=True)
    name: Mapped[str | None] = mapped_column(String(200))
    platform: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[str | None] = mapped_column(String(40))
    followers: Mapped[int | None] = mapped_column(BigInteger)
    influence: Mapped[float | None] = mapped_column(Numeric(4, 1))
    credibility: Mapped[float | None] = mapped_column(Numeric(4, 1))
    sentiment: Mapped[float | None] = mapped_column(Numeric(4, 2))  # -1.0 … 1.0
    risk_level: Mapped[str | None] = mapped_column(String(20))
    posts_7d: Mapped[int | None] = mapped_column(Integer)
    brand_mentions: Mapped[int | None] = mapped_column(Integer)
    avg_engagement: Mapped[int | None] = mapped_column(Integer)
    total_engagement: Mapped[int | None] = mapped_column(BigInteger)
    avatar: Mapped[str | None] = mapped_column(Text)
    themes: Mapped[list | None] = mapped_column(JSONB)
    brand_summary: Mapped[str | None] = mapped_column(Text)
    influence_analysis: Mapped[str | None] = mapped_column(Text)
    collab_opportunity: Mapped[str | None] = mapped_column(Text)
    recommended_actions: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ActorPost(Base):
    __tablename__ = "actor_posts"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    actor_id: Mapped[int] = mapped_column(
        ForeignKey("social_actors.id", ondelete="CASCADE"), index=True
    )
    text: Mapped[str | None] = mapped_column(Text)
    likes: Mapped[int | None] = mapped_column(Integer)
    comments: Mapped[int | None] = mapped_column(Integer)
    views: Mapped[int | None] = mapped_column(BigInteger)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    raw_uri: Mapped[str | None] = mapped_column(Text)


class Leader(Base):
    __tablename__ = "leaders"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    position: Mapped[str | None] = mapped_column(String(200))
    organization: Mapped[str | None] = mapped_column(String(200))
    photo_uri: Mapped[str | None] = mapped_column(Text)


class LeaderSentiment(Base):
    __tablename__ = "leader_sentiment"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    leader_id: Mapped[int] = mapped_column(ForeignKey("leaders.id", ondelete="CASCADE"), index=True)
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    score: Mapped[float | None] = mapped_column(Numeric(4, 2))
    trend: Mapped[str | None] = mapped_column(String(20))
    article_count: Mapped[int | None] = mapped_column(Integer)
    insight: Mapped[str | None] = mapped_column(Text)
    prediction: Mapped[dict | None] = mapped_column("prediction_jsonb", JSONB)


class LeaderArticle(Base):
    __tablename__ = "leader_articles"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    leader_id: Mapped[int] = mapped_column(ForeignKey("leaders.id", ondelete="CASCADE"), index=True)
    title: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str | None] = mapped_column(String(200))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sentiment: Mapped[str | None] = mapped_column(String(20))
    crisis_score: Mapped[float | None] = mapped_column(Numeric(4, 2))
