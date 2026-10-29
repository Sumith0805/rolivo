from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel

import links
import resumes
import rewrite
from auth import current_user
from db import User
from llm import ask_json
from parsing import clean, text_from_upload
from ratelimit import ai_limit
from scoring import ats_checks, flatten, lst, s

# ATS readiness on its own: how cleanly an applicant tracking system can read a resume.
# It needs no job posting. /ats/score is plain arithmetic (no AI call), so it is quick and unlimited.
router = APIRouter(prefix="/ats", tags=["ats"])

TARGET = 90
MARKER = "[add a number]"
CREDIT = {"pass": 1.0, "warn": 0.5, "fail": 0.0}


def report(resume):
    resume = resume if isinstance(resume, dict) else {}
    checks, score = ats_checks(resume)
    holding = []
    for c in checks:
        if c["status"] != "pass":
            holding.append(
                {
                    "id": c["id"],
                    "label": c["label"],
                    "status": c["status"],
                    "detail": c["detail"],
                    "fix": c["fix"],
                    "points": round(c["weight"] * (1 - CREDIT[c["status"]])),
                }
            )
    holding.sort(key=lambda h: -h["points"])

    # what the score becomes once the [add a number] markers hold real numbers
    potential = score
    if MARKER in str(resume):
        filled = _fill_markers(resume)
        potential = ats_checks(filled)[1]
    return {
        "questions": questions(resume),
        "score": score,
        "target": TARGET,
        "reached": score >= TARGET,
        "potential": max(score, potential),
        "markers": str(resume).count(MARKER),
        "checks": checks,
        "holding_back": holding,
    }


def questions(resume):
    """What Rolivo still needs from the person to get past 90. Nothing here is guessed."""
    r = resume if isinstance(resume, dict) else {}
    c = r.get("contact") if isinstance(r.get("contact"), dict) else {}
    out = []
    contact = []
    if "@" not in s(c.get("email")):
        contact.append({"key": "email", "label": "Email address", "placeholder": "you@example.com"})
    if len([ch for ch in s(c.get("phone")) if ch.isdigit()]) < 8:
        contact.append({"key": "phone", "label": "Phone number", "placeholder": "+91 98765 43210"})
    links_text = " ".join(s(x) for x in lst(c.get("links"))).lower()
    if "linkedin" not in links_text:
        contact.append({"key": "linkedin", "label": "LinkedIn address", "placeholder": "linkedin.com/in/your-name"})
    if "github" not in links_text:
        contact.append({"key": "github", "label": "GitHub address", "placeholder": "github.com/your-name"})
    if contact:
        out.append({"id": "contact", "title": "Contact details", "fields": contact})

    n_skills = sum(len(lst(g.get("items"))) if isinstance(g, dict) else 1 for g in lst(r.get("skills")))
    if n_skills < 6:
        out.append({"id": "skills", "title": "Skills", "need": 6 - n_skills,
                    "help": "Add skills you really have, separated by commas. Only add ones you can talk about in an interview."})

    edu = [e for e in lst(r.get("education")) if isinstance(e, dict) and (s(e.get("school")) or s(e.get("degree")))]
    if not edu:
        out.append({"id": "education", "title": "Education", "fields": [
            {"key": "degree", "label": "Degree", "placeholder": "B.Tech in Computer Science"},
            {"key": "school", "label": "School or college", "placeholder": ""},
            {"key": "dates", "label": "Years", "placeholder": "2022 - 2026"}]})

    undated = []
    for kind, label_key in (("experience", "company"), ("education", "school")):
        for i, e in enumerate(lst(r.get(kind))):
            if isinstance(e, dict) and (s(e.get(label_key)) or s(e.get("title")) or s(e.get("degree"))) and not s(e.get("dates")):
                undated.append({"kind": kind, "i": i, "label": s(e.get(label_key)) or s(e.get("title")) or s(e.get("degree"))})
    if undated:
        out.append({"id": "dates", "title": "Dates", "items": undated})

    bullets = []
    total = 0
    for kind, label_key in (("experience", "company"), ("projects", "name")):
        for i, e in enumerate(lst(r.get(kind))):
            if not isinstance(e, dict):
                continue
            for j, b in enumerate(lst(e.get("bullets"))):
                total += 1
                if not any(ch.isdigit() for ch in s(b)) and len(bullets) < 6:
                    bullets.append({"kind": kind, "i": i, "j": j, "where": s(e.get(label_key)), "text": s(b)})
    if bullets:
        out.append({"id": "results", "title": "Real results", "items": bullets,
                    "help": "A real number makes a bullet stronger: users, rows, accuracy, hours saved. Leave blank if you do not have one."})

    if not s(r.get("summary")):
        out.append({"id": "summary", "title": "Summary", "auto": True,
                    "help": "Rolivo will write a short summary using only what is on your resume."})
    return out


def _fill_markers(node):
    if isinstance(node, str):
        return node.replace(MARKER, "2")
    if isinstance(node, list):
        return [_fill_markers(x) for x in node]
    if isinstance(node, dict):
        return {k: _fill_markers(v) for k, v in node.items()}
    return node


class ScoreBody(BaseModel):
    resume: dict


@router.post("/score")
def score(body: ScoreBody, user: User = Depends(current_user)):
    return report(body.resume)


@router.post("/check", dependencies=[Depends(ai_limit)])
async def check(
    resume_file: Optional[UploadFile] = File(None),
    resume_text: str = Form(""),
    user: User = Depends(current_user),
):
    """Reads an uploaded resume into fields, then scores its ATS readiness."""
    if resume_file is not None and resume_file.filename:
        data = await resume_file.read()
        raw = links.add_block(text_from_upload(resume_file.filename, data), resume_file.filename, data)
    else:
        raw = clean(resume_text)
    parsed = ask_json(resumes.SYSTEM, raw)
    links.apply_links(parsed, raw)
    out = report(parsed)
    out["resume"] = parsed
    return out


class ImproveBody(BaseModel):
    resume: dict
    answers: dict = {}


def _clip(x, n=160):
    return s(x)[:n]


def apply_answers(resume, a):
    """Puts the person's own answers into the resume. Returns (resume, list of what changed)."""
    import copy

    r = copy.deepcopy(resume)
    notes = []
    a = a if isinstance(a, dict) else {}
    c = r.get("contact") if isinstance(r.get("contact"), dict) else {}
    r["contact"] = c
    ans = a.get("contact") if isinstance(a.get("contact"), dict) else {}
    for key in ("email", "phone"):
        if _clip(ans.get(key), 80):
            c[key] = _clip(ans.get(key), 80)
            notes.append("Added your " + key + ".")
    for key in ("linkedin", "github"):
        v = _clip(ans.get(key), 200)
        if v:
            c["links"] = lst(c.get("links")) + [v]
            notes.append("Added your " + key.capitalize() + " address.")

    extra = [x.strip() for x in s(a.get("skills")).replace("\n", ",").split(",") if x.strip()][:20]
    if extra:
        have = {s(i).lower() for g in lst(r.get("skills")) if isinstance(g, dict) for i in lst(g.get("items"))}
        new = [x[:40] for x in extra if x.lower() not in have]
        if new:
            groups = lst(r.get("skills"))
            groups.append({"group": "Additional skills", "items": new})
            r["skills"] = groups
            notes.append("Added " + str(len(new)) + " skills you listed.")

    edu = a.get("education") if isinstance(a.get("education"), dict) else {}
    if _clip(edu.get("degree")) or _clip(edu.get("school")):
        r["education"] = lst(r.get("education")) + [
            {"degree": _clip(edu.get("degree")), "school": _clip(edu.get("school")), "dates": _clip(edu.get("dates"), 40), "details": ""}
        ]
        notes.append("Added your education.")

    for d in lst(a.get("dates")):
        if not isinstance(d, dict) or d.get("kind") not in ("experience", "education"):
            continue
        try:
            entry = lst(r.get(d["kind"]))[int(d["i"])]
        except Exception:
            continue
        if isinstance(entry, dict) and _clip(d.get("value"), 40):
            entry["dates"] = _clip(d.get("value"), 40)
            notes.append("Added dates.")

    for b in lst(a.get("results")):
        if not isinstance(b, dict) or b.get("kind") not in ("experience", "projects"):
            continue
        value = _clip(b.get("value"), 120)
        if not value:
            continue
        try:
            entry = lst(r.get(b["kind"]))[int(b["i"])]
            bullets = entry["bullets"]
            text = s(bullets[int(b["j"])])
        except Exception:
            continue
        bullets[int(b["j"])] = text.rstrip(". ") + ", " + value.rstrip(". ") + "."
        notes.append("Added a real result to a bullet.")
    return r, notes


SUMMARY_SYSTEM = (
    "Write a 2 to 3 sentence professional summary, at most 50 words, for this resume. "
    "Use only facts that appear in the resume: do not add skills, tools, numbers, employers or claims. "
    "Plain text only. Return JSON: {\"summary\": \"\"}"
)


@router.post("/improve", dependencies=[Depends(ai_limit)])
def improve(body: ImproveBody, user: User = Depends(current_user)):
    before = report(body.resume)
    resume, notes = apply_answers(body.resume, body.answers)
    cleaned = rewrite.polish(resume)
    if cleaned:
        notes.append("Cleaned " + str(cleaned) + " small ATS issues (symbols, verb tense, summary length).")
    if not s(resume.get("summary")):
        try:
            out = ask_json(SUMMARY_SYSTEM, str(resume), max_tokens=600)
            text = s(out.get("summary")) if isinstance(out, dict) else ""
            orig_text = "\n".join(flatten(resume))
            if text and not rewrite.check(orig_text, "", {"summary": text, "experience": [], "projects": []}):
                resume["summary"] = text
                notes.append("Wrote a short summary from your resume.")
        except Exception:
            pass
    after = report(resume)
    return {"resume": resume, "notes": notes, "before": before["score"], "report": after}
