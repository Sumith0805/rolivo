import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from auth import current_user
from db import Analysis, Job, Resume, User, get_db

router = APIRouter(prefix="/library", tags=["library"])

MAX_ITEMS = 50
MAX_BYTES = 200000


class SaveBody(BaseModel):
    job: dict
    original: dict
    tailored: dict
    template: str = ""
    role: str = ""
    before: dict = {}
    after: dict = {}
    changes: List[str] = []


class EditBody(BaseModel):
    resume: dict
    template: str = ""


def _check_size(*parts):
    total = sum(len(json.dumps(p, ensure_ascii=False)) for p in parts)
    if total > MAX_BYTES:
        raise HTTPException(status_code=400, detail="That result is too large to save.")


def _mine(db, user, analysis_id):
    a = db.get(Analysis, analysis_id)
    if a is None or a.user_id != user.id:
        raise HTTPException(status_code=404, detail="Not found.")
    return a


@router.post("/save")
def save(body: SaveBody, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _check_size(body.job, body.original, body.tailored, body.changes)
    count = db.scalar(select(func.count()).select_from(Analysis).where(Analysis.user_id == user.id))
    if count >= MAX_ITEMS:
        raise HTTPException(
            status_code=400,
            detail=f"You can keep up to {MAX_ITEMS} saved results. Delete one first.",
        )
    job = Job(
        user_id=user.id,
        title=str(body.job.get("title") or "")[:200],
        company=str(body.job.get("company") or "")[:200],
        text=str(body.job.get("text") or "")[:20000],
    )
    db.add(job)
    db.flush()
    resume = Resume(
        user_id=user.id,
        title=(job.title or "Tailored resume")[:200],
        kind="tailored",
        job_id=job.id,
        data=json.dumps(body.tailored, ensure_ascii=False),
    )
    db.add(resume)
    db.flush()
    extra = {
        "original": body.original,
        "before": body.before,
        "after": body.after,
        "changes": body.changes,
        "template": body.template,
        "role": body.role,
    }
    analysis = Analysis(
        user_id=user.id,
        resume_id=resume.id,
        job_id=job.id,
        score=float(body.after.get("overall") or 0),
        data=json.dumps(extra, ensure_ascii=False),
    )
    db.add(analysis)
    db.commit()
    return {"id": analysis.id}


@router.get("")
def list_saved(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Analysis).where(Analysis.user_id == user.id).order_by(Analysis.created_at.desc())
    ).all()
    out = []
    for a in rows:
        d = json.loads(a.data)
        job = db.get(Job, a.job_id) if a.job_id else None
        out.append(
            {
                "id": a.id,
                "created_at": a.created_at.isoformat(),
                "job_title": job.title if job else "",
                "company": job.company if job else "",
                "role": d.get("role", ""),
                "template": d.get("template", ""),
                "before": d.get("before", {}),
                "after": d.get("after", {}),
            }
        )
    return out


@router.get("/{analysis_id}")
def open_saved(analysis_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    a = _mine(db, user, analysis_id)
    d = json.loads(a.data)
    job = db.get(Job, a.job_id) if a.job_id else None
    resume = db.get(Resume, a.resume_id) if a.resume_id else None
    return {
        "id": a.id,
        "created_at": a.created_at.isoformat(),
        "job": {
            "title": job.title if job else "",
            "company": job.company if job else "",
            "text": job.text if job else "",
        },
        "tailored": json.loads(resume.data) if resume else {},
        "original": d.get("original", {}),
        "before": d.get("before", {}),
        "after": d.get("after", {}),
        "changes": d.get("changes", []),
        "template": d.get("template", ""),
        "role": d.get("role", ""),
    }


@router.put("/{analysis_id}")
def edit_saved(
    analysis_id: int,
    body: EditBody,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    a = _mine(db, user, analysis_id)
    _check_size(body.resume)
    resume = db.get(Resume, a.resume_id)
    if resume is None:
        raise HTTPException(status_code=404, detail="Not found.")
    resume.data = json.dumps(body.resume, ensure_ascii=False)
    if body.template:
        d = json.loads(a.data)
        d["template"] = body.template
        a.data = json.dumps(d, ensure_ascii=False)
    db.commit()
    return {"saved": True}


@router.delete("/{analysis_id}")
def delete_one(analysis_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    a = _mine(db, user, analysis_id)
    resume_id, job_id = a.resume_id, a.job_id
    db.delete(a)
    db.flush()
    if resume_id:
        db.execute(delete(Resume).where(Resume.id == resume_id, Resume.user_id == user.id))
    if job_id:
        db.execute(delete(Job).where(Job.id == job_id, Job.user_id == user.id))
    db.commit()
    return {"deleted": True}


@router.delete("")
def delete_all(user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(delete(Analysis).where(Analysis.user_id == user.id))
    db.execute(delete(Resume).where(Resume.user_id == user.id))
    db.execute(delete(Job).where(Job.user_id == user.id))
    db.commit()
    return {"deleted": True}