from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel

import jobs
import resumes
from auth import current_user
from db import User
from llm import ask_json
from parsing import clean, text_from_upload
from scoring import analyze

router = APIRouter(prefix="/analysis", tags=["analysis"])


class RunBody(BaseModel):
    resume: dict
    job: dict


@router.post("/run")
def run(body: RunBody, user: User = Depends(current_user)):
    return analyze(body.resume, body.job)


@router.post("/quick")
async def quick(
    resume_file: Optional[UploadFile] = File(None),
    resume_text: str = Form(""),
    job_text: str = Form(...),
    user: User = Depends(current_user),
):
    if resume_file is not None and resume_file.filename:
        raw = text_from_upload(resume_file.filename, await resume_file.read())
    else:
        raw = clean(resume_text)
    resume = ask_json(resumes.SYSTEM, raw)
    job = ask_json(jobs.SYSTEM, clean(job_text))
    return {"resume": resume, "job": job, "analysis": analyze(resume, job)}