import os

import httpx

BASE = os.getenv("API_BASE", "http://127.0.0.1:8001")
EMAIL = "test@example.com"
PASSWORD = "TestPass12345"

body = {
    "job": {"title": "ML Intern", "company": "Test Co", "text": "Fictional posting text."},
    "original": {"name": "Asha Verma", "summary": "Original summary."},
    "tailored": {
        "name": "Asha Verma",
        "summary": "Tailored summary.",
        "skills": [],
        "projects": [],
        "experience": [],
    },
    "template": "projects_first",
    "role": "ai_ml",
    "before": {"match": 30, "ats": 90, "overall": 45},
    "after": {"match": 33, "ats": 94, "overall": 48},
    "changes": ["Rewrote the summary."],
}

print("USING", BASE)

with httpx.Client(timeout=90) as c:
    # Create the test user if it does not exist yet (an error here is fine)
    r = c.post(f"{BASE}/auth/register", json={"email": EMAIL, "password": PASSWORD})
    print("REGISTER", r.status_code, "(200 = created, other = already exists)")

    r = c.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": PASSWORD})
    r.raise_for_status()
    h = {"Authorization": "Bearer " + r.json()["token"]}

    r = c.post(f"{BASE}/library/save", headers=h, json=body)
    print("SAVE", r.status_code, r.json())
    sid = r.json()["id"]

    r = c.get(f"{BASE}/library", headers=h)
    print("LIST", r.status_code, len(r.json()), "item(s); first:", r.json()[0]["job_title"])

    r = c.get(f"{BASE}/library/{sid}", headers=h)
    print("OPEN", r.status_code, r.json()["tailored"]["summary"])

    edit = {
        "resume": {**body["tailored"], "summary": "Edited summary."},
        "template": "technical",
    }
    r = c.put(f"{BASE}/library/{sid}", headers=h, json=edit)
    print("EDIT", r.status_code)
    r = c.get(f"{BASE}/library/{sid}", headers=h)
    print("AFTER EDIT", r.json()["tailored"]["summary"], "|", r.json()["template"])

    r = c.delete(f"{BASE}/library/{sid}", headers=h)
    print("DELETE", r.status_code)
    r = c.get(f"{BASE}/library", headers=h)
    print("LIST AFTER DELETE", len(r.json()), "item(s)")
    r = c.get(f"{BASE}/library/{sid}", headers=h)
    print("OPEN AFTER DELETE", r.status_code, "(404 is correct)")