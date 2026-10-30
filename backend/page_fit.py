"""Makes a resume fit on one page by measuring the real PDF, not by asking an AI to guess.
It only ever removes or shrinks things, never adds a word, and it reports exactly what it did."""
import copy
import io
import re

from pypdf import PdfReader

from resume_render import build_pdf
from scoring import found_in, lst, s

SIZES = (10.0, 9.5, 9.0)  # the Style panel allows 9 to 12 pt
MAX_STEPS = 80


def _pdf_bytes(resume, spec):
    out = build_pdf(resume, spec)
    return out if isinstance(out, (bytes, bytearray)) else out.getvalue()


def page_count(resume, spec):
    return len(PdfReader(io.BytesIO(_pdf_bytes(resume, spec))).pages)


def _relevant_terms(resume, job_text):
    """Skills the resume lists that the job posting also mentions."""
    terms = []
    for g in lst(resume.get("skills")):
        items = g.get("items") if isinstance(g, dict) else [g]
        for item in lst(items):
            if s(item) and found_in(s(item), job_text or ""):
                terms.append(s(item))
    return terms


def _score(text, terms):
    return sum(1 for t in terms if found_in(t, text)) + (0.5 if re.search(r"(?<![A-Za-z])\d", text) else 0)


def _entries(resume):
    for kind in ("projects", "experience"):
        for e in lst(resume.get(kind)):
            if isinstance(e, dict):
                yield kind, e


def _drop_weakest_bullet(resume, terms, floor):
    """Removes the least relevant bullet from an entry that has more than `floor` bullets."""
    best = None
    for kind, e in _entries(resume):
        bullets = [b for b in lst(e.get("bullets")) if s(b)]
        if len(bullets) <= floor:
            continue
        for i, b in enumerate(bullets):
            key = (_score(s(b), terms), -len(bullets), -i)  # weak first; crowded entries and later bullets go first
            if best is None or key < best[0]:
                best = (key, e, i, kind)
    if best is None:
        return None
    _key, e, i, kind = best
    e["bullets"] = [b for j, b in enumerate(e["bullets"]) if j != i]
    return s(e.get("name") or e.get("title") or e.get("company")) or kind


def _drop_weakest_project(resume, terms, keep):
    projects = [p for p in lst(resume.get("projects")) if isinstance(p, dict)]
    if len(projects) <= keep:
        return None
    ranked = sorted(range(len(projects)), key=lambda i: (_score(" ".join(map(str, [projects[i].get("name"), projects[i].get("tech")] + lst(projects[i].get("bullets")))), terms), -i))
    gone = projects[ranked[0]]
    resume["projects"] = [p for i, p in enumerate(projects) if i != ranked[0]]
    return s(gone.get("name"))


def fit_to_pages(resume, spec, job_text="", max_pages=1):
    """Returns (resume, style changes, notes, fits)."""
    work = copy.deepcopy(resume)
    spec = dict(spec)
    style, notes = {}, []
    if page_count(work, spec) <= max_pages:
        return resume, {}, ["It already fits on one page. No change was needed."], True

    # 1. tighter spacing and a slightly smaller text size cost nothing in content
    if spec.get("density") != "compact":
        spec["density"] = "compact"
        style["density"] = "compact"
    for size in SIZES:
        if size < float(spec.get("size", 10.5)):
            spec["size"] = size
            style["size"] = size
        if page_count(work, spec) <= max_pages:
            break
    if style:
        notes.append(f"Tightened the spacing and set the text size to {spec['size']:g} pt.")

    terms = _relevant_terms(work, job_text)
    removed, left_out = [], []

    def fits():
        return page_count(work, spec) <= max_pages

    # 2. trim the weakest bullets (keeping two per entry), 3. then the weakest projects (keeping three, then two),
    # 4. then bullets down to one per entry
    for kind, limit in (("bullets", 2), ("projects", 3), ("projects", 2), ("bullets", 1)):
        steps = 0
        while not fits() and steps < MAX_STEPS:
            steps += 1
            if kind == "bullets":
                gone = _drop_weakest_bullet(work, terms, limit)
                if gone is None:
                    break
                removed.append(gone)
            else:
                gone = _drop_weakest_project(work, terms, limit)
                if gone is None:
                    break
                left_out.append(gone)
    # 5. last resort: a shorter summary
    if not fits() and len(re.findall(r"[.!?](?:\s|$)", s(work.get("summary")))) > 2:
        sentences = re.split(r"(?<=[.!?])\s+", s(work.get("summary")))
        work["summary"] = " ".join(sentences[:2])
        notes.append("Shortened the summary to its first two sentences.")

    if removed:
        names = ", ".join(dict.fromkeys(removed))
        notes.append(f"Removed {len(removed)} of the least relevant bullet(s) (from: {names}).")
    if left_out:
        notes.append("Left out the least relevant project(s): " + ", ".join(left_out) + ". They are still in your saved resume and profile.")
    ok = fits()
    if not ok:
        notes.append("It is still longer than one page. Try removing a project or a section by hand, or use the Compact ATS template.")
    elif not removed and not left_out:
        notes.append("It now fits on one page without removing any content.")
    return work, style, notes, ok
