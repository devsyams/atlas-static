"""ATLAS ai-api — FastAPI application (skeleton).

The real assistant endpoints (chat / briefing / forecast / widget-ask) and the
model-agnostic LiteLLM layer arrive with features U1 and A4-A5. For now this exposes
only a health check, which is enough to prove the monorepo's dev/CI wiring end to end.
"""

from fastapi import FastAPI

app = FastAPI(title="ATLAS ai-api", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness probe used by docker-compose / App Platform health checks."""
    return {"status": "ok"}
