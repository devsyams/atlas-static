"""P3 AC1: the Alembic migration produces every spec §9 table with key indexes,
and the migration round-trips (upgrade -> downgrade -> upgrade)."""

from alembic import command
from sqlalchemy import create_engine, inspect

EXPECTED_TABLES = {
    # identity & access
    "users", "sessions", "audit_log",
    # sources & content
    "sources", "articles", "article_enrichment",
    # aggregates / dashboard
    "crisis_snapshots", "cities", "city_metrics", "keywords",
    "predictions", "insights", "market_ticker",
    # social & leadership
    "social_actors", "actor_posts", "leaders", "leader_sentiment", "leader_articles",
    # assistant & UX
    "ai_conversations", "ai_messages", "dashboard_layouts",
}


def test_all_spec_tables_exist(migrated_db):
    tables = set(inspect(migrated_db).get_table_names())
    missing = EXPECTED_TABLES - tables
    assert not missing, f"missing tables: {sorted(missing)}"


def test_articles_have_fts_gin_index(migrated_db):
    names = {ix["name"] for ix in inspect(migrated_db).get_indexes("articles")}
    assert "ix_articles_fts" in names, f"FTS index missing; have {names}"


def test_crisis_snapshots_time_series_index(migrated_db):
    indexed = {tuple(ix["column_names"]) for ix in inspect(migrated_db).get_indexes("crisis_snapshots")}
    assert ("captured_at",) in indexed, f"captured_at index missing; have {indexed}"


def test_articles_url_is_unique(migrated_db):
    insp = inspect(migrated_db)
    unique = {tuple(uc["column_names"]) for uc in insp.get_unique_constraints("articles")}
    unique |= {tuple(ix["column_names"]) for ix in insp.get_indexes("articles") if ix.get("unique")}
    assert ("url",) in unique, f"articles.url not unique; have {unique}"


def test_migration_round_trips(migrated_db, alembic_config, db_url):
    command.downgrade(alembic_config, "base")
    left = set(inspect(create_engine(db_url)).get_table_names())
    assert not (EXPECTED_TABLES & left), f"tables remain after downgrade: {EXPECTED_TABLES & left}"
    command.upgrade(alembic_config, "head")  # restore head for any later use
