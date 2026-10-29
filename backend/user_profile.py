import json
import re
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from auth import current_user
from db import Analysis, Job, Resume, User, get_db

# A person's profile (links, projects, certifications...) is stored as one JSON
# row in the existing resumes table, marked with kind="profile". No new table.
router = APIRouter(prefix="/profile", tags=["profile"])

KIND = "profile"
MAX_BYTES = 60000


class ProfileBody(BaseModel):
    profile: dict


def _s(value, limit):
    return value.strip()[:limit] if isinstance(value, str) else ""


def _url(value):
    """Keep only a real-looking http(s) address; add https:// when it is missing."""
    text = _s(value, 300)
    if not text or re.search(r"\s", text):
        return ""
    if not re.match(r"^[a-z][a-z0-9+.-]*://", text, re.I):
        text = "https://" + text
    parts = urlparse(text)
    if parts.scheme.lower() not in ("http", "https") or "." not in parts.netloc:
        return ""
    return text


def _items(value, cap):
    return [x for x in value if isinstance(x, dict)][:cap] if isinstance(value, list) else []


def _strings(value, cap, limit):
    if not isinstance(value, list):
        return []
    out = [_s(x, limit) for x in value]
    return [x for x in out if x][:cap]


def clean_profile(raw):
    raw = raw if isinstance(raw, dict) else {}
    links_in = raw.get("links") if isinstance(raw.get("links"), dict) else {}

    other = []
    for it in _items(raw.get("other_links"), 8):
        url = _url(it.get("url"))
        if url:
            other.append({"label": _s(it.get("label"), 40) or urlparse(url).netloc, "url": url})

    projects = []
    for it in _items(raw.get("projects"), 12):
        name = _s(it.get("name"), 80)
        if name:
            projects.append(
                {
                    "name": name,
                    "tech": _s(it.get("tech"), 120),
                    "link": _url(it.get("link")),
                    "description": _s(it.get("description"), 500),
                }
            )

    certs = []
    for it in _items(raw.get("certifications"), 20):
        name = _s(it.get("name"), 120)
        if name:
            certs.append(
                {
                    "name": name,
                    "issuer": _s(it.get("issuer"), 80),
                    "year": _s(it.get("year"), 10),
                    "link": _url(it.get("link")),
                }
            )

    education = []
    for it in _items(raw.get("education"), 6):
        degree, school = _s(it.get("degree"), 120), _s(it.get("school"), 120)
        if degree or school:
            education.append(
                {"degree": degree, "school": school, "dates": _s(it.get("dates"), 40), "details": _s(it.get("details"), 200)}
            )

    experience = []
    for it in _items(raw.get("experience"), 8):
        title, company = _s(it.get("title"), 100), _s(it.get("company"), 100)
        if title or company:
            experience.append(
                {"title": title, "company": company, "dates": _s(it.get("dates"), 40), "details": _s(it.get("details"), 500)}
            )

    return {
        "full_name": _s(raw.get("full_name"), 80),
        "headline": _s(raw.get("headline"), 120),
        "phone": _s(raw.get("phone"), 40),
        "location": _s(raw.get("location"), 80),
        "summary": _s(raw.get("summary"), 600),
        "links": {k: _url(links_in.get(k)) for k in ("linkedin", "github", "leetcode", "portfolio")},
        "other_links": other,
        "skills": _strings(raw.get("skills"), 60, 40),
        "projects": projects,
        "experience": experience,
        "education": education,
        "certifications": certs,
        "achievements": _strings(raw.get("achievements"), 10, 200),
    }


def _row(db, user):
    return db.scalars(select(Resume).where(Resume.user_id == user.id, Resume.kind == KIND)).first()


@router.get("")
def get_profile(user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = _row(db, user)
    if row is None:
        return {"profile": {}}
    try:
        return {"profile": json.loads(row.data)}
    except (TypeError, ValueError):
        return {"profile": {}}


@router.put("")
def save_profile(body: ProfileBody, user: User = Depends(current_user), db: Session = Depends(get_db)):
    cleaned = clean_profile(body.profile)
    data = json.dumps(cleaned, ensure_ascii=False)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="Your profile is too large to save.")
    row = _row(db, user)
    if row is None:
        db.add(Resume(user_id=user.id, title="Profile", kind=KIND, data=data))
    else:
        row.data = data
    db.commit()
    return {"profile": cleaned}


@router.delete("/library")
def delete_saved_resumes(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Delete every saved resume, but keep the person's profile."""
    db.execute(delete(Analysis).where(Analysis.user_id == user.id))
    db.execute(delete(Resume).where(Resume.user_id == user.id, or_(Resume.kind.is_(None), Resume.kind.notin_([KIND, "resumefile"]))))
    db.execute(delete(Job).where(Job.user_id == user.id))
    db.commit()
    return {"deleted": True}
