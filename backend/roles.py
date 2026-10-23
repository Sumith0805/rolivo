import re

from fastapi import APIRouter, Depends, Form

from auth import current_user
from db import User
from parsing import clean
from role_profiles import ROLES, TEMPLATES

router = APIRouter(prefix="/roles", tags=["roles"])


def _has(term, text):
    pattern = r"(?<![A-Za-z0-9+#])" + re.escape(term) + r"(?![A-Za-z0-9+#])"
    return re.search(pattern, text, re.I) is not None


def detect(text):
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    title = " ".join(lines[:3])
    scores = {}
    for rid, role in ROLES.items():
        if rid == "general":
            continue
        score = 0
        for kw in role["keywords"]:
            if _has(kw, title):
                score += 3
            elif _has(kw, text):
                score += 1
        scores[rid] = score
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    top_id, top_score = ranked[0]
    total = sum(scores.values())
    if top_score < 2:
        return "general", 0.0, ranked
    return top_id, round(top_score / total, 2), ranked


def template_info(tid):
    return {"id": tid, **TEMPLATES[tid]}


@router.get("")
def list_all():
    return {
        "roles": [
            {"id": rid, "label": r["label"], "focus": r["focus"], "templates": r["templates"]}
            for rid, r in ROLES.items()
        ],
        "templates": [template_info(tid) for tid in TEMPLATES],
    }


@router.post("/detect")
def detect_role(text: str = Form(...), user: User = Depends(current_user)):
    raw = clean(text)
    rid, confidence, ranked = detect(raw)
    role = ROLES[rid]
    return {
        "role": rid,
        "label": role["label"],
        "confidence": confidence,
        "focus": role["focus"],
        "suggested_templates": [template_info(t) for t in role["templates"]],
        "default_template": role["templates"][0],
        "alternatives": [
            {"id": r, "label": ROLES[r]["label"], "score": s}
            for r, s in ranked[:3]
            if s > 0 and r != rid
        ],
        "all_templates": [template_info(t) for t in TEMPLATES],
    }