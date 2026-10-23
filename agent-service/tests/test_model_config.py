from unittest.mock import patch
import pytest
from fastapi import HTTPException
from app.main import get_model


def test_model_deadline_meets_google_minimum_and_supports_private_test_endpoint(monkeypatch):
    get_model.cache_clear()
    monkeypatch.setenv("GEMINI_API_KEY", "synthetic-test-key")
    monkeypatch.setenv("AGENT_API_BASE_URL", "http://127.0.0.1:8001")
    try:
        with patch("langchain_google_genai.ChatGoogleGenerativeAI") as constructor:
            get_model()
            assert constructor.call_args.kwargs["timeout"] >= 10
            assert constructor.call_args.kwargs["base_url"] == "http://127.0.0.1:8001"
            assert constructor.call_args.kwargs["max_retries"] == 0
    finally:
        get_model.cache_clear()


def test_model_fails_closed_without_credentials(monkeypatch):
    get_model.cache_clear()
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with pytest.raises(HTTPException) as error:
        get_model()
    assert error.value.status_code == 503
