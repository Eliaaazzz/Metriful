from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage
import pytest
from app.main import app, get_model
from test_agent import ScriptedModel


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("AGENT_INTERNAL_KEY", "k" * 32)
    app.dependency_overrides[get_model] = lambda: ScriptedModel([AIMessage(content="Try one regular meal today.")])
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def payload():
    return {"message": "Help me build a habit", "date": "2026-10-23", "timeZone": "Australia/Sydney"}


def test_private_endpoint_and_success_shape(client):
    assert client.post("/v1/coach/runs", json=payload()).status_code == 401
    response = client.post("/v1/coach/runs", json=payload(), headers={"X-Agent-Key": "k" * 32})
    assert response.status_code == 200
    assert len(response.json()["runId"]) == 36
    assert response.json()["tools"][0]["name"] == "nutrition_today"
    assert client.get("/healthz").status_code == 200


def test_missing_internal_configuration_fails_closed(client, monkeypatch):
    monkeypatch.delenv("AGENT_INTERNAL_KEY")
    assert client.post("/v1/coach/runs", json=payload()).status_code == 503


def test_provider_failure_does_not_expose_health_or_prompt(client, monkeypatch, caplog):
    async def fail(*args):
        raise RuntimeError("private health data and prompt")
    monkeypatch.setattr("app.main.run_agent", fail)
    response = client.post("/v1/coach/runs", json=payload(), headers={"X-Agent-Key": "k" * 32})
    assert response.status_code == 503
    assert "private health" not in response.text + caplog.text
