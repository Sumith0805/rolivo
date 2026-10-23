from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile

from auth import current_user
from db import User
from llm import ask_json
from parsing import clean, find_contacts, text_from_upload

router = APIRouter(prefix="/resumes", tags=["resumes"])

SYSTEM = """You turn resume text into structured JSON.
Copy the wording exactly from the resume. Never add, infer, correct or improve anything.
If something is missing, use an empty string or an empty list.
Return only JSON in exactly this shape:
{"name": "", "headline": "",
 "contact": {"email": "", "phone": "", "location": "", "links": []},
 "summary": "",
 "skills": [{"group": "", "items": []}],
 "experience": [{"title": "", "company": "", "location": "", "dates": "", "bullets": []}],
 "projects": [{"name": "", "tech": "", "bullets": []}],
 "education": [{"school": "", "degree": "", "dates": "", "details": ""}],
 "certifications": [],
 "extras": []}
If the resume groups its skills, keep the groups. Otherwise use one group named "Skills".
Keep every bullet verbatim."""


@router.post("/parse")
async def parse_resume(
    file: Optional[UploadFile] = File(None),
    text: str = Form(""),
    user: User = Depends(current_user),
):
    if file is not None and file.filename:
        raw = text_from_upload(file.filename, await file.read())
    else:
        raw = clean(text)
    data = ask_json(SYSTEM, raw)
    return {"data": data, "contacts": find_contacts(raw), "chars": len(raw)}