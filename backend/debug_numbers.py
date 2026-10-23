import rewrite as R
import jobs
import resumes
from llm import ask_json
from parsing import clean, text_from_upload
from roles import detect

pdf = open("resume_ml.pdf", "rb").read()
raw = text_from_upload("resume_ml.pdf", pdf)
job_raw = clean(open("jobs/ai_ml_1.txt", encoding="utf-8").read())
resume = ask_json(resumes.SYSTEM, raw)
job = ask_json(jobs.SYSTEM, job_raw)
rid = detect(job_raw)[0]
payload = R.build_payload(resume, job, rid, "")
ai = ask_json(R.SYSTEM, payload, max_tokens=6000)
final, removed, notes = R.enforce(resume, ai)


def digits(bullets):
    return [b for b in bullets if any(c.isdigit() for c in b)]


print("limits module:", R.limit_bullets.__module__)
for o, f in zip(resume.get("projects", []), final["projects"]):
    print("PROJECT:", o.get("name"))
    print("  original bullets:", len(o.get("bullets", [])))
    print("  original with digits:", digits(o.get("bullets", [])))
    print("  final bullets:", len(f["bullets"]))
    print("  final with digits:", digits(f["bullets"]))
print("AI project names:", [p.get("name") for p in ai.get("projects", [])])
print("AI bullets with digits:", [digits(p.get("bullets", [])) for p in ai.get("projects", [])])