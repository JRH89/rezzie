from fastapi.testclient import TestClient

from rezzie.main import app

client = TestClient(app)


def test_health() -> None:
    assert client.get("/health").json() == {"status": "ok"}


def test_text_import_validates_minimum_length() -> None:
    response = client.post("/api/v1/job-descriptions/text", json={"text": "short"})
    assert response.status_code == 422


def test_resume_file_imports_plain_text() -> None:
    response = client.post("/api/v1/resumes/file", files={"file": ("resume.txt", b"Experienced engineer with measurable delivery experience." * 2, "text/plain")})
    assert response.status_code == 200
    assert response.json()["source_type"] == "file"


def test_subscription_route_requires_server_model_key() -> None:
    response = client.post("/api/v1/tailor", json={"resume_text": "a" * 50, "job_description": "b" * 50, "credential_mode": "subscription"})
    assert response.status_code == 503
