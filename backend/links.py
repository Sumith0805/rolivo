"""Keeps the links hidden inside a resume file.

In a PDF or Word resume, a word like "GitHub" or a project name is often a clickable link.
Plain text extraction throws the web address away. This module reads those addresses and
adds them to the text as a short block, so the rest of Rolivo can attach them to the right
place and make them clickable again in the preview, Word and PDF files.
"""
import io
import re

MARK = "LINKS FOUND IN THE FILE:"
ARROW = " => "
SITES = (
    "github", "linkedin", "leetcode", "kaggle", "behance", "dribbble", "medium",
    "twitter", "x.com", "hackerrank", "codeforces", "gitlab", "codepen", "stackoverflow",
)


def _norm(x):
    return re.sub(r"[^a-z0-9]+", " ", (x or "").lower()).strip()


def _pdf_links(data):
    try:
        from pypdf import PdfReader
    except Exception:
        try:
            from PyPDF2 import PdfReader  # older name
        except Exception:
            return []
    out = []
    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception:
        return []
    for page in reader.pages[:4]:
        try:
            annots = page.get("/Annots") or []
        except Exception:
            continue
        found = []
        for a in annots:
            try:
                a = a.get_object()
                uri = (a.get("/A") or {}).get("/URI")
                rect = [float(v) for v in a["/Rect"]] if uri else None
            except Exception:
                continue
            if uri and rect and str(uri).lower().startswith(("http://", "https://")):
                found.append((str(uri), rect))
        if not found:
            continue
        frags = []

        def visit(text, cm, tm, font_dict, font_size):
            if text and text.strip():
                x = tm[4] * cm[0] + tm[5] * cm[2] + cm[4]
                y = tm[4] * cm[1] + tm[5] * cm[3] + cm[5]
                frags.append((x, y, text.strip()))

        try:
            page.extract_text(visitor_text=visit)
        except Exception:
            frags = []
        for uri, (x0, y0, x1, y1) in found:
            if x0 > x1:
                x0, x1 = x1, x0
            if y0 > y1:
                y0, y1 = y1, y0
            inside = [f for f in frags if x0 - 2 <= f[0] <= x1 + 2 and y0 - 3 <= f[1] <= y1 + 3]
            inside.sort(key=lambda f: (-round(f[1]), f[0]))
            label = " ".join(f[2] for f in inside)
            out.append((label, uri))
    return out


def _docx_links(data):
    try:
        import docx
    except Exception:
        return []
    out = []
    try:
        doc = docx.Document(io.BytesIO(data))
        part = doc.part
        ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        rid_key = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
        for h in doc.element.body.iter("{%s}hyperlink" % ns["w"]):
            rid = h.get(rid_key)
            rel = part.rels.get(rid) if rid else None
            url = getattr(rel, "target_ref", "") if rel is not None else ""
            label = "".join(t.text or "" for t in h.iter("{%s}t" % ns["w"]))
            if url.lower().startswith(("http://", "https://")):
                out.append((label, url))
    except Exception:
        return out
    return out


def file_links(name, data):
    name = (name or "").lower()
    if name.endswith(".pdf"):
        found = _pdf_links(data)
    elif name.endswith(".docx"):
        found = _docx_links(data)
    else:
        found = []
    seen, clean = set(), []
    for label, url in found:
        key = url.rstrip("/").lower()
        if key in seen:
            continue
        seen.add(key)
        clean.append((re.sub(r"\s+", " ", label).strip()[:80], url.strip()))
    return clean[:25]


def add_block(text, name, data):
    """The extracted text, plus one line per hidden link found in the file."""
    links = file_links(name, data)
    if not links:
        return text
    lines = [MARK] + [f"{label or 'link'}{ARROW}{url}" for label, url in links]
    return (text or "").rstrip() + "\n\n" + "\n".join(lines)


def read_block(text):
    """Pairs (label, url) from a block made by add_block, found anywhere in the text."""
    pairs = []
    for m in re.finditer(r"^(.*?)" + re.escape(ARROW) + r"(https?://\S+)\s*$", text or "", re.M):
        pairs.append((m.group(1).strip(), m.group(2).strip()))
    return pairs


def _is_site(url):
    host = re.sub(r"^https?://(www\.)?", "", url.lower()).split("/")[0]
    return any(s in host for s in SITES)


def _match(label, names, url=""):
    """Index of the entry whose name best fits the link's label (or web address), or -1."""
    lab = _norm(label)
    host = re.sub(r"[^a-z0-9]", "", re.sub(r"^https?://(www\.)?", "", url.lower()).split("/")[0])
    if host:
        for i, n in enumerate(names):
            first = (_norm(n).split() or [""])[0]
            if len(first) >= 4 and first in host:
                return i
    if not lab:
        return -1
    lab_words = set(lab.split())
    best, best_i = 0.0, -1
    for i, n in enumerate(names):
        nn = _norm(n)
        if not nn:
            continue
        if nn in lab or lab in nn:
            score = 1.0
        else:
            words = set(nn.split())
            score = len(words & lab_words) / len(words) if words else 0
        if score > best:
            best, best_i = score, i
    return best_i if best >= 0.6 else -1


def _repair(items, pairs):
    """A header entry such as "GitHub: Sumith0805" is only text. Swap it for the real address."""
    out = []
    for item in items:
        plain = item.strip()
        if plain and (re.search(r"\s", plain) or "." not in plain):
            low = plain.lower()
            hit = next((u for lab, u in pairs if _is_site(u) and any(s in low and s in u.lower() for s in SITES)), "")
            if hit:
                plain = hit
        out.append(plain)
    return out


def apply_links(resume, raw_text):
    """Puts hidden links onto the parsed resume: profile sites into the header, the rest on
    the project or job they belong to. Never changes anything that already has a link."""
    pairs = read_block(raw_text)
    if not pairs or not isinstance(resume, dict):
        return 0
    contact = resume.get("contact") if isinstance(resume.get("contact"), dict) else {}
    resume["contact"] = contact
    have = _repair([str(x) for x in (contact.get("links") or [])], pairs)
    have_norm = {re.sub(r"^https?://(www\.)?", "", h.lower()).rstrip("/") for h in have}
    projects = [p for p in (resume.get("projects") or []) if isinstance(p, dict)]
    jobs = [e for e in (resume.get("experience") or []) if isinstance(e, dict)]
    added = 0
    for label, url in pairs:
        key = re.sub(r"^https?://(www\.)?", "", url.lower()).rstrip("/")
        if key in have_norm:
            continue
        if _is_site(url):
            have.append(url)
            have_norm.add(key)
            added += 1
            continue
        i = _match(label, [p.get("name", "") for p in projects], url)
        if i >= 0 and not projects[i].get("link"):
            projects[i]["link"] = url
            added += 1
            continue
        j = _match(label, [e.get("company", "") or e.get("title", "") for e in jobs], url)
        if j >= 0 and not jobs[j].get("link"):
            jobs[j]["link"] = url
            added += 1
    contact["links"] = have
    return added


def restore_links(orig, result):
    """After a rewrite, copy project and job links back from the original by name."""
    if not isinstance(orig, dict) or not isinstance(result, dict):
        return
    for kind, key in (("projects", "name"), ("experience", "company")):
        old = {_norm(e.get(key, "")): e.get("link") for e in (orig.get(kind) or []) if isinstance(e, dict) and e.get("link")}
        for e in result.get(kind) or []:
            if isinstance(e, dict) and not e.get("link"):
                link = old.get(_norm(e.get(key, "")))
                if link:
                    e["link"] = link
