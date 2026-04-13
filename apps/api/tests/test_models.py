import os
import pytest


async def test_list_models(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    resp = await client.get("/api/models")
    assert resp.status_code == 200
    models = resp.json()
    assert isinstance(models, list)
    assert len(models) > 0


async def test_models_have_required_fields(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    resp = await client.get("/api/models")
    for model in resp.json():
        assert "id" in model
        assert "label" in model
        assert "provider" in model
        assert model["provider"] in ("google", "openai", "anthropic")
        assert "context_limit" in model
        assert isinstance(model["context_limit"], int)
        assert model["context_limit"] > 0


async def test_models_filtered_by_env(client, monkeypatch):
    """Модели без API-ключа не должны возвращаться."""
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    resp = await client.get("/api/models")
    providers = {m["provider"] for m in resp.json()}
    assert "openai" not in providers
    assert "anthropic" not in providers
    assert "google" in providers


async def test_models_all_providers(client, monkeypatch):
    """При наличии всех ключей — возвращаются все провайдеры."""
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    resp = await client.get("/api/models")
    providers = {m["provider"] for m in resp.json()}
    assert providers == {"google", "openai", "anthropic"}


async def test_models_no_auth_required(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    resp = await client.get("/api/models")
    assert resp.status_code == 200
