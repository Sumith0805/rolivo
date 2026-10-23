from fastapi import APIRouter, Depends, Form

from auth import current_user
from db import User
from llm import ask_json
from parsing import clean

router = APIRouter(prefix="/jobs", tags=["jobs"])

SYSTEM = """You read a job description and return structured JSON.
Use only what the text says. Do not guess or add anything.
Return only JSON in exactly this shape:
{"title": "", "company": "", "location": "", "seniority": "",
 "required_skills": [], "preferred_skills": [], "tools": [],
 "skill_groups": [{"label": "", "any_of": [], "importance": "required"}],
 "responsibilities": [], "keywords": [], "education": "", "experience_years": ""}
Rules:
- required_skills: at most 12 single skills the posting clearly requires. Short names only, such as "Python" or "SQL".
- preferred_skills: skills marked preferred, a plus, or nice to have.
- tools: software, libraries or platforms named as a single required item.
- Whenever the posting lists alternatives ("such as", "e.g.", "or", "one of", a list of similar tools), do NOT put them in required_skills or tools. Put them in skill_groups instead: one group per kind, with a short label and every named alternative in any_of. A candidate needs only ONE item from a group. importance is "required" or "preferred".
- keywords: at most 10 important terms an applicant tracking system might look for, not repeating the lists above.
- Never put a term in more than one list.- Never put a term in more than one list.
- Deep learning frameworks such as TensorFlow, PyTorch and Keras are alternatives: they MUST be one group, with the label "Deep learning frameworks". The same applies to similar libraries, such as plotting libraries, cloud providers, or NLP libraries.
- If a skill appears inside a group, do not also list it by itself."""


@router.post("/parse")
def parse_job(text: str = Form(...), user: User = Depends(current_user)):
    raw = clean(text)
    return {"data": ask_json(SYSTEM, raw), "chars": len(raw)}