import difflib
import json
import re
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile

import jobs
import resumes
from auth import current_user
from db import User
from llm import ask_json
from guard import finalize
from limits import limit_bullets
from parsing import clean, text_from_upload
from role_profiles import ROLES, TEMPLATES
from roles import detect, template_info
from scoring import analyze, flatten, found_in, lst, s

router = APIRouter(prefix="/rewrite", tags=["rewrite"])

PLACEHOLDER = "[add a number]"
TERM = re.compile(
    r"\b(?:[A-Z]{2,}[A-Za-z0-9+#]*|[A-Za-z]+[A-Z][A-Za-z0-9+#]*|[A-Za-z]+\d[A-Za-z0-9+#]*)\b"
)
NUM = re.compile(r"\d[\d,]*(?:\.\d+)?")
HAS_NUMBER = re.compile(r"(?<![A-Za-z])\d")
VERBS = {
    "built", "trained", "developed", "designed", "engineered", "evaluated",
    "implemented", "created", "integrated", "diagnosed", "deployed", "automated",
    "analysed", "analyzed", "optimized", "optimised", "orchestrated",
}

SYSTEM = (
    "You tailor a resume to a job posting for the candidate. "
    "An applicant tracking system reads it first and a recruiter second.\n"
    "HARD RULES:\n"
    "1. Use only facts that are in original_resume or user_facts. Never add skills, tools, "
    "employers, schools, degrees, dates, titles, certifications, numbers or results that are not there.\n"
    "2. Return every experience and project entry from the original, using EXACTLY the same "
    "company and project names. Do not touch education, contact details or the name.\n"
    "3. You may reword bullets, reorder bullets inside an entry, and start each bullet with a "
    "strong past-tense action verb. Keep each bullet 8 to 30 words. Keep every number that "
    "appears in a bullet.\n"
    "4. Use the job's wording for a skill only when the resume already shows that skill. "
    "If the job asks for something the resume does not show, do NOT claim it.\n"
    "5. summary: 2 to 3 sentences, at most 55 words, written for the target role, mentioning "
    "only real strengths from the resume.\n"
    "6. skills: regroup and reorder so the job's most relevant skills come first. Use only skills "
    "already in the resume, in the job's spelling when it is the same skill.\n"
    "7. Write plain text. No emojis, symbols or markdown. Do not add placeholders.\n"
    "Return only JSON in exactly this shape:\n"
    '{"summary": "", "skills": [{"group": "", "items": []}], '
    '"experience": [{"company": "", "bullets": []}], '
    '"projects": [{"name": "", "bullets": []}]}'
)


def numbers(text):
    return {n.replace(",", "") for n in NUM.findall(text or "")}


def _norm(x):
    return re.sub(r"[^a-z0-9]+", " ", s(x).lower()).strip()


def _pick(target, new_list, key, used):
    t = _norm(target)
    best_i, best = None, 0.0
    for i, n in enumerate(new_list):
        if i in used:
            continue
        c = _norm(n.get(key))
        if not c or not t:
            continue
        if c == t or c in t or t in c:
            score = 1.0
        else:
            score = difflib.SequenceMatcher(None, t, c).ratio()
        if score > best:
            best_i, best = i, score
    return best_i if best >= 0.6 else None


def keep_numbers(orig_bullets, new_bullets):
    new = list(new_bullets)
    if not new:
        return new
    taken = set()
    for ob in orig_bullets:
        nums = numbers(ob)
        if not nums:
            continue
        if all(any(n in numbers(nb) for nb in new) for n in nums):
            continue
        order = sorted(
            (i for i in range(len(new)) if i not in taken),
            key=lambda i: -difflib.SequenceMatcher(None, ob.lower(), new[i].lower()).ratio(),
        )
        if order:
            new[order[0]] = ob
            taken.add(order[0])
    return new


def enforce(orig, new):
    notes, removed = [], []
    new = new if isinstance(new, dict) else {}
    orig_text = "\n".join(flatten(orig))
    out = {
        "name": s(orig.get("name")),
        "headline": s(orig.get("headline")),
        "contact": orig.get("contact") if isinstance(orig.get("contact"), dict) else {},
        "summary": s(new.get("summary")) or s(orig.get("summary")),
        "education": lst(orig.get("education")),
        "certifications": lst(orig.get("certifications")),
        "extras": lst(orig.get("extras")),
    }

    groups, seen = [], set()
    for g in lst(new.get("skills")):
        if not isinstance(g, dict):
            continue
        keep = []
        for item in lst(g.get("items")):
            item = s(item)
            if not item or item.lower() in seen:
                continue
            if found_in(item, orig_text):
                keep.append(item)
                seen.add(item.lower())
            else:
                removed.append(item)
        if keep:
            groups.append({"group": s(g.get("group")) or "Skills", "items": keep})
    out["skills"] = groups or lst(orig.get("skills"))

    def merge(kind, name_key, keep_keys):
        o_list = [e for e in lst(orig.get(kind)) if isinstance(e, dict)]
        n_list = [e for e in lst(new.get(kind)) if isinstance(e, dict)]
        used, result = set(), []
        for o in o_list:
            orig_bullets = [s(b) for b in lst(o.get("bullets")) if s(b)]
            j = _pick(o.get(name_key), n_list, name_key, used)
            bullets = []
            if j is not None:
                used.add(j)
                bullets = [s(b)[:400] for b in lst(n_list[j].get("bullets")) if s(b)]
            if not bullets:
                bullets = orig_bullets
                notes.append(
                    "Kept the original bullets for "
                    + s(o.get(name_key))
                    + " because the rewrite did not include that entry."
                )
            else:
                pass
            entry = {k: o.get(k, "") for k in keep_keys}
            entry["bullets"] = bullets
            result.append(entry)
        return result

    out["experience"] = merge("experience", "company", ["title", "company", "location", "dates"])
    out["projects"] = merge("projects", "name", ["name", "tech"])
    return out, removed, notes


def text_items(res):
    items = [("summary", res.get("summary", ""))]
    for e in res.get("experience", []):
        for b in e.get("bullets", []):
            items.append(("experience: " + s(e.get("company")), b))
    for p in res.get("projects", []):
        for b in p.get("bullets", []):
            items.append(("project: " + s(p.get("name")), b))
    return items


def check(orig_text, facts, res):
    allowed = numbers(orig_text) | numbers(facts)
    flags = []
    for where, text in text_items(res):
        body = text.replace(PLACEHOLDER, "")
        for n in sorted(numbers(body)):
            if n not in allowed:
                flags.append({"type": "new number", "value": n, "where": where})
        seen = set()
        for tok in TERM.findall(body):
            key = tok.lower()
            if key in seen or tok.isdigit():
                continue
            seen.add(key)
            if not (found_in(tok, orig_text) or found_in(tok, facts)):
                flags.append({"type": "new term", "value": tok, "where": where})
    return flags


def add_placeholders(res, limit=4):
    count = 0
    for kind in ("experience", "projects"):
        for e in res.get(kind, []):
            for i, b in enumerate(e.get("bullets", [])):
                if count >= limit:
                    return count
                words = b.split()
                first = words[0].lower().strip(",.:;") if words else ""
                if first in VERBS and not HAS_NUMBER.search(b) and PLACEHOLDER not in b:
                    e["bullets"][i] = b.rstrip(". ") + " " + PLACEHOLDER
                    count += 1
                    break
    return count


def bullets_of(res, kind):
    return [
        s(b)
        for e in lst(res.get(kind))
        if isinstance(e, dict)
        for b in lst(e.get("bullets"))
    ]


def skill_list(res):
    return [
        s(i).lower()
        for g in lst(res.get("skills"))
        if isinstance(g, dict)
        for i in lst(g.get("items"))
    ]


def diff_notes(orig, new, removed):
    notes = []
    if s(new.get("summary")) != s(orig.get("summary")):
        notes.append("Rewrote the summary for this role.")
    for kind, label in (("experience", "experience"), ("projects", "project")):
        o, n = bullets_of(orig, kind), bullets_of(new, kind)
        if n:
            changed = sum(1 for b in n if b not in o)
            notes.append("Reworded " + str(changed) + " of " + str(len(n)) + " " + label + " bullets.")
    if skill_list(orig) != skill_list(new):
        notes.append("Regrouped and reordered skills so the most relevant ones come first.")
    if removed:
        notes.append("Dropped skills that are not in your resume: " + ", ".join(removed[:8]) + ".")
    return notes


def build_payload(resume, job, rid, facts):
    lite = {
        k: job.get(k)
        for k in (
            "title", "required_skills", "tools", "skill_groups",
            "preferred_skills", "keywords", "responsibilities",
        )
    }
    return json.dumps(
        {
            "target_role": ROLES[rid]["label"],
            "role_guidance": ROLES[rid]["focus"],
            "job": lite,
            "original_resume": resume,
            "user_facts": facts,
        },
        ensure_ascii=False,
    )


def generate(resume, job, rid, facts):
    payload = build_payload(resume, job, rid, facts)
    orig_text = "\n".join(flatten(resume))
    raw = ask_json(SYSTEM, payload, max_tokens=6000)
    result, removed, notes = enforce(resume, raw)
    flags = check(orig_text, facts, result)
    repaired = False
    if flags:
        problems = [f["type"] + " " + f["value"] + " in " + f["where"] for f in flags[:20]]
        retry = (
            payload
            + "\n\nYour previous draft contained items that are NOT supported by the resume "
            + "or the user facts. Rewrite the draft without them:\n"
            + "\n".join(problems)
            + "\n\nPrevious draft:\n"
            + json.dumps(raw, ensure_ascii=False)
        )
        again = ask_json(SYSTEM, retry, max_tokens=6000)
        result2, removed2, notes2 = enforce(resume, again)
        flags2 = check(orig_text, facts, result2)
        repaired = True
        if len(flags2) <= len(flags):
            raw, result, removed, notes, flags = again, result2, removed2, notes2, flags2
    result, flags, reverted = finalize(resume, result, facts)
    if reverted:
        msg = " unsupported items to your original wording."
        notes.append("Reverted " + str(reverted) + msg)
    changes = diff_notes(resume, result, removed)
    added = add_placeholders(result)
    if added:
        changes.append(
            "Marked " + str(added) + " bullets with " + PLACEHOLDER
            + " where a real result would make them stronger."
        )
    return result, changes, {
        "passed": not flags,
        "flags": flags,
        "removed_skills": removed,
        "notes": notes,
        "placeholders": added,
        "repaired": repaired,
    }


def scores(a):
    return {"match": a["match_score"], "ats": a["ats_score"], "overall": a["overall"]}


def fix_titles(a):
    return [f["priority"] + ": " + f["title"] for f in a["fixes"]]


@router.post("/quick")
async def quick(
    resume_file: Optional[UploadFile] = File(None),
    resume_text: str = Form(""),
    job_text: str = Form(...),
    facts: str = Form(""),
    template: str = Form(""),
    user: User = Depends(current_user),
):
    if resume_file is not None and resume_file.filename:
        raw_resume = text_from_upload(resume_file.filename, await resume_file.read())
    else:
        raw_resume = clean(resume_text)
    job_raw = clean(job_text)
    facts = facts.strip()[:1500]

    resume = ask_json(resumes.SYSTEM, raw_resume)
    job = ask_json(jobs.SYSTEM, job_raw)
    rid, confidence, _ranked = detect(job_raw)
    tid = template if template in TEMPLATES else ROLES[rid]["templates"][0]

    result, changes, report = generate(resume, job, rid, facts)
    before = analyze(resume, job)
    after = analyze(result, job)
    return {
        "role": {
            "id": rid,
            "label": ROLES[rid]["label"],
            "confidence": confidence,
            "focus": ROLES[rid]["focus"],
        },
        "template": template_info(tid),
        "before": scores(before),
        "after": scores(after),
        "before_fixes": fix_titles(before),
        "after_fixes": fix_titles(after),
        "resume": result,
        "changes": changes,
        "check": report,
    }