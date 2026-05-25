import os

import psycopg
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine

PG_HOST = os.environ.get("PGHOST", "127.0.0.1")
PG_PORT = os.environ.get("PGPORT", "55432")
ADMIN_DSN = f"host={PG_HOST} port={PG_PORT} dbname=atlas user=atlas password=atlas"
TEST_DB = "atlas_test"
TEST_URL = f"postgresql+psycopg://atlas:atlas@{PG_HOST}:{PG_PORT}/{TEST_DB}"
PIPELINE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _alembic_cfg() -> Config:
    cfg = Config(os.path.join(PIPELINE_DIR, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(PIPELINE_DIR, "db", "migrations"))
    return cfg


@pytest.fixture(scope="session")
def db_url() -> str:
    return TEST_URL


@pytest.fixture
def alembic_config() -> Config:
    return _alembic_cfg()


@pytest.fixture(scope="session")
def migrated_db():
    """Recreate a clean test database and run all migrations up to head."""
    with psycopg.connect(ADMIN_DSN, autocommit=True) as conn:
        conn.execute(f"DROP DATABASE IF EXISTS {TEST_DB} WITH (FORCE)")
        conn.execute(f"CREATE DATABASE {TEST_DB}")
    os.environ["DATABASE_URL"] = TEST_URL
    command.upgrade(_alembic_cfg(), "head")
    engine = create_engine(TEST_URL)
    yield engine
    engine.dispose()
