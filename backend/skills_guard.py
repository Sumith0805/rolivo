import re

from scoring import lst, s


def _norm(text):
    return re.sub(r"[^a-z0-9+#]+", " ", s(text).lower()).strip()


def _words(text):
    return {w for w in _norm(text).split() if len(w) > 2}


def complete_skills(orig, res):
    groups = [
        {"group": s(g.get("group")) or "Skills", "items": list(lst(g.get("items")))}
        for g in lst(res.get("skills"))
        if isinstance(g, dict)
    ]
    have_text = " " + " ".join(_norm(i) for g in groups for i in g["items"]) + " "
    have_words = set(have_text.split())
    for og in lst(orig.get("skills")):
        if not isinstance(og, dict):
            continue
        missing = []
        for item in lst(og.get("items")):
            item = s(item)
            if not item:
                continue
            words = _words(item)
            whole = (" " + _norm(item) + " ") in have_text
            mostly = bool(words) and len(words & have_words) / len(words) >= 0.7
            if not (whole or mostly):
                missing.append(item)
        if not missing:
            continue
        name = s(og.get("group")) or "Skills"
        target = next((g for g in groups if g["group"].lower() == name.lower()), None)
        if target is None:
            groups.append({"group": name, "items": missing})
        else:
            target["items"].extend(missing)
    return groups