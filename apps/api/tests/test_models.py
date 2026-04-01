import pytest


async def test_list_models(client):
    resp = await client.get("/api/models")
    assert resp.status_code == 200
    models = resp.json()
    assert isinstance(models, list)
    assert len(models) > 0


async def test_models_have_required_fields(client):
    resp = await client.get("/api/models")
    for model in resp.json():
        assert "id" in model
        assert "label" in model
        assert "context_limit" in model
        assert isinstance(model["context_limit"], int)
        assert model["context_limit"] > 0


async def test_models_no_auth_required(client):
    # Public endpoint — no Authorization header needed
    resp = await client.get("/api/models")
    assert resp.status_code == 200
