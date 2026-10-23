import httpx

BASE = "http://127.0.0.1:8001"
EMAIL = "test@example.com"
PASSWORD = "testpass123"

resume = {
    "name": "Asha Verma",
    "headline": "Machine Learning Engineer",
    "contact": {
        "email": "asha.verma@example.com",
        "phone": "+91 90000 00000",
        "location": "Hyderabad, India",
        "links": ["github.com/ashaverma-demo"],
    },
    "summary": "Final-year AI student who builds machine learning systems in Python.",
    "skills": [
        {"group": "Languages", "items": ["Python", "SQL"]},
        {"group": "ML", "items": ["scikit-learn", "pandas"]},
    ],
    "experience": [
        {
            "title": "Data Intern",
            "company": "Example Analytics",
            "location": "",
            "dates": "Jan 2025 - Mar 2025",
            "bullets": ["Cleaned and analysed sales data with pandas."],
        }
    ],
    "projects": [
        {
            "name": "Fraud Detection",
            "tech": "Python, scikit-learn",
            "bullets": ["Trained a random forest model to flag unusual claims [add a number]"],
        }
    ],
    "education": [
        {
            "school": "Example Institute",
            "degree": "B.Tech, AI and Data Science",
            "dates": "2022 - 2026",
            "details": "",
        }
    ],
    "certifications": [],
}

with httpx.Client(timeout=60) as c:
    r = c.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": PASSWORD})
    r.raise_for_status()
    h = {"Authorization": "Bearer " + r.json()["token"]}

    r = c.post(f"{BASE}/export/docx", headers=h, json={"resume": resume, "template": "technical"})
    print("WITH MARKER:", r.status_code, r.json().get("detail"))

    resume["projects"][0]["bullets"] = ["Trained a random forest model to flag unusual claims."]
    r = c.post(f"{BASE}/export/docx", headers=h, json={"resume": resume, "template": "technical"})
    print("CLEAN:", r.status_code, r.headers.get("content-disposition"), len(r.content), "bytes")
    if r.status_code == 200:
        open("test_resume.docx", "wb").write(r.content)
        print("Saved test_resume.docx. File type OK:", r.content[:2] == b"PK")