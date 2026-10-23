import difflib
import re

from tone_guard import clean_up
from skills_guard import complete_skills
from scoring import flatten, found_in, lst, s

TERM = re.compile(
    r"\b(?:[A-Z]{2,}[A-Za-z0-9+#]*|[A-Za-z]+[A-Z][A-Za-z0-9+#]*|[A-Za-z]+\d[A-Za-z0-9+#]*)\b"
)
NUM = re.compile(r"\d[\d,]*(?:\.\d+)?")
PLACEHOLDER = "[add a number]"


def _nums(text):
    return {n.replace(",", "") for n in NUM.findall(text or "")}


def _words(text):
    return {w for w in re.findall(r"[a-z0-9]+", (text or "").lower()) if len(w) > 2}


def _sim(a, b):
    wa, wb = _words(a), _words(b)
    overlap = len(wa & wb) / max(1, len(wa | wb))
    return overlap + 0.2 * difflib.SequenceMatcher(None, a.lower(), b.lower()).ratio()


def _sentences(text):
    return [p for p in re.split(r"(?<=[.!?])\s+", (text or "").strip()) if p]


def _problems(text, orig_text, facts):
    body = text.replace(PLACEHOLDER, "")
    allowed = _nums(orig_text) | _nums(facts)
    found = [("new number", n) for n in sorted(_nums(body)) if n not in allowed]
    seen = set()
    for tok in TERM.findall(body):
        key = tok.lower()
        if key in seen or tok.isdigit():
            continue
        seen.add(key)
        if not (found_in(tok, orig_text) or found_in(tok, facts)):
            found.append(("new term", tok))
    return found


def _restore_numbers(o_bul, bullets):
    out = list(bullets)
    if not out:
        return out
    for ob in o_bul:
        need = _nums(ob)
        if not need:
            continue
        have = set()
        for b in out:
            have |= _nums(b)
        if need <= have:
            continue
        pool = [i for i, b in enumerate(out) if not _nums(b)] or list(range(len(out)))
        best = max(pool, key=lambda k: _sim(ob, out[k]))
        out[best] = ob
    return out


def finalize(orig, res, facts=""):
    orig_text = "\n".join(flatten(orig))
    reverted = 0
    res["skills"] = complete_skills(orig, res)
    res = clean_up(orig, res)

    sents = _sentences(s(res.get("summary")))
    good = [x for x in sents if not _problems(x, orig_text, facts)]
    if len(good) != len(sents):
        reverted += len(sents) - len(good)
        fallback = " ".join(_sentences(s(orig.get("summary")))[:2])
        res["summary"] = " ".join(good) or fallback

    for kind in ("experience", "projects"):
        o_list = [e for e in lst(orig.get(kind)) if isinstance(e, dict)]
        for i, e in enumerate(res.get(kind, [])):
            o_bul = []
            if i < len(o_list):
                o_bul = [s(b) for b in lst(o_list[i].get("bullets")) if s(b)]
            bullets = list(e.get("bullets", []))
            while o_bul and len(bullets) > len(o_bul):
                bad = [k for k, b in enumerate(bullets) if _problems(b, orig_text, facts)]
                plain = [k for k, b in enumerate(bullets) if not _nums(b)]
                drop = bad[-1] if bad else (plain[-1] if plain else len(bullets) - 1)
                bullets.pop(drop)
            used = set()
            for j, b in enumerate(bullets):
                if o_bul and _problems(b, orig_text, facts):
                    pool = [x for x in o_bul if x not in used] or o_bul
                    best = max(pool, key=lambda ob: _sim(ob, b))
                    bullets[j] = best
                    used.add(best)
                    reverted += 1
            bullets = _restore_numbers(o_bul, bullets)
            e["bullets"] = bullets

    flags = []
    items = [("summary", res.get("summary", ""))]
    parts = (("experience", "company", "experience: "), ("projects", "name", "project: "))
    for kind, key, label in parts:
        for e in res.get(kind, []):
            for b in e.get("bullets", []):
                items.append((label + s(e.get(key)), b))
    for where, text in items:
        for kind_name, value in _problems(text, orig_text, facts):
            flags.append({"type": kind_name, "value": value, "where": where})
    return res, flags, reverted