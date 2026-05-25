from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Declarative base. Alembic is the single source of schema truth (spec §4);
    the TS side reads this schema read-only via kysely-codegen."""
