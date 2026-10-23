import csv
import glob
import os
import re
import time

import httpx

BASE = "http://127.0.0.1:8001"
EMAIL = "test@example.com"
PASSWORD = "testpass123"
RESUME = "resume_ml.pdf"

rows = []
with httpx.Client(timeout=300) as c:
    r = c.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": PASSWORD})
    r.raise_for_status()
    headers = {"Authorization": "Bearer " + r.json()["token"]}
    for path in sorted(glob.glob(os.path.join("jobs", "*.txt"))):
        name = os.path.basename(path)
        expected = name.rsplit("_", 1)[0]
        job_text = open(path, encoding="utf-8").read()
        out = None
        for attempt in range(3):
            with open(RESUME, "rb") as f:
                r = c.post(
                    f"{BASE}/rewrite/quick",
                    headers=headers,
                    files={"resume_file": (RESUME, f, "application/pdf")},
                    data={"job_text": job_text, "resume_text": ""},
                )
            if r.status_code == 200:
                out = r.json()
                break
            print(name, "status", r.status_code, "- waiting 60 seconds")
            time.sleep(60)
        if out is None:
            print(name, "FAILED")
            continue
        chk = out["check"]
        reverted = sum(
            int(m.group(1))
            for n in chk["notes"]
            for m in [re.match(r"Reverted (\d+)", n)]
            if m
        )
        row = {
            "job": name,
            "role_ok": out["role"]["id"] == expected,
            "match_before": out["before"]["match"],
            "match_after": out["after"]["match"],
            "ats_before": out["before"]["ats"],
            "ats_after": out["after"]["ats"],
            "skills_removed": len(chk["removed_skills"]),
            "items_reverted": reverted,
            "flags_left": len(chk["flags"]),
            "placeholders": chk["placeholders"],
        }
        rows.append(row)
        print(row)
        time.sleep(15)

if rows:
    with open("results.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    n = len(rows)

    def avg(key):
        return round(sum(r[key] or 0 for r in rows) / n, 1)

    print("RUNS:", n)
    print("ROLE DETECTED CORRECTLY:", sum(r["role_ok"] for r in rows), "of", n)
    print("AVERAGE MATCH:", avg("match_before"), "->", avg("match_after"))
    print("AVERAGE ATS:", avg("ats_before"), "->", avg("ats_after"))
    print("INVENTED SKILLS REMOVED:", sum(r["skills_removed"] for r in rows))
    print("ITEMS REVERTED TO YOUR WORDING:", sum(r["items_reverted"] for r in rows))
    print("RUNS WITH ANY UNSUPPORTED ITEM LEFT:", sum(1 for r in rows if r["flags_left"]), "of", n)
    print("Saved results.csv")