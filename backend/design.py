import io
import re

from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from auth import current_user
from db import User
from llm import ask_json
from parsing import text_from_upload
from ratelimit import ai_limit
from page_fit import fit_to_pages
from resume_layout import detect_layout
from resume_refine import refine
from resume_render import (
    PLACEHOLDER,
    ROLE_GROUPS,
    build_docx,
    build_pdf,
    count_placeholders,
    download_name,
    public_catalog,
    resolve_spec,
)

# Templates, Word and PDF files, the person's own layout, and "change it like this".
router = APIRouter(tags=["design"])

DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
MAX_UPLOAD = 2 * 1024 * 1024


class RenderBody(BaseModel):
    resume: dict
    template: str = "centered_rules"
    spec: Optional[dict] = None  # the person's own layout, sent back as the app received it
    allow_placeholders: bool = False


class RefineBody(BaseModel):
    resume: dict
    instruction: str
    job_text: str = ""
    facts: str = ""
    template: str = "centered_rules"
    spec: Optional[dict] = None  # the layout and style on screen, so "one page" is measured on the real file


@router.get("/render/templates")
def templates():
    return {"templates": public_catalog(), "groups": ROLE_GROUPS}


def _checked(body: RenderBody):
    n = count_placeholders(body.resume)
    if n and not body.allow_placeholders:
        raise HTTPException(status_code=400, detail=f"Replace or delete the {n} {PLACEHOLDER} markers before exporting.")
    return resolve_spec(body.template, body.spec)


def _file(data: bytes, media: str, name: str):
    return StreamingResponse(io.BytesIO(data), media_type=media, headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.post("/render/docx")
def render_docx(body: RenderBody, user: User = Depends(current_user)):
    spec = _checked(body)
    return _file(build_docx(body.resume, spec), DOCX_TYPE, download_name(body.resume, "docx"))


@router.post("/render/pdf")
def render_pdf(body: RenderBody, user: User = Depends(current_user)):
    spec = _checked(body)
    return _file(build_pdf(body.resume, spec), "application/pdf", download_name(body.resume, "pdf"))


@router.post("/layout/detect")
async def layout(resume_file: UploadFile = File(...), user: User = Depends(current_user)):
    data = await resume_file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(status_code=400, detail="That file is over 2 MB.")
    name = resume_file.filename or ""
    try:
        text = text_from_upload(name, data)
    except Exception:
        return {"spec": None}
    spec = detect_layout(text, data if name.lower().endswith(".docx") else None)
    return {"spec": spec}


@router.post("/refine", dependencies=[Depends(ai_limit)])
def refine_resume(body: RefineBody, user: User = Depends(current_user)):
    instruction = body.instruction.strip()[:800]
    if len(instruction) < 3:
        raise HTTPException(status_code=400, detail="Tell Rolivo what you would like changed.")
    if re.search(r"\b(?:one|1|single)[\s-]*page", instruction, re.I):
        # measured on the real PDF; an AI cannot see how long a page is
        fitted, style, notes, ok = fit_to_pages(body.resume, resolve_spec(body.template, body.spec), body.job_text)
        return {"resume": fitted, "applied": fitted != body.resume or bool(style), "notes": notes, "style": style}
    return refine(body.resume, instruction, body.job_text, body.facts.strip()[:1500], ask_json)
