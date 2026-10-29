"""Changes a rewritten resume the way the person asks, without letting new claims in."""
import json
import re

KEYS = ("name", "headline", "contact", "summary", "skills", "experience", "projects", "education", "certifications", "achievements")

SYSTEM = """You edit a resume according to the person's instruction.
You receive JSON with: instruction, job (the job posting, for context only), facts (extra things the person stated about themselves), and resume (the current resume as JSON).

Hard rules:
- Use ONLY information already in the resume or in the facts or stated in the instruction by the person.
- Never add a skill, tool, employer, job title, degree, date, number, link or achievement that is not already there.
- You may reword, shorten, reorder, merge or drop bullets, change emphasis, and change the tone.
- If the instruction asks for something that would need an invented fact, leave that part out and say so in notes.
- Keep the same JSON structure and the same keys as the input resume.
- Keep the text "[add a number]" exactly where it is if it is in a bullet you keep.

Return ONLY JSON: {"resume": {...the edited resume...}, "notes": ["one short sentence per thing you did or could not do"]}"""

_NUM = re.compile(r"\d[\d,.]*%?")


def _numbers(text):
    return {n.rstrip(".,") for n in _NUM.findall(str(text))}


def _flat(x):
    return json.dumps(x, ensure_ascii=False)


def _key(x):
    return re.sub(r"\s+", " ", str(x or "")).strip().lower()


def _pairs(items, *fields):
    return {tuple(_key(i.get(f)) for f in fields) for i in (items or []) if isinstance(i, dict)}


def check_changes(original, new, instruction, facts):
    """Reasons the edited resume must be refused. An empty list means it is safe."""
    problems = []
    corpus = _flat(original) + " " + (facts or "") + " " + (instruction or "")
    corpus_l = corpus.lower()

    extra_numbers = _numbers(_flat(new)) - _numbers(corpus)
    if extra_numbers:
        problems.append("it introduced numbers you did not give: " + ", ".join(sorted(extra_numbers)[:4]))

    for g in (new.get("skills") or []):
        items = g.get("items") if isinstance(g, dict) else [g]
        for item in items or []:
            if _key(item) and _key(item) not in corpus_l:
                problems.append(f"it added the skill “{item}”")
                break

    if not _pairs(new.get("experience"), "title", "company") <= _pairs(original.get("experience"), "title", "company"):
        problems.append("it changed a job title or employer")
    if not _pairs(new.get("education"), "degree", "school") <= _pairs(original.get("education"), "degree", "school"):
        problems.append("it changed a degree or school")
    old_projects = {_key(p.get("name")) for p in original.get("projects") or [] if isinstance(p, dict)}
    for p in new.get("projects") or []:
        if isinstance(p, dict) and _key(p.get("name")) not in old_projects:
            problems.append(f"it added the project “{p.get('name')}”")
            break
    for sec in ("certifications", "achievements"):
        old = {_key(c if isinstance(c, str) else c.get("name") if isinstance(c, dict) else "") for c in original.get(sec) or []}
        for c in new.get(sec) or []:
            name = _key(c if isinstance(c, str) else c.get("name") if isinstance(c, dict) else "")
            if name and name not in old and name not in (facts or "").lower() and name not in (instruction or "").lower():
                problems.append(f"it added a new {sec[:-1]}")
                break
    return problems


def refine(resume, instruction, job_text, facts, ask):
    """Returns {"resume", "notes", "applied"}. `ask(system, user_text)` returns the model's JSON."""
    payload = {"instruction": instruction, "job": (job_text or "")[:6000], "facts": facts or "", "resume": resume}
    out = ask(SYSTEM, json.dumps(payload, ensure_ascii=False))
    new = out.get("resume") if isinstance(out, dict) else None
    if not isinstance(new, dict):
        return {"resume": resume, "applied": False,
                "notes": ["I could not make that change. Try saying it a different way."]}
    new = {k: new[k] for k in KEYS if k in new}
    new["name"] = resume.get("name", new.get("name"))
    new["contact"] = resume.get("contact", new.get("contact"))  # contact details are never rewritten
    for k in KEYS:
        new.setdefault(k, resume.get(k))
    import links
    links.restore_links(resume, new)  # the model must never drop a project or job link
    problems = check_changes(resume, new, instruction, facts)
    if problems:
        return {"resume": resume, "applied": False,
                "notes": ["I did not apply that, because " + problems[0] + ". Rolivo only uses facts that are already on your resume or that you state yourself."]}
    notes = [str(n).strip()[:200] for n in (out.get("notes") or []) if str(n).strip()][:5]
    return {"resume": new, "applied": True, "notes": notes or ["Done."]}
