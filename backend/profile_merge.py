"""Uses the person's saved profile together with the uploaded resume, and picks the projects that
fit the job best. Nothing is invented: every item comes from the resume or from the profile."""
import copy
import difflib
import json
import re

from scoring import found_in, lst, s

MAX_PROJECTS = 4


def _norm(x):
    return re.sub(r"[^a-z0-9]+", " ", s(x).lower()).strip()


def _same(a, b):
    na, nb = _norm(a), _norm(b)
    if not na or not nb:
        return False
    return na == nb or na in nb or nb in na or difflib.SequenceMatcher(None, na, nb).ratio() >= 0.8


def _bullets(text):
    text = s(text)
    parts = [p.strip(" -•\t") for p in re.split(r"[\n\r]+|(?<=[.!?])\s+", text)]
    parts = [p for p in parts if len(p) >= 8][:5]
    return parts or ([text] if text else [])


def merge_profile(resume, profile):
    """Adds projects, jobs, skills and certificates from the profile that the resume does not have.
    Returns (new resume, list of plain-words notes)."""
    out = copy.deepcopy(resume if isinstance(resume, dict) else {})
    profile = profile if isinstance(profile, dict) else {}
    notes = []

    have = [e for e in lst(out.get("projects")) if isinstance(e, dict)]
    added = []
    for p in lst(profile.get("projects")):
        if not isinstance(p, dict) or not s(p.get("name")):
            continue
        if any(_same(p["name"], e.get("name")) for e in have):
            for e in have:  # same project: borrow the link when the resume has none
                if _same(p["name"], e.get("name")) and not s(e.get("link")) and s(p.get("link")):
                    e["link"] = s(p["link"])
            continue
        entry = {"name": s(p["name"]), "tech": s(p.get("tech")), "link": s(p.get("link")), "bullets": _bullets(p.get("description"))}
        have.append(entry)
        added.append(entry["name"])
    out["projects"] = have
    if added:
        notes.append("Added " + str(len(added)) + " project(s) from your profile: " + ", ".join(added) + ".")

    jobs_have = [e for e in lst(out.get("experience")) if isinstance(e, dict)]
    new_jobs = []
    for e in lst(profile.get("experience")):
        if not isinstance(e, dict):
            continue
        company = s(e.get("company")) or s(e.get("title"))
        if not company or any(_same(company, j.get("company")) for j in jobs_have):
            continue
        jobs_have.append({"title": s(e.get("title")), "company": s(e.get("company")), "location": "",
                          "dates": s(e.get("dates")), "link": "", "bullets": _bullets(e.get("details"))})
        new_jobs.append(company)
    out["experience"] = jobs_have
    if new_jobs:
        notes.append("Added experience from your profile: " + ", ".join(new_jobs) + ".")

    blob = "\n".join(_flat(out))
    extra = [k for k in lst(profile.get("skills")) if s(k) and not found_in(s(k), blob)]
    if extra:
        groups = [g for g in lst(out.get("skills")) if isinstance(g, dict)]
        groups.append({"group": "Additional skills", "items": [s(k) for k in extra]})
        out["skills"] = groups
        notes.append("Added " + str(len(extra)) + " skill(s) from your profile.")

    certs = [s(c) for c in lst(out.get("certifications")) if s(c)]
    new_certs = []
    for c in lst(profile.get("certifications")):
        if not isinstance(c, dict) or not s(c.get("name")):
            continue
        if any(_same(c["name"], x) for x in certs):
            continue
        label = s(c["name"]) + (" - " + ", ".join(x for x in (s(c.get("issuer")), s(c.get("year"))) if x) if (s(c.get("issuer")) or s(c.get("year"))) else "")
        certs.append(label)
        new_certs.append(label)
    out["certifications"] = certs
    if new_certs:
        notes.append("Added " + str(len(new_certs)) + " certification(s) from your profile.")

    if not [e for e in lst(out.get("education")) if e] and lst(profile.get("education")):
        out["education"] = [
            {"school": s(e.get("school")), "degree": s(e.get("degree")), "dates": s(e.get("dates")), "details": s(e.get("details"))}
            for e in lst(profile.get("education")) if isinstance(e, dict)
        ]
    return out, notes


def _flat(x):
    if isinstance(x, str):
        return [x]
    if isinstance(x, dict):
        return [t for v in x.values() for t in _flat(v)]
    if isinstance(x, list):
        return [t for v in x for t in _flat(v)]
    return []


def _job_terms(job):
    weights = {}
    for key, w in (("required_skills", 3), ("tools", 3), ("preferred_skills", 1.5), ("keywords", 1)):
        for t in lst((job or {}).get(key)):
            if s(t) and len(s(t)) > 1:
                weights[s(t)] = max(weights.get(s(t), 0), w)
    for g in lst((job or {}).get("skill_groups")):
        if isinstance(g, dict):
            w = 1.5 if s(g.get("importance")).lower() == "preferred" else 3
            for t in lst(g.get("any_of")):
                if s(t):
                    weights[s(t)] = max(weights.get(s(t), 0), w)
    return weights


def pick_projects(resume, job, limit=MAX_PROJECTS):
    """Keeps the projects that fit the job best, best first. Returns (resume, notes)."""
    out = copy.deepcopy(resume)
    projects = [p for p in lst(out.get("projects")) if isinstance(p, dict)]
    terms = _job_terms(job)
    if len(projects) < 2 or not terms:
        return out, []
    scored = []
    for i, p in enumerate(projects):
        text = "\n".join(_flat(p))
        score = sum(w for t, w in terms.items() if found_in(t, text))
        scored.append((-score, i, p))
    scored.sort(key=lambda x: (x[0], x[1]))
    keep = [p for _n, _i, p in scored[:limit]]
    left = [s(p.get("name")) for _n, _i, p in scored[limit:]]
    out["projects"] = keep
    notes = []
    if [s(p.get("name")) for p in projects[:len(keep)]] != [s(p.get("name")) for p in keep] or left:
        notes.append("Ordered your projects by how well they fit this job: " + ", ".join(s(p.get("name")) for p in keep) + ".")
    if left:
        notes.append("Left out the least relevant project(s) for this job: " + ", ".join(left) + ". They stay in your resume and profile.")
    return out, notes


def read_profile(text):
    try:
        data = json.loads(text[:60000]) if text and text.strip() else None
    except ValueError:
        return None
    return data if isinstance(data, dict) else None
