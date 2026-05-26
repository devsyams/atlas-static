"""Celery worker entrypoint (skeleton).

Ingestion connectors (features W1-W5) and LLM enrichment tasks (U1-U5) register here.
Wired up with the Celery + Redis stack in Sprint 3. Placeholder for now so the
process/component exists in the monorepo and infra topology.
"""


def main() -> None:
    raise SystemExit("worker not implemented yet — arrives with feature W1 (Sprint 3)")


if __name__ == "__main__":
    main()
