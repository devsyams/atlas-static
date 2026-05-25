"""Import every model so ``Base.metadata`` is complete for Alembic autogenerate."""

from db.models.aggregates import (
    City,
    CityMetric,
    CrisisSnapshot,
    Insight,
    Keyword,
    MarketTicker,
    Prediction,
)
from db.models.assistant import AiConversation, AiMessage, DashboardLayout
from db.models.content import Article, ArticleEnrichment, Source
from db.models.identity import AuditLog, Session, User
from db.models.social import ActorPost, Leader, LeaderArticle, LeaderSentiment, SocialActor

__all__ = [
    "User",
    "Session",
    "AuditLog",
    "Source",
    "Article",
    "ArticleEnrichment",
    "CrisisSnapshot",
    "City",
    "CityMetric",
    "Keyword",
    "Prediction",
    "Insight",
    "MarketTicker",
    "SocialActor",
    "ActorPost",
    "Leader",
    "LeaderSentiment",
    "LeaderArticle",
    "AiConversation",
    "AiMessage",
    "DashboardLayout",
]
