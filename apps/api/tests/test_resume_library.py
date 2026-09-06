from fastapi.testclient import TestClient

from rezzie.main import app, billing_repository

client = TestClient(app)
SOURCE = "Taylor Example\ntaylor@example.com\n\nEXPERIENCE\n- Built reliable systems for customers."


def headers(user_id: str) -> dict[str, str]:
    return {"X-Rezzie-User-Id": user_id}


def save(user_id: str, label: str = "Primary resume", source_text: str = SOURCE):
    return client.post("/api/v1/resumes", headers=headers(user_id), json={"label": label, "source_text": source_text})


def test_saved_resume_is_private_and_versioned() -> None:
    created = save("resume-owner")
    assert created.status_code == 201
    resume = created.json()
    assert resume["label"] == "Primary resume"
    assert resume["source_text"] == SOURCE
    assert resume["version_id"]

    assert client.get("/api/v1/resumes", headers=headers("other-user")).json() == []
    assert client.get(f"/api/v1/resumes/{resume['id']}", headers=headers("other-user")).status_code == 404

    new_source = f"{SOURCE}\n- Improved the release process."
    version = client.post(f"/api/v1/resumes/{resume['id']}/versions", headers=headers("resume-owner"), json={"source_text": new_source})
    assert version.status_code == 201
    assert version.json()["version_id"] != resume["version_id"]
    assert version.json()["source_text"] == new_source


def test_free_library_limit_and_delete() -> None:
    first = save("free-library-user")
    assert first.status_code == 201
    blocked = save("free-library-user", label="Second resume")
    assert blocked.status_code == 409
    assert "up to 1 resume" in blocked.json()["detail"]

    deleted = client.delete(f"/api/v1/resumes/{first.json()['id']}", headers=headers("free-library-user"))
    assert deleted.status_code == 204
    assert save("free-library-user", label="Replacement").status_code == 201


def test_paid_credit_balance_allows_more_saved_resumes() -> None:
    user_id = "paid-library-user"
    billing_repository.grant_purchase_once(user_id, "resume-library-test-grant", 20)
    for index in range(5):
        assert save(user_id, label=f"Resume {index + 1}").status_code == 201
    assert save(user_id, label="Sixth resume").status_code == 409


def test_saved_drafts_are_private_and_limited() -> None:
    user_id = "draft-owner"
    body = {"label": "Platform role", "tailored_resume": SOURCE, "resume_html": "<p>Safe saved text</p>"}
    created = client.post("/api/v1/tailoring-drafts", headers=headers(user_id), json=body)
    assert created.status_code == 201
    draft = created.json()
    assert draft["label"] == "Platform role"
    assert client.get("/api/v1/tailoring-drafts", headers=headers("other-draft-user")).json() == []
    assert client.get(f"/api/v1/tailoring-drafts/{draft['id']}", headers=headers("other-draft-user")).status_code == 404

    for index in range(2):
        assert client.post("/api/v1/tailoring-drafts", headers=headers(user_id), json={**body, "label": f"Draft {index}"}).status_code == 201
    assert client.post("/api/v1/tailoring-drafts", headers=headers(user_id), json={**body, "label": "Too many"}).status_code == 409
    assert client.delete(f"/api/v1/tailoring-drafts/{draft['id']}", headers=headers(user_id)).status_code == 204
