"""Rewrite-quality test. Run it yourself: it uses your own Groq key from .env.

    python eval_v13.py my_resumes my_jobs

my_resumes: a folder of resume files (.pdf, .docx or .txt)
my_jobs:    a folder of job postings saved as .txt files
It rewrites every resume for every job (keep it small: 3 resumes x 4 jobs is plenty), then prints
what was measured and writes eval_results.csv. Only these measured numbers belong on a resume or README.
"""
import csv
import sys
import time
from pathlib import Path

import jobs
import links
import resumes
import rewrite
from llm import ask_json
from parsing import text_from_upload
from roles import detect
from scoring import analyze, ats_checks, flatten

PAUSE = 12  # seconds between runs, to stay inside Groq's free limits


def load_resume(path):
    data = path.read_bytes()
    raw = links.add_block(text_from_upload(path.name, data), path.name, data)
    parsed = ask_json(resumes.SYSTEM, raw)
    links.apply_links(parsed, raw)
    return parsed


def main(resume_dir, job_dir):
    resume_files = sorted(p for p in Path(resume_dir).iterdir() if p.suffix.lower() in (".pdf", ".docx", ".txt"))
    job_files = sorted(p for p in Path(job_dir).iterdir() if p.suffix.lower() == ".txt")
    if not resume_files or not job_files:
        print("Put at least one resume and one .txt job posting in the folders.")
        return
    rows = []
    parsed_resumes = {}
    for rf in resume_files:
        parsed_resumes[rf.name] = load_resume(rf)
        time.sleep(PAUSE)
    for jf in job_files:
        job_raw = jf.read_text(encoding="utf-8", errors="ignore")
        job = ask_json(jobs.SYSTEM, job_raw)
        rid, _conf, _ranked = detect(job_raw)
        for name, resume in parsed_resumes.items():
            started = time.time()
            try:
                result, _changes, report = rewrite.generate(resume, job, rid, "")
                links.restore_links(resume, result)
            except Exception as err:
                print("FAILED", name, jf.name, err)
                rows.append({"resume": name, "job": jf.name, "role": rid, "error": str(err)[:80]})
                time.sleep(PAUSE)
                continue
            before = analyze(resume, job)
            after = analyze(result, job)
            ats_after = ats_checks(result)[1]
            orig_text = "\n".join(flatten(resume))
            unsupported = rewrite.check(orig_text, "", result)
            def n_links(r):
                c = r.get("contact") or {}
                return len(c.get("links") or []) + sum(1 for k in ("projects", "experience") for e in (r.get(k) or []) if e.get("link"))
            rows.append({
                "resume": name,
                "job": jf.name,
                "role": rid,
                "match_before": before["match_score"],
                "match_after": after["match_score"],
                "ats_before": before["ats_score"],
                "ats_after": ats_after,
                "ats_90_plus": ats_after >= 90,
                "unsupported_left": len(unsupported),
                "guard_removed_skills": len(report.get("removed_skills") or []),
                "number_markers": report.get("placeholders", 0),
                "links_before": n_links(resume),
                "links_after": n_links(result),
                "seconds": round(time.time() - started),
                "error": "",
            })
            print(rows[-1])
            time.sleep(PAUSE)

    good = [r for r in rows if not r.get("error")]
    if good:
        n = len(good)
        print("\n----- RESULTS (" + str(n) + " runs) -----")
        print("ATS readiness 90+ in", sum(1 for r in good if r["ats_90_plus"]), "of", n, "runs")
        print("Average ATS before/after:", round(sum(r["ats_before"] for r in good) / n), "->", round(sum(r["ats_after"] for r in good) / n))
        print("Average match before/after:", round(sum(r["match_before"] or 0 for r in good) / n), "->", round(sum(r["match_after"] or 0 for r in good) / n))
        print("Runs with unsupported items left:", sum(1 for r in good if r["unsupported_left"]), "of", n)
        print("Runs that lost a link:", sum(1 for r in good if r["links_after"] < r["links_before"]), "of", n)
    keys = sorted({k for r in rows for k in r})
    with open("eval_results.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        w.writerows(rows)
    print("Saved eval_results.csv")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python eval_v13.py <resume folder> <job folder>")
    else:
        main(sys.argv[1], sys.argv[2])
