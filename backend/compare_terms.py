import jobs
import resumes
import rewrite as R
from llm import ask_json
from parsing import clean, text_from_upload
from roles import detect
from scoring import analyze

JOB = "jobs/data_1.txt"
raw = text_from_upload("resume_ml.pdf", open("resume_ml.pdf", "rb").read())
job_raw = clean(open(JOB, encoding="utf-8").read())
resume = ask_json(resumes.SYSTEM, raw)
job = ask_json(jobs.SYSTEM, job_raw)
rid = detect(job_raw)[0]
result, changes, report = R.generate(resume, job, rid, "")
b = analyze(resume, job)
a = analyze(result, job)
print("MATCH BEFORE", b["match_score"], "AFTER", a["match_score"])


def terms(an):
    out = {}
    for tier, data in an["tiers"].items():
        for t in data["terms"]:
            out[(tier, t["term"])] = (t["credit"], tuple(t["where"]))
    return out


tb, ta = terms(b), terms(a)
print("TERMS THAT CHANGED:")
for key in tb:
    if tb[key] != ta.get(key):
        print(" ", key, "BEFORE", tb[key], "AFTER", ta.get(key))
print("COVERAGE BEFORE:", {k: v["coverage"] for k, v in b["tiers"].items()})
print("COVERAGE AFTER: ", {k: v["coverage"] for k, v in a["tiers"].items()})
n_b = sum(len(g.get("items") or []) for g in resume.get("skills") or [])
n_a = sum(len(g.get("items") or []) for g in result.get("skills") or [])
print("SKILL ITEMS BEFORE/AFTER:", n_b, n_a)
print("JOB TERMS:", {t: [x["term"] for x in d["terms"]] for t, d in b["tiers"].items()})