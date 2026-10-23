import os

import httpx

BASE = "http://127.0.0.1:8001"
EMAIL = "test@example.com"
PASSWORD = "testpass123"

with httpx.Client(timeout=120) as c:
    r = c.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": PASSWORD})
    r.raise_for_status()
    headers = {"Authorization": "Bearer " + r.json()["token"]}
    job_text = open("job.txt", encoding="utf-8").read()
    if os.path.exists("resume_ml.pdf"):
        name = "resume_ml.pdf"
    elif os.path.exists("resume.txt"):
        name = "resume.txt"
    else:
        name = "resume.pdf"
    print("RESUME FILE USED:", name)
    if name.endswith(".txt"):
        r = c.post(
            f"{BASE}/analysis/quick",
            headers=headers,
            data={"job_text": job_text, "resume_text": open(name, encoding="utf-8").read()},
        )
    else:
        with open(name, "rb") as f:
            r = c.post(
                f"{BASE}/analysis/quick",
                headers=headers,
                files={"resume_file": (name, f, "application/pdf")},
                data={"job_text": job_text, "resume_text": ""},
            )
    r.raise_for_status()
    out = r.json()

res, job, a = out["resume"], out["job"], out["analysis"]
skills = res.get("skills") or []
print("PARSED RESUME: skill groups", len(skills),
      "| skill items", sum(len(g.get("items") or []) for g in skills if isinstance(g, dict)),
      "| experience", len(res.get("experience") or []),
      "| projects", len(res.get("projects") or []),
      "| bullets", sum(len(e.get("bullets") or []) for k in ("experience", "projects")
                       for e in (res.get(k) or []) if isinstance(e, dict)),
      "| summary chars", len(res.get("summary") or ""),
      "| headline chars", len(res.get("headline") or ""))
print("JOB TITLE:", job.get("title"))
print("JOB LISTS: required", len(job.get("required_skills") or []),
      "| tools", len(job.get("tools") or []),
      "| groups", [(g.get("label"), len(g.get("any_of") or []))
                   for g in (job.get("skill_groups") or []) if isinstance(g, dict)])
print("match", a["match_score"], "| ats", a["ats_score"], "| overall", a["overall"])
for name, tier in a["tiers"].items():
    cov = None if tier["coverage"] is None else round(tier["coverage"], 2)
    print(name.upper(), "coverage", cov)
    for t in tier["terms"]:
               print("   ", t["term"], "FOUND" if t["found"] else "missing", t["where"],
              ("via " + t["matched"]) if t.get("any_of") and t["found"] else "")
for f in a["fixes"]:
    print(" -", f["priority"], f["title"])