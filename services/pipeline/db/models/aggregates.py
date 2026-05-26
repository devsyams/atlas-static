"""Aggregates / dashboard surfaces (spec §9.1): time-series snapshots, city metrics,
keywords, predictions, insights, market ticker."""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class CrisisSnapshot(Base):
    __tablename__ = "crisis_snapshots"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    score: Mapped[float | None] = mapped_column(Numeric(4, 2))
    level: Mapped[str | None] = mapped_column(String(20))
    article_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    high_crisis_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    mapped_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    unmapped_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class City(Base):
    __tablename__ = "cities"

    city_key: Mapped[str] = mapped_column(String(120), primary_key=True)
    city: Mapped[str | None] = mapped_column(String(120))
    province: Mapped[str | None] = mapped_column(String(120))
    lat: Mapped[float | None] = mapped_column(Numeric(9, 6))
    lng: Mapped[float | None] = mapped_column(Numeric(9, 6))


class CityMetric(Base):
    __tablename__ = "city_metrics"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    city_key: Mapped[str] = mapped_column(
        ForeignKey("cities.city_key", ondelete="CASCADE"), index=True
    )
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    heat: Mapped[float | None] = mapped_column(Numeric(6, 2))
    severity_sum: Mapped[float | None] = mapped_column(Numeric(10, 2))
    article_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    dominant_issue: Mapped[str | None] = mapped_column(String(100))


class Keyword(Base):
    __tablename__ = "keywords"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    term: Mapped[str] = mapped_column(String(200))
    count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    sentiment: Mapped[str | None] = mapped_column(String(20))


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    question: Mapped[str] = mapped_column(Text)
    probability: Mapped[int | None] = mapped_column(Integer)
    answer_label: Mapped[str | None] = mapped_column(String(120))
    reasoning: Mapped[str | None] = mapped_column(Text)
    timeframe: Mapped[str | None] = mapped_column(String(80))
    tone: Mapped[str | None] = mapped_column(String(40))


class Insight(Base):
    __tablename__ = "insights"

    id: Mapped[int] = mapped_column(primary_key=True)
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    title: Mapped[str | None] = mapped_column(String(255))
    text: Mapped[str | None] = mapped_column(Text)
    action: Mapped[str | None] = mapped_column(Text)


class MarketTicker(Base):
    __tablename__ = "market_ticker"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    label: Mapped[str] = mapped_column(String(80))
    value: Mapped[str | None] = mapped_column(String(60))  # display string, e.g. "Rp 17.700"
    delta: Mapped[float | None] = mapped_column(Numeric(18, 6))  # signed % change
