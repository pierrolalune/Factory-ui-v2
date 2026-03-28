import pytest


@pytest.mark.anyio
async def test_health_returns_ok(client):
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "2.0.0"


@pytest.mark.anyio
async def test_health_response_shape(client):
    response = await client.get("/api/health")
    data = response.json()
    assert set(data.keys()) == {"status", "version"}
