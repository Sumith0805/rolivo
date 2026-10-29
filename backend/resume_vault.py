import json
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from auth import current_user
from db import Resume, User, get_db
from llm import ask_json
import links
from parsing import text_from_upload
from ratelimit import ai_limit
from user_profile import clean_profile

# Resumes a person keeps in their account, plus "fill my profile from a resume".
# A stored resume is its plain text (not the file), kept in the existing resumes table
# with kind="resumefile", so no new table is needed.
router = APIRouter(tags=["resume-vault"])

KIND = "resumefile"
MAX_UPLOAD = 2 * 1024 * 1024
MAX_STORED = 8
MAX_TEXT = 30000

AUTOFILL_SYSTEM = """You read a resume and copy its facts into a profile. Return JSON only.
Rules:
- Copy only what the resume says. Never invent, infer or improve anything. Leave a field empty when the resume does not say it.
- Keep numbers, dates, names and links exactly as written.
Shape:
{"full_name": "", "headline": "", "phone": "", "location": "", "summary": "",
 "links": {"linkedin": "", "github": "", "leetcode": "", "portfolio": ""},
 "other_links": [{"label": "", "url": ""}],
 "skills": ["each skill once"],
 "projects": [{"name": "", "tech": "", "link": "", "description": "what it says, in 1-2 sentences"}],
 "experience": [{"title": "", "company": "", "dates": "", "details": "what it says, in 1-3 sentences"}],
 "education": [{"degree": "", "school": "", "dates": "", "details": "CGPA or honours if written"}],
 "certifications": [{"name": "", "issuer": "", "year": "", "link": ""}],
 "achievements": ["one per item"]}"""


class AutofillBody(BaseModel):
    text: str


def _rows(db, user):
    return list(db.scalars(select(Resume).where(Resume.user_id == user.id, Resume.kind == KIND).order_by(Resume.id.desc())))


def _meta(row):
    try:
        data = json.loads(row.data)
    except (TypeError, ValueError):
        data = {}
    return {
        "id": row.id,
        "name": data.get("name") or row.title or "Resume",
        "chars": len(data.get("text") or ""),
        "created_at": str(getattr(row, "created_at", "") or ""),
    }


async def _read(file: UploadFile):
    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(status_code=400, detail="That file is over 2 MB.")
    name = file.filename or "resume"
    if not name.lower().endswith((".pdf", ".docx", ".txt")):
        raise HTTPException(status_code=400, detail="Use a PDF, a Word file (.docx) or a text file.")
    try:
        text = text_from_upload(name, data)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read that file. Try a different one.")
    text = (text or "").strip()
    if len(text) < 40:
        raise HTTPException(status_code=400, detail="That file has almost no readable text. It may be a scan or a picture.")
    # keep the web addresses hidden behind clickable words, so links survive the rewrite
    return name, links.add_block(text[:MAX_TEXT], name, data)


@router.post("/resumes/extract")
async def extract(file: UploadFile = File(...), user: User = Depends(current_user)):
    """Plain text of an uploaded resume, so several can be combined before a rewrite."""
    name, text = await _read(file)
    return {"name": name, "text": text}


@router.get("/profile/resumes")
def list_resumes(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return {"resumes": [_meta(r) for r in _rows(db, user)]}


@router.post("/profile/resumes")
async def add_resume(file: UploadFile = File(...), user: User = Depends(current_user), db: Session = Depends(get_db)):
    if len(_rows(db, user)) >= MAX_STORED:
        raise HTTPException(status_code=400, detail=f"You can keep up to {MAX_STORED} resumes. Delete one first.")
    name, text = await _read(file)
    row = Resume(user_id=user.id, title=name[:120], kind=KIND, data=json.dumps({"name": name, "text": text}, ensure_ascii=False))
    db.add(row)
    db.commit()
    db.refresh(row)
    return _meta(row)


def _own(db, user, resume_id):
    row = db.get(Resume, resume_id)
    if row is None or row.user_id != user.id or row.kind != KIND:
        raise HTTPException(status_code=404, detail="That resume was not found.")
    return row


@router.get("/profile/resumes/{resume_id}/text")
def resume_text(resume_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = _own(db, user, resume_id)
    data = json.loads(row.data)
    return {"name": data.get("name") or row.title, "text": data.get("text") or ""}


@router.delete("/profile/resumes/{resume_id}")
def delete_resume(resume_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = _own(db, user, resume_id)
    db.execute(delete(Resume).where(Resume.id == row.id))
    db.commit()
    return {"deleted": True}


@router.post("/profile/autofill", dependencies=[Depends(ai_limit)])
def autofill(body: AutofillBody, user: User = Depends(current_user)):
    """Reads resume text into profile fields. Nothing is saved until the person reviews and saves it."""
    text = body.text.strip()[:MAX_TEXT]
    if len(text) < 40:
        raise HTTPException(status_code=400, detail="There is not enough text in that resume to read.")
    out = ask_json(AUTOFILL_SYSTEM, text)
    return {"profile": clean_profile(out if isinstance(out, dict) else {})}
