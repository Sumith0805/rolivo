import re

from scoring import flatten, s

DASHES = dict.fromkeys(map(ord, "\u2010\u2011\u2012\u2013\u2014\u2212"), "-")
QUOTES = {
    0x2018: "'",
    0x2019: "'",
    0x201C: '"',
    0x201D: '"',
    0x00A0: " ",
}
SOFT = [
    (r"proven (?:expertise|experience) (?:in|with)", "experience in"),
    (r"proven (?:ability|track record) (?:to|of|in)", "ability to"),
    (r"strong (?:background|experience|foundation) (?:in|with)", "experience in"),
    (r"extensive (?:experience|expertise) (?:in|with)", "experience in"),
    (r"(?:deep |solid )?expertise (?:in|with)", "experience in"),
    (r"expert (?:in|with)", "experienced in"),
]


def _fix(text, orig_lower):
    text = s(text).translate(DASHES).translate(QUOTES)
    for pattern, repl in SOFT:

        def sub(m, repl=repl):
            if m.group(0).lower() in orig_lower:
                return m.group(0)
            return repl.capitalize() if m.group(0)[0].isupper() else repl

        text = re.sub(pattern, sub, text, flags=re.I)
    return text


def clean_up(orig, res):
    orig_lower = "\n".join(flatten(orig)).lower()
    res["summary"] = _fix(res.get("summary", ""), orig_lower)
    for kind in ("experience", "projects"):
        for e in res.get(kind, []):
            e["bullets"] = [_fix(b, orig_lower) for b in e.get("bullets", [])]
    for g in res.get("skills", []):
        g["group"] = _fix(g.get("group", ""), orig_lower)
        g["items"] = [_fix(i, orig_lower) for i in g.get("items", [])]
    return res