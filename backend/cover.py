import io
import json
import re
from datetime import date
from typing import Optional
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

import links
import resumes
import rewrite
from auth import current_user
from db import User
from llm import ask_json
from parsing import clean, text_from_upload
from ratelimit import ai_limit
from resume_render import _pdf_text, contact_items, safe_url
from scoring import flatten, found_in, lst, s

# A cover letter written only from facts that are on the person's resume (or that they type).
router = APIRouter(prefix="/cover", tags=["cover"])

TONES = {
    "professional": "professional and confident",
    "warm": "warm, friendly and genuine",
    "concise": "direct and concise (under 180 words)",
}

SYSTEM = (
    "You write a cover letter for the candidate. HARD RULES:\n"
    "1. Use only facts that are in the resume or user_facts. Never add skills, tools, employers, schools, "
    "degrees, dates, titles, certifications, numbers or results that are not there.\n"
    "2. If the job asks for something the resume does not show, do not claim it. You may say the candidate is "
    "keen to learn it.\n"
    "3. Write in first person, in a {tone} tone. 3 or 4 short paragraphs, 180 to 280 words in total.\n"
    "4. Paragraph 1: why this role and company (use the company and role you are given). Paragraph 2 and 3: the "
    "two or three most relevant things from the resume, told as a short story with the real details. Last paragraph: "
    "a polite close that asks for a conversation.\n"
    "5. Plain text. No emojis, no markdown, no placeholders, no greeting and no signature (they are added later).\n"
    'Return only JSON: {{"paragraphs": ["", ""]}}'
)


def _paragraphs(raw):
    out = raw.get("paragraphs") if isinstance(raw, dict) else None
    return [s(p) for p in lst(out) if s(p)][:6]


CAP_WORD = re.compile(r"^[A-Z][A-Za-z0-9+#.\-]{2,}$")


def _problems(orig_text, allowed, paras):
    res = {"summary": " ".join(paras), "experience": [], "projects": []}
    flags = rewrite.check(orig_text, allowed, res)
    # also catch plain capitalised names (tools, places, employers) that are not on the resume
    seen = {str(f["value"]).lower() for f in flags}
    for p in paras:
        for sen in re.split(r"(?<=[.!?])\s+", p):
            words = sen.split()
            for w in words[1:]:
                w = w.strip(",.;:!?()\"'")
                if CAP_WORD.match(w) and w.lower() not in seen and not (found_in(w, orig_text) or found_in(w, allowed)):
                    seen.add(w.lower())
                    flags.append({"type": "new name", "value": w, "where": "letter"})
    return flags


def _drop_bad_sentences(paras, flags):
    bad = {str(f["value"]).lower() for f in flags}
    out = []
    for p in paras:
        keep = [
            sen for sen in re.split(r"(?<=[.!?])\s+", p)
            if not any(b in sen.lower() for b in bad)
        ]
        if keep:
            out.append(" ".join(keep))
    return out


def write_letter(resume, job_text, company, role, tone, facts):
    orig_text = "\n".join(flatten(resume))
    allowed = " ".join([facts, company, role])
    payload = json.dumps(
        {
            "company": company,
            "role": role,
            "job_posting": (job_text or "")[:5000],
            "resume": resume,
            "user_facts": facts,
        },
        ensure_ascii=False,
    )
    system = SYSTEM.format(tone=TONES.get(tone, TONES["professional"]))
    paras = _paragraphs(ask_json(system, payload, max_tokens=1500))
    flags = _problems(orig_text, allowed, paras)
    if flags:
        again = ask_json(
            system,
            payload
            + "\n\nYour draft used items that are NOT in the resume or user_facts. Rewrite it without them:\n"
            + "\n".join(f["type"] + " " + str(f["value"]) for f in flags[:15])
            + "\n\nPrevious draft:\n" + json.dumps(paras, ensure_ascii=False),
            max_tokens=1500,
        )
        paras2 = _paragraphs(again)
        flags2 = _problems(orig_text, allowed, paras2)
        if paras2 and len(flags2) <= len(flags):
            paras, flags = paras2, flags2
    removed = []
    if flags:
        removed = sorted({str(f["value"]) for f in flags})
        paras = _drop_bad_sentences(paras, flags)
    return paras, removed


def make_letter(resume, paras, company, role):
    c = resume.get("contact") if isinstance(resume.get("contact"), dict) else {}
    return {
        "name": s(resume.get("name")),
        "contact": [t for t, _u in contact_items(resume)],
        "date": date.today().strftime("%B %d, %Y").replace(" 0", " "),
        "recipient": ("Hiring Team, " + company) if company else "Hiring Manager",
        "greeting": "Dear Hiring Manager,",
        "subject": ("Application for " + role) if role else "",
        "paragraphs": paras,
        "closing": "Sincerely,",
    }


@router.post("/generate", dependencies=[Depends(ai_limit)])
async def generate(
    resume_json: str = Form(""),
    resume_file: Optional[UploadFile] = File(None),
    resume_text: str = Form(""),
    job_text: str = Form(""),
    company: str = Form(""),
    role: str = Form(""),
    tone: str = Form("professional"),
    facts: str = Form(""),
    user: User = Depends(current_user),
):
    resume = None
    if resume_json.strip():
        try:
            resume = json.loads(resume_json)
        except Exception:
            raise HTTPException(status_code=400, detail="Could not read the resume.")
    else:
        if resume_file is not None and resume_file.filename:
            data = await resume_file.read()
            raw = links.add_block(text_from_upload(resume_file.filename, data), resume_file.filename, data)
        else:
            raw = clean(resume_text)
        if len(raw.strip()) < 80:
            raise HTTPException(status_code=400, detail="Add your resume first: upload a file or pick a saved one.")
        resume = ask_json(resumes.SYSTEM, raw)
        links.apply_links(resume, raw)
    if not isinstance(resume, dict) or not s(resume.get("name")):
        raise HTTPException(status_code=400, detail="Could not find your name on that resume.")
    if len((job_text or "").strip()) < 40 and not s(role):
        raise HTTPException(status_code=400, detail="Paste the job posting, or type the role you are applying for.")
    company, role, facts = s(company)[:80], s(role)[:80], s(facts)[:1500]
    paras, removed = write_letter(resume, job_text, company, role, tone, facts)
    if not paras:
        raise HTTPException(status_code=502, detail="The letter could not be written right now. Try again.")
    return {"letter": make_letter(resume, paras, company, role), "removed": removed}


class LetterBody(BaseModel):
    letter: dict


def _clean(letter):
    L = letter if isinstance(letter, dict) else {}
    return {
        "name": s(L.get("name"))[:80],
        "contact": [s(x)[:80] for x in lst(L.get("contact")) if s(x)][:6],
        "date": s(L.get("date"))[:40],
        "recipient": s(L.get("recipient"))[:120],
        "greeting": s(L.get("greeting"))[:120] or "Dear Hiring Manager,",
        "subject": s(L.get("subject"))[:160],
        "paragraphs": [s(p)[:2000] for p in lst(L.get("paragraphs")) if s(p)][:8],
        "closing": s(L.get("closing"))[:60] or "Sincerely,",
    }


def _file_name(L, ext):
    safe = re.sub(r"[^A-Za-z0-9]+", "_", L["name"] or "Cover").strip("_") or "Cover"
    return f"{safe}_Cover_Letter.{ext}"


def build_docx(L):
    from docx import Document
    from docx.shared import Mm, Pt

    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Mm(210), Mm(297)
    sec.left_margin = sec.right_margin = Mm(22)
    sec.top_margin = sec.bottom_margin = Mm(20)
    normal = doc.styles["Normal"]
    normal.font.name = "Arial"
    normal.font.size = Pt(10.5)

    def para(text, bold=False, after=8, size=None):
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(after)
        p.paragraph_format.space_before = Pt(0)
        r = p.add_run(text)
        r.bold = bold
        if size:
            r.font.size = Pt(size)
        return p

    if L["name"]:
        para(L["name"], bold=True, after=2, size=15)
    if L["contact"]:
        para("  |  ".join(L["contact"]), after=14)
    if L["date"]:
        para(L["date"], after=8)
    if L["recipient"]:
        para(L["recipient"], after=8)
    if L["subject"]:
        para(L["subject"], bold=True, after=8)
    para(L["greeting"], after=8)
    for p in L["paragraphs"]:
        para(p, after=8)
    para(L["closing"], after=2)
    para(L["name"], after=0)
    out = io.BytesIO()
    doc.save(out)
    return out.getvalue()


def build_pdf(L):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

    out = io.BytesIO()
    doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=22 * mm, rightMargin=22 * mm, topMargin=20 * mm, bottomMargin=20 * mm,
                            title=(L["name"] + " Cover Letter").strip(), author=L["name"])
    body = ParagraphStyle("b", fontName="Helvetica", fontSize=10.5, leading=15, spaceAfter=8)
    head = ParagraphStyle("h", parent=body, fontName="Helvetica-Bold", fontSize=15, leading=18, spaceAfter=2)
    bold = ParagraphStyle("bb", parent=body, fontName="Helvetica-Bold")
    flows = []
    if L["name"]:
        flows.append(Paragraph(_pdf_text(L["name"]), head))
    if L["contact"]:
        flows.append(Paragraph(_pdf_text("  |  ".join(L["contact"])), body))
        flows.append(Spacer(1, 6))
    for key, style in (("date", body), ("recipient", body), ("subject", bold), ("greeting", body)):
        if L[key]:
            flows.append(Paragraph(_pdf_text(L[key]), style))
    for p in L["paragraphs"]:
        flows.append(Paragraph(_pdf_text(p), body))
    flows.append(Paragraph(_pdf_text(L["closing"]), ParagraphStyle("c", parent=body, spaceAfter=2)))
    flows.append(Paragraph(_pdf_text(L["name"]), body))
    doc.build(flows)
    return out.getvalue()


@router.post("/docx")
def to_docx(body: LetterBody, user: User = Depends(current_user)):
    L = _clean(body.letter)
    return Response(
        build_docx(L),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{_file_name(L, "docx")}"'},
    )


@router.post("/pdf")
def to_pdf(body: LetterBody, user: User = Depends(current_user)):
    L = _clean(body.letter)
    return Response(
        build_pdf(L),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{_file_name(L, "pdf")}"'},
    )
