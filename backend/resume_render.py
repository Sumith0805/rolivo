"""Resume templates and the Word / PDF builders.

Every template is plain data (a "spec"). The same spec drives the browser preview,
the Word file and the PDF, so what the person sees is what they download.
"""
import io
import re
import unicodedata
from xml.sax.saxutils import escape

PLACEHOLDER = "[add a number]"
SECTION_KEYS = ["summary", "profiles", "skills", "experience", "projects", "education", "certifications", "achievements"]
DEFAULT_LABELS = {
    "summary": "Summary",
    "profiles": "Profiles",
    "skills": "Skills",
    "experience": "Experience",
    "projects": "Projects",
    "education": "Education",
    "certifications": "Certifications",
    "achievements": "Achievements",
}

# who each layout suits; "general" fits any role, IT or not
ROLE_GROUPS = {
    "software": "Software and IT",
    "ai_ml": "AI and data",
    "design": "Design and creative",
    "marketing": "Marketing and communications",
    "sales": "Sales and business development",
    "finance": "Finance and accounting",
    "hr": "HR and operations",
    "healthcare": "Healthcare and science",
    "education": "Teaching and research",
    "support": "Customer support",
    "general": "Any role",
}

_ORDER = ["summary", "skills", "experience", "projects", "education", "certifications", "achievements", "profiles"]

_BASE = dict(
    font="sans", size=10.5, header="left", heading="rule", accent="#1b2a49",
    density="normal", bullet="•", skills="lines", caps=True, headings={},
    heading_align="left",   # "left" or "center"
    hcolor="auto",          # heading text: "accent", "dark" or "auto" (accent for the accent style)
    rule="",                # color of the line under a heading; empty means the accent color
    smallcaps=False,        # headings in small capitals (used instead of all caps)
    name_style="bold",      # "bold" or "light"
    name_caps=False,
    entry="inline",         # "inline": Title, Org ... date   "stacked": Org ... date, then Title
    edu="inline",           # "table": date column, then Degree at School
    sep="·",                # between contact items
    link="",                # color of links; empty means the accent color
    links_in_header=True,   # False puts the links in their own Profiles section instead
    hidden=False,
    hide=[],                # sections the person chose to leave out of this copy
    order=list(_ORDER),
)

# ATS-friendly, single-column layouts: no tables for layout, no images, plain fonts.
TEMPLATES = {
    "centered_rules": dict(
        label="Centered Rules", blurb="Centered name, centered section titles with a full-width line. Links get their own Profiles section.",
        font="sans", size=9.5, header="center", heading="rule", accent="#222222", hcolor="dark", rule="#222222",
        name_caps=True, caps=False, entry="stacked", sep=" ", link="#111111", links_in_header=False, density="compact",
        heading_align="center",
        headings={"summary": "Objective"},
        order=["summary", "profiles", "experience", "education", "projects", "skills", "certifications", "achievements"],
        best_for=["software", "ai_ml", "general", "support"],
    ),
    "blue_rule": dict(
        label="Blue Rule", blurb="Blue name and section titles over a black line. Education first, perfect for students and freshers.",
        font="sans", size=9.5, header="center", heading="rule", accent="#1f5fa8", hcolor="accent", rule="#111111",
        name_caps=True, density="compact", sep="•", link="#111111", bullet="•",
        headings={"achievements": "Extracurricular", "summary": "Summary"},
        order=["education", "summary", "experience", "projects", "skills", "certifications", "achievements", "profiles"],
        best_for=["software", "ai_ml", "education", "healthcare", "general"],
    ),
    "latex_serif": dict(
        label="Serif Small Caps", blurb="Academic serif look with small-caps titles, dates on the left of education and a skills table.",
        font="serif", size=10, header="center", heading="rule", accent="#1a4fa0", hcolor="dark", rule="#111111",
        name_style="light", caps=False, smallcaps=True, sep="|", link="#1a4fa0", bullet="–", edu="table", skills="table",
        density="normal",
        order=["summary", "experience", "projects", "education", "skills", "certifications", "achievements", "profiles"],
        best_for=["education", "ai_ml", "software", "healthcare"],
    ),
    "engineer": dict(
        label="Engineer", blurb="Bold centered name, small-caps titles and tight spacing. Fits a lot on one page.",
        font="serif", size=10, header="center", heading="rule", accent="#111111", hcolor="dark", rule="#111111",
        caps=False, smallcaps=True, sep="|", link="#111111", density="compact", bullet="•",
        order=["education", "experience", "projects", "skills", "certifications", "achievements", "summary", "profiles"],
        best_for=["software", "ai_ml", "general"],
    ),
    "green_rule": dict(
        label="Green Rule", blurb="Left-aligned name with green section titles and rules. Clean for any business role.",
        font="sans", size=10, header="left", heading="rule", accent="#1b7f5c", hcolor="accent", rule="#1b7f5c",
        link="#1b7f5c",
        order=["summary", "experience", "skills", "projects", "education", "certifications", "achievements", "profiles"],
        best_for=["marketing", "sales", "hr", "support", "general"],
    ),
    "slate_stacked": dict(
        label="Slate Stacked", blurb="Company first, job title underneath, centered titles. A calm layout for experienced people.",
        font="sans", size=10, header="center", heading="rule", accent="#334155", hcolor="accent", rule="#334155",
        heading_align="center", entry="stacked", name_caps=True, link="#334155", sep="|",
        order=["summary", "experience", "skills", "education", "certifications", "achievements", "projects", "profiles"],
        best_for=["finance", "sales", "hr", "support", "marketing"],
    ),
    "fresher": dict(
        label="Fresher", blurb="Projects and skills before experience, with an education table. Made for first resumes.",
        font="sans", size=10, header="left", heading="rule", accent="#7a1f2b", hcolor="accent", rule="#7a1f2b",
        link="#7a1f2b", edu="table", skills="table", sep="|",
        order=["summary", "education", "projects", "skills", "experience", "certifications", "achievements", "profiles"],
        best_for=["software", "ai_ml", "design", "general", "marketing"],
    ),
    "executive_serif": dict(
        label="Executive Serif", blurb="Roomy serif layout with plain titles. Experience and results come first.",
        font="serif", size=11, header="left", heading="plain", accent="#222222", hcolor="dark", density="airy",
        skills="lines", link="#222222",
        order=["summary", "experience", "achievements", "education", "skills", "certifications", "projects", "profiles"],
        best_for=["finance", "sales", "hr", "general", "healthcare"],
    ),
    "plain_ats": dict(
        label="Plain ATS", blurb="No color at all. Bold black titles with a thin line, the safest layout for strict parsers.",
        font="sans", size=10, header="left", heading="rule", accent="#111111", hcolor="dark", rule="#111111", link="#111111",
        order=["summary", "skills", "experience", "projects", "education", "certifications", "achievements", "profiles"],
        best_for=["general", "finance", "hr", "support", "healthcare", "software"],
    ),
    "compact_ats": dict(
        label="Compact ATS", blurb="Dense one-page layout with pipe-separated skills. For people with a lot to show.",
        font="sans", size=9.5, header="left", heading="rule", accent="#333333", hcolor="dark", rule="#333333",
        density="compact", skills="pipe", link="#333333",
        order=["summary", "skills", "experience", "projects", "education", "certifications", "achievements", "profiles"],
        best_for=["general", "software", "finance", "hr"],
    ),
    # the earlier designs that are not repeats of the ones above
    "modern": dict(
        label="Modern", blurb="Clean sans type with colored section titles and a side accent.",
        header="left", heading="accent", accent="#4e50de", links_in_header=True,
        order=["summary", "skills", "projects", "experience", "education", "certifications", "achievements", "profiles"],
        best_for=["software", "ai_ml", "design", "marketing"],
    ),
    "projects_first": dict(
        label="Projects-first", blurb="Leads with projects. Best for students and freshers.",
        header="left", heading="accent", accent="#0e7c86",
        order=["summary", "skills", "projects", "experience", "education", "certifications", "achievements", "profiles"],
        best_for=["software", "ai_ml", "design", "general"],
    ),
    "banner": dict(
        label="Banner", blurb="Bold colored header band with your name. Stands out in creative fields (less strict-ATS friendly).",
        header="band", heading="accent", accent="#c4161d",
        order=["summary", "experience", "skills", "projects", "education", "certifications", "achievements", "profiles"],
        best_for=["marketing", "sales", "design", "support"],
    ),
    "academic": dict(
        label="Academic", blurb="Education first, serif type. For research, teaching and science.",
        font="serif", header="center", heading="rule", accent="#3b2f4a",
        order=["education", "summary", "projects", "experience", "achievements", "skills", "certifications", "profiles"],
        best_for=["education", "healthcare", "ai_ml"],
    ),
    "minimal": dict(
        label="Minimal", blurb="Light, quiet and airy, with plain section titles.",
        header="left", heading="plain", accent="#555555", density="airy",
        order=["summary", "experience", "projects", "skills", "education", "certifications", "achievements", "profiles"],
        best_for=["design", "hr", "support", "general"],
    ),
    "corporate": dict(
        label="Corporate", blurb="Navy title bars and a traditional order. Favored in business roles.",
        header="left", heading="bar", accent="#1f3a5f",
        order=["summary", "experience", "skills", "education", "certifications", "achievements", "projects", "profiles"],
        best_for=["finance", "sales", "hr", "support", "healthcare"],
    ),
    # older ids, kept so resumes saved earlier still open (they repeat designs above, so they stay hidden)
    "classic": dict(
        label="Classic", hidden=True, font="serif", header="center", heading="rule", accent="#1b2a49",
        order=["summary", "skills", "experience", "projects", "education", "certifications", "achievements", "profiles"],
        best_for=["general"], blurb="Centered name, serif type and thin rules.",
    ),
    "technical": dict(
        label="Technical", hidden=True, header="left", heading="rule", accent="#33359f", density="compact", size=10,
        order=["skills", "summary", "projects", "experience", "education", "certifications", "achievements", "profiles"],
        best_for=["software"], blurb="Skills first.",
    ),
    "compact": dict(
        label="Compact", hidden=True, header="left", heading="rule", accent="#333333", density="compact", size=9.5,
        skills="pipe", best_for=["general"], blurb="Dense one-page layout.",
    ),
}
DEFAULT_TEMPLATE = "centered_rules"
YOURS_BASE = "plain_ats"


def spec_for(template_id):
    tid = template_id if template_id in TEMPLATES else DEFAULT_TEMPLATE
    spec = {**_BASE, **TEMPLATES[tid]}
    spec["id"] = tid
    return spec


def public_catalog():
    return [spec_for(tid) for tid, t in TEMPLATES.items() if not t.get("hidden")]


_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def clean_spec(raw, base=DEFAULT_TEMPLATE):
    """Accept a spec from outside (for the person's own layout) but only known values."""
    spec = spec_for(base)
    if not isinstance(raw, dict):
        return spec
    if raw.get("font") in ("sans", "serif"):
        spec["font"] = raw["font"]
    try:
        size = float(raw.get("size"))
        if 8.5 <= size <= 12:
            spec["size"] = size
    except (TypeError, ValueError):
        pass
    for key, allowed in (("header", ("left", "center", "band")), ("heading", ("rule", "accent", "bar", "plain")),
                         ("density", ("compact", "normal", "airy")), ("skills", ("lines", "pipe", "table")),
                         ("heading_align", ("left", "center")), ("hcolor", ("auto", "accent", "dark")),
                         ("name_style", ("bold", "light")), ("entry", ("inline", "stacked")), ("edu", ("inline", "table")),
                         ("sep", ("·", "|", "•", " ")), ("bullet", ("•", "–"))):
        if raw.get(key) in allowed:
            spec[key] = raw[key]
    for key in ("accent", "rule", "link"):
        if isinstance(raw.get(key), str) and _HEX.match(raw[key]):
            spec[key] = raw[key].lower()
    for key in ("caps", "smallcaps", "name_caps", "links_in_header"):
        if isinstance(raw.get(key), bool):
            spec[key] = raw[key]
    if isinstance(raw.get("order"), list):
        order = []
        for k in raw["order"]:
            if k in SECTION_KEYS and k not in order:
                order.append(k)
        order += [k for k in spec["order"] if k not in order]
        spec["order"] = order
    if isinstance(raw.get("hide"), list):
        spec["hide"] = [k for k in raw["hide"] if k in SECTION_KEYS and k != "profiles"][:8]
    if isinstance(raw.get("headings"), dict):
        spec["headings"] = {
            k: str(v).strip()[:30] for k, v in raw["headings"].items() if k in SECTION_KEYS and str(v).strip()
        }
    spec["id"] = "yours" if raw.get("id") == "yours" else spec["id"]
    if spec["id"] == "yours":
        spec["label"] = "Your layout"
    return spec


def resolve_spec(template_id, override=None):
    if isinstance(override, dict):
        return clean_spec(override, YOURS_BASE if override.get("id") == "yours" else (template_id if template_id in TEMPLATES else DEFAULT_TEMPLATE))
    return spec_for(template_id)


# ---------------------------------------------------------------- data helpers

def _s(x):
    return x.strip() if isinstance(x, str) else ""


def _lst(x):
    return x if isinstance(x, list) else []


def safe_url(value):
    t = _s(value)
    if not t or re.search(r"\s", t):
        return ""
    url = t if re.match(r"^https?://", t, re.I) else "https://" + t
    return url if re.match(r"^https?://[^/\s]+\.[^/\s]+", url, re.I) else ""


URL_IN_TEXT = re.compile(r"((?:https?://|www\.)[^\s)]+)", re.I)


def split_urls(text):
    """Splits a sentence into [(piece, url or "")]. A web address inside it becomes its own piece."""
    out = []
    for i, part in enumerate(URL_IN_TEXT.split(text or "")):
        if not part:
            continue
        if i % 2 == 0:
            out.append((part, ""))
            continue
        clean = part.rstrip(".,;:")
        url = safe_url(clean)
        if url:
            out.append((_site_label(clean), url))
            if len(clean) < len(part):
                out.append((part[len(clean):], ""))
        else:
            out.append((part, ""))
    return out


def short_url(value):
    return re.sub(r"/+$", "", re.sub(r"^www\.", "", re.sub(r"^https?://", "", _s(value), flags=re.I), flags=re.I))


def _site_label(url):
    host = short_url(url).split("/")[0].lower()
    for key, name in (("github", "GitHub"), ("linkedin", "LinkedIn"), ("leetcode", "LeetCode"), ("kaggle", "Kaggle"),
                      ("behance", "Behance"), ("dribbble", "Dribbble"), ("medium", "Medium"), ("twitter", "Twitter"),
                      ("x.com", "X"), ("hackerrank", "HackerRank"), ("codeforces", "Codeforces")):
        if key in host:
            return name
    return host or "Website"


def entry_label(url):
    """The words shown for a project or job link: GitHub for a repository, Live demo for anything else."""
    return "GitHub" if "github." in _s(url).lower() else "Live demo"


def contact_items(resume, spec=None):
    c = resume.get("contact") if isinstance(resume.get("contact"), dict) else {}
    items = []
    if _s(c.get("email")):
        items.append((_s(c["email"]), "mailto:" + _s(c["email"])))
    if _s(c.get("phone")):
        items.append((_s(c["phone"]), ""))
    if _s(c.get("location")):
        items.append((_s(c["location"]), ""))
    if spec is None or spec.get("links_in_header", True):
        for link in _lst(c.get("links")):
            text = _s(link)
            if text:
                items.append((_site_label(text), safe_url(text)))
    return items


def heading_text(spec, key):
    label = spec["headings"].get(key) or DEFAULT_LABELS[key]
    return label.upper() if spec["caps"] and not spec["smallcaps"] else label


def section_lines(resume, key, spec=None):
    """What goes under a heading, in a neutral form both builders can print."""
    out = []
    if key == "summary":
        if _s(resume.get("summary")):
            out.append(("text", _s(resume["summary"])))
    elif key == "profiles":
        # only when the template keeps links out of the header
        if spec is not None and not spec.get("links_in_header", True):
            c = resume.get("contact") if isinstance(resume.get("contact"), dict) else {}
            for link in _lst(c.get("links")):
                text = _s(link)
                if text:
                    out.append(("profile", _site_label(text), short_url(text), safe_url(text)))
    elif key == "skills":
        for g in _lst(resume.get("skills")):
            if isinstance(g, dict):
                items = [str(i).strip() for i in _lst(g.get("items")) if str(i).strip()]
                if items:
                    out.append(("skill", _s(g.get("group")), items))
            elif str(g).strip():
                out.append(("skill", "", [str(g).strip()]))
    elif key == "experience":
        for e in _lst(resume.get("experience")):
            if isinstance(e, dict) and (_s(e.get("title")) or _s(e.get("company"))):
                out.append(("entry", _s(e.get("title")), _s(e.get("company")), _s(e.get("dates")), "",
                            [str(b).strip() for b in _lst(e.get("bullets")) if str(b).strip()], safe_url(e.get("link"))))
    elif key == "projects":
        for p in _lst(resume.get("projects")):
            if isinstance(p, dict) and _s(p.get("name")):
                out.append(("entry", _s(p["name"]), "", "", _s(p.get("tech")),
                            [str(b).strip() for b in _lst(p.get("bullets")) if str(b).strip()], safe_url(p.get("link"))))
    elif key == "education":
        for e in _lst(resume.get("education")):
            if isinstance(e, dict) and (_s(e.get("degree")) or _s(e.get("school"))):
                out.append(("edu", _s(e.get("degree")), _s(e.get("school")), _s(e.get("dates")), _s(e.get("details"))))
    elif key in ("certifications", "achievements"):
        for c in _lst(resume.get(key)):
            text = c if isinstance(c, str) else (_s(c.get("name")) if isinstance(c, dict) else "")
            if _s(text):
                out.append(("bullet", _s(text)))
    return out


def count_placeholders(resume):
    return str(resume).count(PLACEHOLDER)


def _spacing(spec):
    return {"compact": (5, 0, 1.0), "normal": (9, 1, 1.07), "airy": (13, 2, 1.18)}[spec["density"]]


def _hex_rgb(h):
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def has_content(resume, key, spec=None):
    return bool(section_lines(resume, key, spec))


def _colors(spec):
    """Resolved colors, shared by Word and PDF."""
    accent = spec["accent"]
    hc = spec["hcolor"]
    if hc == "auto":
        hc = "accent" if spec["heading"] == "accent" else "dark"
    heading = accent if hc == "accent" else "#111111"
    return {
        "accent": accent,
        "heading": heading,
        "rule": spec["rule"] or accent,
        "link": spec["link"] or accent,
        "name": accent if hc == "accent" else "#111111",
    }


def _name_text(resume, spec):
    name = _s(resume.get("name")) or "Resume"
    return name.upper() if spec["name_caps"] else name


def _edu_parts(item):
    _, degree, school, dates, details = item
    return degree, school, dates, details


def _entry_parts(spec, title, org, tech):
    """(bold text, rest on the same line, second line) for the two entry styles."""
    if spec["entry"] == "stacked":
        if org:
            return org, "", title
        return title, "", tech
    return title, org, ""


# ---------------------------------------------------------------- Word

def build_docx(resume, spec):
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
    from docx.opc.constants import RELATIONSHIP_TYPE as RT
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Mm, Pt, RGBColor

    font = {"sans": "Arial", "serif": "Times New Roman"}[spec["font"]]
    size = spec["size"]
    before, after, line = _spacing(spec)
    col = _colors(spec)
    margin = 14 if spec["density"] == "compact" else 18

    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Mm(210), Mm(297)
    sec.left_margin = sec.right_margin = Mm(margin)
    sec.top_margin = sec.bottom_margin = Mm(margin - 2)
    text_width = Mm(210 - 2 * margin)

    normal = doc.styles["Normal"]
    normal.font.name = font
    normal.font.size = Pt(size)
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), font)
    normal.paragraph_format.space_after = Pt(after)
    normal.paragraph_format.space_before = Pt(0)
    normal.paragraph_format.line_spacing = line

    def rgb(h):
        return RGBColor(*_hex_rgb(h))

    def style_run(run, sz=None, bold=False, italic=False, color=None, caps=False, smallcaps=False):
        run.font.name = font
        run._element.get_or_add_rPr().get_or_add_rFonts().set(qn("w:eastAsia"), font)
        run.font.size = Pt(sz or size)
        run.bold = bold
        run.italic = italic
        if caps:
            run.font.all_caps = True
        if smallcaps:
            run.font.small_caps = True
        if color:
            run.font.color.rgb = rgb(color) if isinstance(color, str) else RGBColor(*color)

    def hyperlink(par, text, url, sz=None, bold=False, color=None):
        r_id = par.part.relate_to(url, RT.HYPERLINK, is_external=True)
        h = OxmlElement("w:hyperlink")
        h.set(qn("r:id"), r_id)
        r = OxmlElement("w:r")
        rpr = OxmlElement("w:rPr")
        rf = OxmlElement("w:rFonts")
        rf.set(qn("w:ascii"), font)
        rf.set(qn("w:hAnsi"), font)
        rpr.append(rf)
        if bold:
            rpr.append(OxmlElement("w:b"))
        c = OxmlElement("w:color")
        c.set(qn("w:val"), (color or col["link"]).lstrip("#"))
        rpr.append(c)
        sz_el = OxmlElement("w:sz")
        sz_el.set(qn("w:val"), str(int(round((sz or size) * 2))))
        rpr.append(sz_el)
        u = OxmlElement("w:u")
        u.set(qn("w:val"), "single")
        rpr.append(u)
        r.append(rpr)
        t = OxmlElement("w:t")
        t.text = text
        t.set(qn("xml:space"), "preserve")
        r.append(t)
        h.append(r)
        par._p.append(h)

    def shade(par, fill):
        ppr = par._p.get_or_add_pPr()
        shd = OxmlElement("w:shd")
        shd.set(qn("w:val"), "clear")
        shd.set(qn("w:color"), "auto")
        shd.set(qn("w:fill"), fill.lstrip("#"))
        ppr.append(shd)

    def bottom_rule(par, color, sz=6):
        ppr = par._p.get_or_add_pPr()
        borders = OxmlElement("w:pBdr")
        b = OxmlElement("w:bottom")
        b.set(qn("w:val"), "single")
        b.set(qn("w:sz"), str(sz))
        b.set(qn("w:space"), "1")
        b.set(qn("w:color"), color.lstrip("#"))
        borders.append(b)
        ppr.append(borders)

    def add_text(p, text):
        # plain words, with any web address inside them turned into a real link
        for piece, url in split_urls(text):
            if url:
                hyperlink(p, piece, url)
            else:
                style_run(p.add_run(piece))

    def bullet_par(text):
        if spec["bullet"] == "•":
            p = doc.add_paragraph(style="List Bullet")
            add_text(p, text)
        else:
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Mm(6)
            p.paragraph_format.first_line_indent = Mm(-4)
            add_text(p, spec["bullet"] + " " + text)
        return p

    align = {"left": WD_ALIGN_PARAGRAPH.LEFT, "center": WD_ALIGN_PARAGRAPH.CENTER, "band": WD_ALIGN_PARAGRAPH.LEFT}[spec["header"]]
    first = doc.paragraphs[0] if doc.paragraphs else None

    # ---- header
    name = _name_text(resume, spec)
    p = first or doc.add_paragraph()
    p.alignment = align
    band = spec["header"] == "band"
    if band:
        shade(p, col["accent"])
        p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(1 if not band else 0)
    big = size + (13 if spec["density"] != "compact" else 10)
    style_run(p.add_run(name), sz=big, bold=spec["name_style"] == "bold", color="#ffffff" if band else col["name"])
    if _s(resume.get("headline")):
        h = doc.add_paragraph()
        h.alignment = align
        if band:
            shade(h, col["accent"])
        style_run(h.add_run(_s(resume["headline"])), sz=size + 0.5, color="#ffffff" if band else "#444444")
    items = contact_items(resume, spec)
    if items:
        c = doc.add_paragraph()
        c.alignment = align
        if band:
            shade(c, col["accent"])
        gap = "  " if spec["sep"] == " " else f"  {spec['sep']}  "
        for i, (text, url) in enumerate(items):
            if i:
                style_run(c.add_run(gap), sz=size - 1, color="#ffffff" if band else "#666666")
            if url:
                hyperlink(c, text, url, sz=size - 1, color="#ffffff" if band else None)
            else:
                style_run(c.add_run(text), sz=size - 1, color="#ffffff" if band else "#333333")
        c.paragraph_format.space_after = Pt(2)

    # ---- sections
    for key in spec["order"]:
        if key in spec.get("hide", []):
            continue
        lines = section_lines(resume, key, spec)
        if not lines:
            continue
        hp = doc.add_paragraph()
        hp.alignment = WD_ALIGN_PARAGRAPH.CENTER if spec["heading_align"] == "center" else WD_ALIGN_PARAGRAPH.LEFT
        hp.paragraph_format.space_before = Pt(before + 2)
        hp.paragraph_format.space_after = Pt(3)
        hp.paragraph_format.keep_with_next = True
        label = heading_text(spec, key)
        if spec["heading"] == "bar":
            shade(hp, col["accent"])
            style_run(hp.add_run(" " + label), sz=size, bold=True, color="#ffffff", smallcaps=spec["smallcaps"])
        else:
            style_run(hp.add_run(label), sz=size + 0.5 + (1 if spec["smallcaps"] else 0), bold=True, color=col["heading"],
                      smallcaps=spec["smallcaps"])
            if spec["heading"] == "rule":
                bottom_rule(hp, col["rule"])

        for item in lines:
            kind = item[0]
            if kind == "text":
                para = doc.add_paragraph()
                style_run(para.add_run(item[1]))
            elif kind == "profile":
                _, label_, shown_, url = item
                para = doc.add_paragraph()
                para.paragraph_format.space_after = Pt(0)
                style_run(para.add_run(label_), bold=True)
                para = doc.add_paragraph()
                if url:
                    hyperlink(para, shown_, url)
                else:
                    style_run(para.add_run(shown_))
            elif kind == "skill":
                para = doc.add_paragraph()
                _, group, vals = item
                if spec["skills"] == "table" and group:
                    para.paragraph_format.left_indent = Mm(42)
                    para.paragraph_format.first_line_indent = Mm(-42)
                    para.paragraph_format.tab_stops.add_tab_stop(Mm(42))
                    style_run(para.add_run(group + "\t"), bold=spec["font"] == "sans")
                    style_run(para.add_run(", ".join(vals)))
                elif spec["skills"] == "pipe":
                    if group:
                        style_run(para.add_run(group + ": "), bold=True)
                    style_run(para.add_run("  |  ".join(vals)))
                else:
                    if group:
                        style_run(para.add_run(group + ": "), bold=True)
                    style_run(para.add_run(", ".join(vals)))
            elif kind == "bullet":
                bullet_par(item[1])
            elif kind == "edu":
                degree, school, dates, details = _edu_parts(item)
                para = doc.add_paragraph()
                para.paragraph_format.space_before = Pt(2)
                para.paragraph_format.keep_with_next = bool(details)
                if spec["edu"] == "table":
                    para.paragraph_format.left_indent = Mm(30)
                    para.paragraph_format.first_line_indent = Mm(-30)
                    para.paragraph_format.tab_stops.add_tab_stop(Mm(30))
                    para.paragraph_format.tab_stops.add_tab_stop(text_width, WD_TAB_ALIGNMENT.RIGHT)
                    style_run(para.add_run((dates or "") + "\t"))
                    if degree:
                        style_run(para.add_run(degree))
                    if school:
                        style_run(para.add_run((" at " if degree else "")))
                        style_run(para.add_run(school), bold=True)
                    if details and len(details) <= 22:
                        style_run(para.add_run("\t" + details))
                        details = ""
                else:
                    para.paragraph_format.tab_stops.add_tab_stop(text_width, WD_TAB_ALIGNMENT.RIGHT)
                    if spec["entry"] == "stacked":
                        style_run(para.add_run(school or degree), bold=True)
                        if dates:
                            style_run(para.add_run("\t" + dates), color="#555555")
                        if school and degree:
                            sub = doc.add_paragraph()
                            style_run(sub.add_run(degree))
                    else:
                        style_run(para.add_run(degree), bold=True)
                        if school:
                            style_run(para.add_run((", " if degree else "") + school))
                        if dates:
                            style_run(para.add_run("\t" + dates), color="#555555")
                if details:
                    dp = doc.add_paragraph()
                    if spec["edu"] == "table":
                        dp.paragraph_format.left_indent = Mm(30)
                    style_run(dp.add_run(details))
            else:  # entry
                _, title, org, dates, tech, bullets, link = item
                para = doc.add_paragraph()
                para.paragraph_format.keep_with_next = bool(bullets)
                para.paragraph_format.space_before = Pt(2)
                para.paragraph_format.tab_stops.add_tab_stop(text_width, WD_TAB_ALIGNMENT.RIGHT)
                lead, rest, second = _entry_parts(spec, title, org, tech)
                if link and not second:
                    hyperlink(para, lead, link, bold=True)
                else:
                    style_run(para.add_run(lead), bold=True)
                if rest:
                    style_run(para.add_run((", " if lead else "") + rest))
                if tech and spec["entry"] != "stacked":
                    style_run(para.add_run("  |  " + tech), italic=True)
                if dates:
                    style_run(para.add_run("\t" + dates), color="#555555")
                if second:
                    sp = doc.add_paragraph()
                    sp.paragraph_format.keep_with_next = bool(bullets)
                    sp.paragraph_format.space_after = Pt(0)
                    style_run(sp.add_run(second), italic=bool(tech) and not org)
                    if link:
                        style_run(sp.add_run("  "))
                        hyperlink(sp, entry_label(link), link)
                for b in bullets:
                    bullet_par(b)
    doc.core_properties.title = f"{_s(resume.get('name')) or 'Resume'} - Resume"
    doc.core_properties.author = _s(resume.get("name")) or "Resume"
    out = io.BytesIO()
    doc.save(out)
    return out.getvalue()


# ---------------------------------------------------------------- PDF

def _pdf_text(value):
    """Escape for the PDF engine and keep to characters its standard fonts can draw."""
    s = escape(str(value))
    out = []
    for ch in s:
        try:
            ch.encode("cp1252")
            out.append(ch)
        except UnicodeEncodeError:
            plain = unicodedata.normalize("NFKD", ch).encode("ascii", "ignore").decode()
            out.append(plain or "?")
    return "".join(out)


def build_pdf(resume, spec):
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import BaseDocTemplate, Frame, HRFlowable, KeepTogether, PageTemplate, Paragraph, Spacer, Table, TableStyle

    reg, bold, ital = {"sans": ("Helvetica", "Helvetica-Bold", "Helvetica-Oblique"),
                       "serif": ("Times-Roman", "Times-Bold", "Times-Italic")}[spec["font"]]
    size = spec["size"]
    before, after, line = _spacing(spec)
    col = _colors(spec)
    accent = colors.HexColor(col["accent"])
    link_hex = col["link"]
    margin = (14 if spec["density"] == "compact" else 18) * mm
    width = A4[0] - 2 * margin
    align = {"left": TA_LEFT, "center": TA_CENTER, "band": TA_LEFT}[spec["header"]]
    quote = {chr(34): "&quot;"}

    def st(name, **kw):
        base = dict(fontName=reg, fontSize=size, leading=size * (1.2 + (line - 1) * 0.6), spaceAfter=after, textColor=colors.HexColor("#1a1a1a"))
        base.update(kw)
        return ParagraphStyle(name, **base)

    def link_markup(text, url, color=None):
        t = _pdf_text(text)
        if not url:
            return t
        return f'<a href="{escape(url, quote)}" color="{color or link_hex}"><u>{t}</u></a>'

    def table_style(extra=()):
        return TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                           ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                           ("VALIGN", (0, 0), (-1, -1), "TOP"), *extra])

    body = st("body")
    name = _name_text(resume, spec)
    band = spec["header"] == "band"
    name_size = size + (13 if spec["density"] != "compact" else 10)
    name_color = "#ffffff" if band else col["name"]
    name_font = bold if spec["name_style"] == "bold" else reg
    story = []

    head = [Paragraph(f'<font name="{name_font}" color="{name_color}" size="{name_size}">{_pdf_text(name)}</font>',
                      st("name", alignment=align, leading=name_size * 1.2, spaceAfter=1))]
    if _s(resume.get("headline")):
        head.append(Paragraph(f'<font color="{"#ffffff" if band else "#444444"}">{_pdf_text(resume["headline"])}</font>',
                              st("headline", alignment=align)))
    items = contact_items(resume, spec)
    if items:
        parts = []
        sep_color = "#ffffff" if band else "#666666"
        for text, url in items:
            if url:
                parts.append(link_markup(text, url, "#ffffff" if band else None))
            else:
                parts.append(f'<font color="{"#ffffff" if band else "#333333"}">{_pdf_text(text)}</font>')
        gap = "&nbsp;&nbsp;" if spec["sep"] == " " else f"&nbsp;&nbsp;{spec['sep']}&nbsp;&nbsp;"
        head.append(Paragraph(f'<font color="{sep_color}">{gap}</font>'.join(parts),
                              st("contact", alignment=align, fontSize=size - 1, leading=(size - 1) * 1.3)))
    if band:
        t = Table([[head]], colWidths=[width])
        t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), accent), ("LEFTPADDING", (0, 0), (-1, -1), 10),
                               ("RIGHTPADDING", (0, 0), (-1, -1), 10), ("TOPPADDING", (0, 0), (-1, -1), 10),
                               ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
        story.append(t)
    else:
        story.extend(head)

    def small_caps(label, hsize):
        # reportlab has no small-caps font, so capitals are drawn larger than the rest
        out = []
        for word in label.split(" "):
            if not word:
                continue
            out.append(f'<font size="{hsize}">{_pdf_text(word[0].upper())}</font><font size="{hsize * 0.8:.1f}">{_pdf_text(word[1:].upper())}</font>')
        return " ".join(out)

    def heading_flow(label):
        halign = TA_CENTER if spec["heading_align"] == "center" else TA_LEFT
        if spec["heading"] == "bar":
            t = Table([[Paragraph(f'<font name="{bold}" color="#ffffff">{_pdf_text(label)}</font>',
                                  st("hb", spaceAfter=0, fontSize=size, alignment=halign))]], colWidths=[width])
            t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), accent), ("LEFTPADDING", (0, 0), (-1, -1), 6),
                                   ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
            return [Spacer(1, before), t, Spacer(1, 3)]
        hsize = size + 1 if spec["smallcaps"] else size + 0.5
        inner = small_caps(label, hsize) if spec["smallcaps"] else _pdf_text(label)
        flows = [Spacer(1, before), Paragraph(f'<font name="{bold}" color="{col["heading"]}">{inner}</font>',
                                              st("h", fontSize=hsize, leading=hsize * 1.25, spaceAfter=1, alignment=halign))]
        if spec["heading"] == "rule":
            flows.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor(col["rule"]), spaceBefore=1, spaceAfter=3))
        else:
            flows.append(Spacer(1, 2))
        return flows

    def two_col(left, right, left_w, right_w=None, right_align=TA_RIGHT):
        left_p = Paragraph(left, st("tl", spaceAfter=0))
        right_p = Paragraph(right, st("tr", alignment=right_align, spaceAfter=0))
        row = Table([[left_p, right_p]], colWidths=[left_w, right_w or (width - left_w)])
        row.setStyle(table_style())
        return row

    def rich(text):
        return "".join(link_markup(piece, url) if url else _pdf_text(piece) for piece, url in split_urls(text))

    def bullet_flow(text, indent=12):
        return Paragraph(rich(text), st("bl", leftIndent=indent, bulletIndent=2, spaceAfter=max(after - 1, 0)),
                         bulletText=spec["bullet"])

    def entry_flow(title, org, dates, tech, link, bullets):
        lead, rest, second = _entry_parts(spec, title, org, tech)
        left = f'<font name="{bold}">{link_markup(lead, link) if (link and not second) else _pdf_text(lead)}</font>'
        if rest:
            left += (", " if lead else "") + _pdf_text(rest)
        if tech and spec["entry"] != "stacked":
            left += f'  |  <font name="{ital}">{_pdf_text(tech)}</font>'
        if dates:
            flows = [two_col(left, f'<font color="#555555">{_pdf_text(dates)}</font>', width * 0.76)]
        else:
            flows = [Paragraph(left, st("el", spaceAfter=0))]
        if second:
            extra = f'<font name="{ital}">{_pdf_text(second)}</font>' if (tech and not org) else _pdf_text(second)
            if link:
                extra += "  " + link_markup(entry_label(link), link)
            flows.append(Paragraph(extra, st("sec", spaceAfter=0)))
        for b in bullets:
            flows.append(bullet_flow(b))
        return flows

    def edu_flow(item):
        degree, school, dates, details = _edu_parts(item)
        flows = []
        if spec["edu"] == "table":
            mid = _pdf_text(degree)
            if school:
                mid += (" at " if degree else "") + f'<font name="{bold}">{_pdf_text(school)}</font>'
            right = ""
            if details and len(details) <= 22:
                right, details = _pdf_text(details), ""
            row = Table([[Paragraph(_pdf_text(dates), st("e1", spaceAfter=0)), Paragraph(mid, st("e2", spaceAfter=0)),
                          Paragraph(right, st("e3", alignment=TA_RIGHT, spaceAfter=0))]],
                        colWidths=[30 * mm, width - 30 * mm - 30 * mm, 30 * mm])
            row.setStyle(table_style())
            flows.append(row)
            if details:
                flows.append(Paragraph(_pdf_text(details), st("ed", leftIndent=30 * mm, spaceAfter=0)))
        else:
            if spec["entry"] == "stacked":
                left = f'<font name="{bold}">{_pdf_text(school or degree)}</font>'
                right = f'<font color="#555555">{_pdf_text(dates)}</font>'
                flows.append(two_col(left, right, width * 0.76))
                if school and degree:
                    flows.append(Paragraph(_pdf_text(degree), st("es", spaceAfter=0)))
            else:
                left = f'<font name="{bold}">{_pdf_text(degree)}</font>'
                if school:
                    left += (", " if degree else "") + _pdf_text(school)
                flows.append(two_col(left, f'<font color="#555555">{_pdf_text(dates)}</font>', width * 0.76))
            if details:
                flows.append(Paragraph(_pdf_text(details), st("ed2", spaceAfter=0)))
        return flows

    for key in spec["order"]:
        if key in spec.get("hide", []):
            continue
        lines = section_lines(resume, key, spec)
        if not lines:
            continue
        flows = heading_flow(heading_text(spec, key))
        first = True
        for item in lines:
            kind = item[0]
            if kind == "text":
                part = [Paragraph(_pdf_text(item[1]), body)]
            elif kind == "profile":
                _, label_, shown_, url = item
                part = [Paragraph(f'<font name="{bold}">{_pdf_text(label_)}</font>', st("pl", spaceAfter=0)),
                        Paragraph(link_markup(shown_, url), body)]
            elif kind == "skill":
                _, group, vals = item
                if spec["skills"] == "table" and group:
                    row = Table([[Paragraph(f'<font name="{bold if spec["font"] == "sans" else reg}">{_pdf_text(group)}</font>', st("s1", spaceAfter=0)),
                                  Paragraph(", ".join(_pdf_text(v) for v in vals), st("s2", spaceAfter=0))]],
                                colWidths=[42 * mm, width - 42 * mm])
                    row.setStyle(table_style())
                    part = [row, Spacer(1, 1)]
                else:
                    joined = ("  |  " if spec["skills"] == "pipe" else ", ").join(_pdf_text(v) for v in vals)
                    label = f'<font name="{bold}">{_pdf_text(group)}: </font>' if group else ""
                    part = [Paragraph(label + joined, body)]
            elif kind == "bullet":
                part = [Paragraph(rich(item[1]), st("bl2", leftIndent=12, bulletIndent=2), bulletText=spec["bullet"])]
            elif kind == "edu":
                part = edu_flow(item) + [Spacer(1, 2)]
            else:
                _, title, org, dates, tech, bullets, link = item
                part = entry_flow(title, org, dates, tech, link, bullets)
                part.append(Spacer(1, 2))
            if first:
                story.append(KeepTogether(flows + part[:2]))
                story.extend(part[2:])
                first = False
            else:
                story.extend(part)

    out = io.BytesIO()
    doc = BaseDocTemplate(out, pagesize=A4, title=f"{_s(resume.get('name')) or 'Resume'} - Resume", author=_s(resume.get("name")) or "Resume")
    top = margin - 3 * mm
    frame = Frame(margin, top, width, A4[1] - 2 * top, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([PageTemplate(id="page", frames=[frame])])
    doc.build(story)
    return out.getvalue()


def download_name(resume, ext):
    safe = re.sub(r"[^A-Za-z0-9]+", "_", _s(resume.get("name")) or "Resume").strip("_") or "Resume"
    return f"{safe}_Resume.{ext}"
