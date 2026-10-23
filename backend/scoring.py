import re

SYNONYMS = [
    {"javascript", "js"}, {"typescript", "ts"}, {"machine learning", "ml"},
    {"natural language processing", "nlp"}, {"deep learning", "dl"},
    {"kubernetes", "k8s"}, {"postgresql", "postgres"},
    {"node.js", "nodejs", "node"}, {"react", "react.js", "reactjs"},
    {"scikit-learn", "sklearn", "scikit learn"},
    {"gcp", "google cloud platform"},
    {"aws", "amazon web services"},
    {"large language models", "large language model", "llm", "llms"},
    {"artificial intelligence", "ai"},
    {"rest", "rest api", "rest apis", "restful"},
    {"ci/cd", "cicd", "continuous integration"},
    {"power bi", "powerbi"}, {"mongodb", "mongo"}, {"html", "html5"}, {"css", "css3"},
    {"tensorflow", "tf"}, {"pytorch", "torch"}, {"c++", "cpp"}, {"c#", "csharp"},
    {"data structures", "dsa", "data structures and algorithms"},
    {"object-oriented programming", "object oriented programming", "oop"},
]

IRREGULAR = {
    "built", "led", "wrote", "ran", "made", "drove", "took", "grew",
    "won", "taught", "chose", "began", "set", "cut", "put",
}
SYMBOLS = re.compile(
    r"[\u2190-\u21FF\u2300-\u23FF\u2600-\u27BF\u2B00-\u2BFF\U0001F300-\U0001FAFF]"
)
STRONG = {"experience", "projects", "summary"}
TIERS = [("required", 45), ("tools", 15), ("preferred", 10), ("keywords", 10)]
TIER_LABEL = {
    "required": "required skills",
    "tools": "tools",
    "preferred": "preferred skills",
    "keywords": "keywords",
}
EXCEL_FORMAT = r"csv\s*/\s*excel|excel\s*/\s*csv|excel\s+files?"


def s(x):
    return x.strip() if isinstance(x, str) else ""


def lst(x):
    return x if isinstance(x, list) else []


def flatten(x):
    if isinstance(x, str):
        return [x]
    if isinstance(x, dict):
        return [t for v in x.values() for t in flatten(v)]
    if isinstance(x, list):
        return [t for v in x for t in flatten(v)]
    return []


def variants(term):
    t = " ".join(s(term).lower().split())
    for group in SYNONYMS:
        if t in group:
            return group
    if len(t) > 3 and t.endswith("s") and not t.endswith("ss"):
        return {t, t[:-1]}
    return {t}


def _pattern(v, plural):
    body = r"[\s\-]+".join(re.escape(p) for p in v.split())
    tail = "(?:s|es)?" if plural else ""
    return r"(?<![A-Za-z0-9+#])" + body + tail + r"(?![A-Za-z0-9+#])"


def found_in(term, text):
    if s(term).lower() == "excel":
        text = re.sub(EXCEL_FORMAT, " ", text, flags=re.I)
    for v in variants(term):
        if len(v) <= 2:
            for form in {v.upper(), v.capitalize()}:
                if re.search(_pattern(form, False), text):
                    return True
        elif re.search(_pattern(v, True), text, re.I):
            return True
    return False


def clean_terms(items, seen):
    out = []
    for t in lst(items):
        t = s(t)
        if not t or len(t) > 40 or len(t.split()) > 5:
            continue
        key = tuple(sorted(variants(t)))
        if key in seen:
            continue
        seen.add(key)
        out.append(t)
    return out[:25]


def section_texts(r):
    skills = []
    for g in lst(r.get("skills")):
        if isinstance(g, dict):
            skills.append(s(g.get("group")))
            skills += [s(i) for i in lst(g.get("items"))]
        else:
            skills.append(s(g))
    exp = []
    for e in lst(r.get("experience")):
        if isinstance(e, dict):
            exp += [s(e.get("title")), s(e.get("company"))]
            exp += [s(b) for b in lst(e.get("bullets"))]
    proj = []
    for p in lst(r.get("projects")):
        if isinstance(p, dict):
            proj += [s(p.get("name")), s(p.get("tech"))]
            proj += [s(b) for b in lst(p.get("bullets"))]
    edu = []
    for e in lst(r.get("education")):
        if isinstance(e, dict):
            edu += [s(e.get("school")), s(e.get("degree")), s(e.get("details"))]
    other = flatten(r.get("certifications")) + flatten(r.get("extras"))
    return {
        "skills": "\n".join(skills),
        "experience": "\n".join(exp),
        "projects": "\n".join(proj),
        "summary": s(r.get("summary")) + "\n" + s(r.get("headline")),
        "education": "\n".join(edu),
        "other": "\n".join(other),
    }


def bullets_of(r):
    out = []
    for key in ("experience", "projects"):
        for e in lst(r.get(key)):
            if isinstance(e, dict):
                out += [s(b) for b in lst(e.get("bullets")) if s(b)]
    return out


def starts_with_verb(b):
    parts = b.split()
    w = re.sub(r"[^a-z]", "", parts[0].lower()) if parts else ""
    return w in IRREGULAR or (w.endswith("ed") and len(w) > 3)


def ats_checks(r):
    c = r.get("contact") if isinstance(r.get("contact"), dict) else {}
    email, phone = s(c.get("email")), s(c.get("phone"))
    links = " ".join(s(x) for x in lst(c.get("links"))).lower()
    bl = bullets_of(r)
    texts = flatten(r)
    words = len(re.findall(r"\w+", " ".join(texts)))
    checks = []

    def add(cid, label, status, detail, fix, weight):
        checks.append({
            "id": cid, "label": label, "status": status, "detail": detail,
            "fix": fix if status != "pass" else "", "weight": weight,
        })

    add("email", "Email address", "pass" if "@" in email else "fail",
        email or "No email found",
        "Put a professional email address at the top, as plain text.", 10)

    digits = len(re.findall(r"\d", phone))
    add("phone", "Phone number", "pass" if digits >= 8 else "warn",
        "Found" if digits >= 8 else "No phone number found",
        "Add a phone number with the country code in the header.", 5)

    if "linkedin" in links or "github" in links:
        add("links", "Profile links", "pass", "LinkedIn or GitHub found", "", 5)
    else:
        add("links", "Profile links", "warn", "No LinkedIn or GitHub link found",
            "Add your LinkedIn and GitHub addresses as plain text in the header.", 5)

    exp = [e for e in lst(r.get("experience")) if isinstance(e, dict)]
    proj = [p for p in lst(r.get("projects")) if isinstance(p, dict)]
    if exp or proj:
        add("work", "Experience or projects section", "pass",
            f"{len(exp)} experience and {len(proj)} project entries", "", 10)
    else:
        add("work", "Experience or projects section", "fail", "Neither was found",
            "Add an Experience or Projects section with bullet points.", 10)

    edu = [
        e for e in lst(r.get("education"))
        if isinstance(e, dict) and (s(e.get("school")) or s(e.get("degree")))
    ]
    add("education", "Education section", "pass" if edu else "fail",
        f"{len(edu)} entries" if edu else "Not found",
        "Add an Education section with the degree, school and years.", 8)

    n_skills = sum(
        len(lst(g.get("items"))) if isinstance(g, dict) else 1
        for g in lst(r.get("skills"))
    )
    skills_status = "pass" if n_skills >= 6 else "warn" if n_skills >= 1 else "fail"
    add("skills", "Skills section", skills_status, f"{n_skills} skills listed",
        "Add a Skills section with at least 6 relevant skills, grouped by type.", 10)

    sw = len(re.findall(r"\w+", s(r.get("summary"))))
    if sw == 0:
        add("summary", "Short summary", "warn", "No summary found",
            "Add a 2 to 3 line summary that names your target role and "
            "strongest skills.", 5)
    elif sw > 70:
        add("summary", "Short summary", "warn", f"{sw} words, which is long",
            "Cut the summary to 2 or 3 lines, under 70 words.", 5)
    else:
        add("summary", "Short summary", "pass", f"{sw} words", "", 5)

    if bl:
        verbs = sum(starts_with_verb(b) for b in bl) / len(bl)
        add("verbs", "Bullets start with action verbs",
            "pass" if verbs >= 0.7 else "warn" if verbs >= 0.4 else "fail",
            f"{round(verbs * 100)}% of bullets",
            "Start each bullet with a past-tense action verb such as Built, "
            "Designed or Reduced.", 10)

        nums = sum(bool(re.search(r"\d", b)) for b in bl) / len(bl)
        add("metrics", "Bullets include numbers",
            "pass" if nums >= 0.3 else "warn" if nums >= 0.15 else "fail",
            f"{round(nums * 100)}% of bullets",
            "Add real numbers to bullets (users, rows, accuracy, time saved). "
            "Only use numbers that are true.", 12)

        ok_len = sum(8 <= len(b.split()) <= 35 for b in bl) / len(bl)
        add("length", "Bullet length",
            "pass" if ok_len >= 0.8 else "warn" if ok_len >= 0.5 else "fail",
            f"{round(ok_len * 100)}% of bullets are 8 to 35 words",
            "Keep each bullet to one or two lines: about 8 to 35 words.", 6)
    else:
        add("verbs", "Bullets start with action verbs", "fail", "No bullet points found",
            "Describe your work as short bullet points, each starting with an "
            "action verb.", 10)
        add("metrics", "Bullets include numbers", "fail", "No bullet points found",
            "Add bullets with real numbers that show results.", 12)

    if 300 <= words <= 800:
        add("words", "Resume length", "pass", f"{words} words", "", 6)
    else:
        add("words", "Resume length", "warn" if 200 <= words <= 1000 else "fail",
            f"{words} words",
            "Aim for roughly 300 to 800 words, which fits one page for a student "
            "or one to two pages for experience.", 6)

    dated = exp + edu
    if dated:
        share = sum(bool(s(e.get("dates"))) for e in dated) / len(dated)
        add("dates", "Dates on entries",
            "pass" if share >= 0.8 else "warn" if share >= 0.5 else "fail",
            f"{round(share * 100)}% of entries have dates",
            "Give every job and degree a date range, such as Jan 2025 - Mar 2025.", 6)

    odd = sorted(set(SYMBOLS.findall(" ".join(texts))))
    add("symbols", "Plain text, no decorative symbols", "warn" if odd else "pass",
        ("Found: " + " ".join(odd[:6])) if odd else "None found",
        "Remove icons, arrows, stars and emoji. Use plain text and standard bullets.", 7)

    credit = {"pass": 1.0, "warn": 0.5, "fail": 0.0}
    total = sum(x["weight"] for x in checks)
    done = sum(x["weight"] * credit[x["status"]] for x in checks)
    score = round(100 * done / total) if total else 0
    order = {"fail": 0, "warn": 1, "pass": 2}
    checks.sort(key=lambda x: order[x["status"]])
    return checks, score


HINTS = {
    "visual": ["data visualization"],
    "nlp": ["natural language processing", "nlp"],
    "deep learning": ["deep learning"],
}


def group_hints(label):
    low = label.lower()
    out = []
    for key, terms in HINTS.items():
        if key in low:
            out += terms
    return out


def _where(term, sections):
    return [sec for sec, text in sections.items() if text and found_in(term, text)]


def _credit(where):
    if not where:
        return 0.0
    return 1.0 if any(w in STRONG for w in where) else 0.7


def _label(item):
    if item["any_of"]:
        return f'{item["term"]} (any one of: {", ".join(item["any_of"][:5])})'
    return item["term"]


def analyze(resume, job):
    resume = resume if isinstance(resume, dict) else {}
    job = job if isinstance(job, dict) else {}
    sections = section_texts(resume)

    seen = set()
    groups = {"required": [], "preferred": []}
    for g in lst(job.get("skill_groups")):
        if not isinstance(g, dict):
            continue
        members = clean_terms(g.get("any_of"), set())
        if not members:
            continue
        for m in members:
            seen.add(tuple(sorted(variants(m))))
        label = s(g.get("label")) or members[0]
        tier = "preferred" if s(g.get("importance")).lower() == "preferred" else "required"
        groups[tier].append((label, members))

    fields = {
        "required": "required_skills", "tools": "tools",
        "preferred": "preferred_skills", "keywords": "keywords",
    }
    tiers = {name: clean_terms(job.get(fields[name]), seen) for name, _w in TIERS}

    results, num, den = {}, 0.0, 0
    for name, weight in TIERS:
        items = []
        for term in tiers[name]:
            where = _where(term, sections)
            items.append({
                "term": term, "found": bool(where), "where": where,
                "credit": _credit(where), "any_of": [],
                "matched": term if where else "",
            })
        for label, members in groups.get(name, []):
            best = {"where": [], "credit": 0.0, "member": ""}
            for m in members + group_hints(label):
                where = _where(m, sections)
                credit = _credit(where)
                if credit > best["credit"]:
                    best = {"where": where, "credit": credit, "member": m}
            items.append({
                "term": label, "found": best["credit"] > 0, "where": best["where"],
                "credit": best["credit"], "any_of": members, "matched": best["member"],
            })
        cov = sum(i["credit"] for i in items) / len(items) if items else None
        results[name] = {"weight": weight, "coverage": cov, "terms": items}
        if items:
            num += weight * cov
            den += weight
    match = round(100 * num / den) if den else None

    checks, ats = ats_checks(resume)
    overall = round(0.75 * match + 0.25 * ats) if match is not None else ats

    fixes = []
    for name in ("required", "tools"):
        missing = [_label(i) for i in results[name]["terms"] if not i["found"]]
        if missing:
            fixes.append({
                "priority": "high",
                "title": f"Missing {TIER_LABEL[name]}: " + ", ".join(missing[:8]),
                "detail": "If you have really used these, add them to your Skills "
                          "section and show each one in a bullet. If you haven't, "
                          "don't add them. Consider learning the most common one.",
            })
    weak = [
        i["matched"] or i["term"]
        for name in ("required", "tools")
        for i in results[name]["terms"]
        if i["found"] and i["credit"] < 1.0
    ]
    if weak:
        fixes.append({
            "priority": "medium",
            "title": "Listed but not shown in use: " + ", ".join(weak[:8]),
            "detail": "These only appear in your Skills list. Mention each in a "
                      "project or experience bullet that shows what you did with it.",
        })
    for chk in checks:
        if chk["status"] != "pass":
            fixes.append({
                "priority": "high" if chk["status"] == "fail" else "medium",
                "title": chk["label"] + ": " + chk["detail"],
                "detail": chk["fix"],
            })
    missing_pref = [
        _label(i)
        for name in ("preferred", "keywords")
        for i in results[name]["terms"]
        if not i["found"]
    ]
    if missing_pref:
        fixes.append({
            "priority": "low",
            "title": "Not found (nice to have): " + ", ".join(missing_pref[:10]),
            "detail": "Add these only where they are true, naturally and in your "
                      "own words. Never keyword-stuff.",
        })
    rank = {"high": 0, "medium": 1, "low": 2}
    fixes.sort(key=lambda f: rank[f["priority"]])

    return {
        "match_score": match,
        "ats_score": ats,
        "overall": overall,
        "tiers": results,
        "checks": checks,
        "fixes": fixes,
        "weights": {"required": 45, "tools": 15, "preferred": 10, "keywords": 10,
                    "overall": "75% match + 25% ATS-readiness"},
        "note": "These scores are estimates. Every company's applicant tracking system "
                "works differently, and nobody can guarantee a shortlist.",
    }