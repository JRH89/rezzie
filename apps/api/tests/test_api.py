from fastapi.testclient import TestClient

from rezzie.main import app

client = TestClient(app)
LOCAL_IDENTITY = {"X-Rezzie-User-Id": "test-user"}


def test_health() -> None:
    assert client.get("/health").json() == {"status": "ok"}


def test_health_emits_security_headers() -> None:
    response = client.get("/health")
    assert response.headers["x-content-type-options"] == "nosniff"


def test_cors_preflight_allows_career_fact_updates() -> None:
    response = client.options(
        "/api/v1/career-records/record-1/facts/fact-1",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "PATCH"},
    )
    assert response.status_code == 200
    assert "PATCH" in response.headers["access-control-allow-methods"]


def test_text_import_validates_minimum_length() -> None:
    response = client.post("/api/v1/job-descriptions/text", headers=LOCAL_IDENTITY, json={"text": "short"})
    assert response.status_code == 422


def test_resume_file_imports_plain_text() -> None:
    response = client.post("/api/v1/resumes/file", headers=LOCAL_IDENTITY, files={"file": ("resume.txt", b"Experienced engineer with measurable delivery experience." * 2, "text/plain")})
    assert response.status_code == 200
    assert response.json()["source_type"] == "file"


def test_resume_export_returns_an_editable_docx() -> None:
    response = client.post(
        "/api/v1/resumes/export",
        headers=LOCAL_IDENTITY,
        json={"resume_text": "Taylor Example\ntaylor@example.com | Portland, OR\n\nEXPERIENCE\nAcme Corp | Engineer\n- Delivered reliable systems."},
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    assert response.headers["cache-control"] == "no-store"
    assert response.content[:2] == b"PK"


def test_resume_export_returns_a_pdf() -> None:
    response = client.post(
        "/api/v1/resumes/export/pdf",
        headers=LOCAL_IDENTITY,
        json={"resume_text": "Taylor Example\ntaylor@example.com | Portland, OR\n\nEXPERIENCE\nAcme Corp | Engineer\n- Delivered reliable systems."},
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/pdf")
    assert response.headers["cache-control"] == "no-store"
    assert response.content.startswith(b"%PDF")


def test_billing_balance_requires_identity() -> None:
    assert client.get("/api/v1/billing/me").status_code == 401


def test_billing_balance_uses_local_development_identity() -> None:
    response = client.get("/api/v1/billing/me", headers={"X-Rezzie-User-Id": "local-user"})
    assert response.status_code == 200
    assert response.json()["purchased_credits"] == 0


def test_subscription_route_requires_server_model_key() -> None:
    response = client.post("/api/v1/tailor", json={"resume_text": "a" * 50, "job_description": "b" * 50, "credential_mode": "subscription"})
    assert response.status_code == 503
