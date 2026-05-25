"""Assistant & UX state (spec §9.1): conversations, messages (cost ledger), layouts."""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class AiConversation(Base):
    __tablename__ = "ai_conversations"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AiMessage(Base):
    __tablename__ = "ai_messages"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("ai_conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(20))  # user | assistant | system
    content: Mapped[str | None] = mapped_column(Text)
    model: Mapped[str | None] = mapped_column(String(100))
    tokens: Mapped[int | None] = mapped_column(Integer)
    cost: Mapped[float | None] = mapped_column(Numeric(10, 6))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DashboardLayout(Base):
    __tablename__ = "dashboard_layouts"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    layout: Mapped[dict] = mapped_column("layout_jsonb", JSONB)
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
