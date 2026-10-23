import os
import uuid

os.environ["DATABASE_URL"] = "sqlite:///./test_shortlist.db"
if os.path.exists("test_shortlist.db"):
    os.remove("test_shortlist.db")

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from guard import finalize  # noqa: E402
from scoring import found_in  # noqa: E402

client = TestClient(main.app)


def signup():
    email = f"user{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/auth/register", json={"email": email, "password": "testpass123"})
    assert r.status_code == 200
    return {"Authorization": "Bearer " + r.json()["token"]}


def test_excel_file_format_is_not_an_excel_skill():
    assert not found_in("Excel", "bulk (CSV/Excel) analysis")
    assert found_in("Excel", "Built dashboards in Excel")


def test_google_cloud_apis_are_not_gcp_experience():
    assert not found_in("GCP", "Google Cloud (Drive/Sheets APIs)")
    assert found_in("GCP", "Deployed services on GCP")


def test_matching_ignores_line_breaks_and_hyphens():
    assert found_in("machine learning", "applied machine\nlearning systems")
    assert found_in("scikit-learn", "models built with scikit learn")


ORIGINAL = {
    "summary": "Student who builds machine learning systems in Python.",
    "skills": [
        {"group": "ML", "items": ["Python", "scikit-learn"]},
        {"group": "Tools", "items": ["Git", "Docker"]},
    ],
    "experience": [],
    "projects": [
        {
            "name": "Fraud",
            "bullets": [
                "Built a fraud detection system as part of a 4-member capstone team.",
                "Diagnosed class imbalance in the claims data.",
            ],
        }
    ],
}


def rewritten():
    return {
        "summary": "Engineer with NLP experience. Builds machine learning systems in Python.",
        "skills": [{"group": "ML", "items": ["Python", "scikit\u2011learn"]}],
        "experience": [],
        "projects": [
            {
                "name": "Fraud",
                "bullets": [
                    "Developed a fraud detection model.",
                    "Diagnosed class imbalance in the claims data using PyTorch.",
                ],
            }
        ],
    }


def test_guard_removes_invented_claims():
    out, flags, reverted = finalize(ORIGINAL, rewritten(), "")
    assert "NLP" not in out["summary"]
    bullets = out["projects"][0]["bullets"]
    assert not any("PyTorch" in b for b in bullets)
    assert flags == []
    assert reverted >= 2


def test_guard_restores_bullet_with_number():
    out, _flags, _reverted = finalize(ORIGINAL, rewritten(), "")
    assert any("4-member" in b for b in out["projects"][0]["bullets"])


def test_guard_keeps_every_original_skill_group():
    out, _flags, _reverted = finalize(ORIGINAL, rewritten(), "")
    groups = {g["group"] for g in out["skills"]}
    assert {"ML", "Tools"} <= groups
    items = [i for g in out["skills"] for i in g["items"]]
    assert "Docker" in items


def test_guard_uses_plain_hyphens_and_softens_overclaims():
    res = rewritten()
    res["summary"] = "Proven expertise in Python and scikit\u2011learn."
    out, _flags, _reverted = finalize(ORIGINAL, res, "")
    assert "\u2011" not in str(out)
    assert "Proven" not in out["summary"]


def test_sign_in_is_required():
    assert client.get("/library").status_code == 401
    assert client.post("/export/docx", json={"resume": {}}).status_code == 401


def test_duplicate_email_is_rejected():
    email = f"dup{uuid.uuid4().hex[:8]}@example.com"
    body = {"email": email, "password": "testpass123"}
    assert client.post("/auth/register", json=body).status_code == 200
    assert client.post("/auth/register", json=body).status_code == 409


def test_users_cannot_see_each_others_saved_results():
    a, b = signup(), signup()
    body = {
        "job": {"title": "ML Intern", "company": "Test Co", "text": "Fictional posting."},
        "original": {"name": "Asha"},
        "tailored": {"name": "Asha", "summary": "Tailored"},
        "template": "technical",
        "role": "ai_ml",
        "before": {"overall": 40},
        "after": {"overall": 45},
        "changes": [],
    }
    saved = client.post("/library/save", headers=a, json=body)
    assert saved.status_code == 200
    rid = saved.json()["id"]
    assert client.get(f"/library/{rid}", headers=a).status_code == 200
    assert client.get(f"/library/{rid}", headers=b).status_code == 404
    assert client.delete(f"/library/{rid}", headers=b).status_code == 404
    assert client.get("/library", headers=b).json() == []


def test_export_refuses_leftover_markers_and_exports_clean_resume():
    h = signup()
    res = {
        "name": "Asha Verma",
        "summary": "Student.",
        "skills": [],
        "experience": [],
        "projects": [
            {"name": "P", "tech": "Python", "bullets": ["Trained a model [add a number]"]}
        ],
        "education": [],
    }
    r = client.post("/export/docx", headers=h, json={"resume": res, "template": "technical"})
    assert r.status_code == 400
    res["projects"][0]["bullets"] = ["Trained a model."]
    r = client.post("/export/docx", headers=h, json={"resume": res, "template": "technical"})
    assert r.status_code == 200
    assert r.content[:2] == b"PK"


def test_ai_routes_are_rate_limited_per_user():
    h = signup()
    codes = [
        client.post("/jobs/parse", headers=h, data={"text": "short"}).status_code
        for _ in range(7)
    ]
    assert codes[:6] == [400] * 6
    assert codes[6] == 429
    other = signup()
    assert client.post("/jobs/parse", headers=other, data={"text": "short"}).status_code == 400