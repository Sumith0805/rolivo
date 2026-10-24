import os
import sys

import httpx

BASE = os.getenv("API_BASE", "http://127.0.0.1:8001")
EMAIL = "test@example.com"
PASSWORD = "TestPass12345"

job_path = sys.argv[1] if len(sys.argv) > 1 else "job.txt"
facts = open("facts.txt", encoding="utf-8").read() if os.path.exists("facts.txt") else ""
resume_name = "resume_ml.pdf" if os.path.exists("resume_ml.pdf") else "resume.pdf"

print("USING", BASE)

with httpx.Client(timeout=240) as c:
    # Create the test user if it does not exist yet (an error here is fine)
    r = c.post(f"{BASE}/auth/register", json={"email": EMAIL, "password": PASSWORD})
    print("REGISTER", r.status_code, "(200 = created, other = already exists)")

    r = c.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": PASSWORD})
    r.raise_for_status()
    headers = {"Authorization": "Bearer " + r.json()["token"]}
    with open(resume_name, "rb") as f:
        r = c.post(
            f"{BASE}/rewrite/quick",
            headers=headers,
            files={"resume_file": (resume_name, f, "application/pdf")},
            data={"job_text": open(job_path, encoding="utf-8").read(), "resume_text": "", "facts": facts},
        )
    if r.status_code != 200:
        print("FAILED", r.status_code, r.text[:300])
        sys.exit(1)
    out = r.json()

print("ROLE:", out["role"]["label"], out["role"]["confidence"], "| TEMPLATE:", out["template"]["label"])
print("BEFORE:", out["before"])
print("AFTER: ", out["after"])
print("CHANGES:")
for ch in out["changes"]:
    print(" -", ch)
chk = out["check"]
print("CHECK passed:", chk["passed"], "| repaired:", chk["repaired"], "| placeholders:", chk["placeholders"])
print("REMOVED SKILLS:", chk["removed_skills"])
for fl in chk["flags"]:
    print(" FLAG", fl["type"], fl["value"], "in", fl["where"])
for n in chk["notes"]:
    print(" NOTE", n)

before, after = set(out["before_fixes"]), set(out["after_fixes"])
print("NEW PROBLEMS AFTER REWRITE:", [x for x in out["after_fixes"] if x not in before] or "none")
print("FIXED BY REWRITE:", [x for x in out["before_fixes"] if x not in after] or "none")

res = out["resume"]
cn = res.get("contact") or {}
lines = [res.get("name", ""), res.get("headline", "")]
lines.append(" | ".join(x for x in [cn.get("email"), cn.get("phone"), cn.get("location")] + list(cn.get("links") or []) if x))
for sec in out["template"]["order"]:
    if sec == "summary" and res.get("summary"):
        lines += ["", "SUMMARY", res["summary"]]
    elif sec == "skills" and res.get("skills"):
        lines += ["", "SKILLS"] + [f'{g["group"]}: {", ".join(g["items"])}' for g in res["skills"]]
    elif sec == "experience" and res.get("experience"):
        lines += ["", "EXPERIENCE"]
        for e in res["experience"]:
            lines.append(f'{e.get("title", "")} - {e.get("company", "")}  {e.get("dates", "")}')
            lines += ["- " + b for b in e["bullets"]]
    elif sec == "projects" and res.get("projects"):
        lines += ["", "PROJECTS"]
        for p in res["projects"]:
            lines.append(f'{p.get("name", "")} | {p.get("tech", "")}')
            lines += ["- " + b for b in p["bullets"]]
    elif sec == "education" and res.get("education"):
        lines += ["", "EDUCATION"]
        for e in res["education"]:
            lines.append(f'{e.get("degree", "")}, {e.get("school", "")}  {e.get("dates", "")}  {e.get("details", "")}')
    elif sec == "certifications" and res.get("certifications"):
        lines += ["", "CERTIFICATIONS"] + [str(x) for x in res["certifications"]]
open("rewritten.txt", "w", encoding="utf-8").write("\n".join(lines))
print("Saved the rewritten resume to rewritten.txt")