import hashlib
import hmac
import json
import os
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from html import escape

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import ALGORITHM, SECRET_KEY, current_user, make_token, ph
from db import User, get_db
from mailer import MailError, send_email

# Forgot password, set a new password, and "change my password" from Settings.
# The emailed link carries a signed token that lasts 30 minutes and stops working
# once the password changes, so no new table is needed.
router = APIRouter(prefix="/auth", tags=["account"])

RESET_MINUTES = 30
_recent = {}  # email -> times of recent requests (kept in memory; fine for one server)


class EmailBody(BaseModel):
    email: str


class ResetBody(BaseModel):
    token: str
    password: str


def _fingerprint(user):
    return hashlib.sha256(user.password_hash.encode()).hexdigest()[:16]


def _make_reset_token(user, minutes=RESET_MINUTES):
    exp = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    return jwt.encode({"sub": str(user.id), "purpose": "reset", "fp": _fingerprint(user), "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)


def _user_from_token(token, db):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("purpose") != "reset":
            raise ValueError("wrong kind of token")
        user = db.get(User, int(payload["sub"]))
    except Exception:
        raise HTTPException(status_code=400, detail="This link has expired or is not valid. Ask for a new one.")
    if user is None or payload.get("fp") != _fingerprint(user):
        raise HTTPException(status_code=400, detail="This link was already used or has expired. Ask for a new one.")
    return user


def _base_url(request):
    # use the page the person is on, when it is one of the sites this server trusts
    configured = os.getenv("ALLOWED_ORIGINS", "")
    allowed = [o.strip().rstrip("/") for o in configured.split(",") if o.strip()]
    origin = (request.headers.get("origin") or "").rstrip("/")
    local = origin.startswith(("http://localhost:", "http://127.0.0.1:"))
    if origin and (origin in allowed or (local and not configured)):
        return origin
    return os.getenv("APP_URL", "http://localhost:5173").rstrip("/")


def _throttle(email):
    now = time.time()
    hits = [t for t in _recent.get(email, []) if now - t < 15 * 60]
    if len(hits) >= 3:
        raise HTTPException(status_code=429, detail="Too many requests for this email. Wait a few minutes and try again.")
    hits.append(now)
    _recent[email] = hits


def _refund(email):
    """A send that failed does not count against the person's limit."""
    hits = _recent.get(email) or []
    if hits:
        hits.pop()


def _send_link(user, request, reason):
    link = f"{_base_url(request)}/reset-password?token={_make_reset_token(user)}"
    subject = "Set a new Rolivo password"
    text = (
        f"Hi,\n\nYou asked to {reason}. Open this link to choose a new password (it works for {RESET_MINUTES} minutes and only once):\n\n"
        f"{link}\n\nIf you did not ask for this, ignore this email. Your password stays the same.\n\n- Rolivo"
    )
    html = (
        f"<p>Hi,</p><p>You asked to {escape(reason)}. This link lets you choose a new password. "
        f"It works for {RESET_MINUTES} minutes and only once.</p>"
        f'<p><a href="{escape(link)}" style="display:inline-block;padding:12px 22px;border-radius:999px;'
        f'background:#f32e35;color:#ffffff;text-decoration:none;font-weight:600">Choose a new password</a></p>'
        f'<p style="color:#666">If the button does not work, paste this into your browser:<br>{escape(link)}</p>'
        f"<p style=\"color:#666\">If you did not ask for this, ignore this email. Your password stays the same.</p><p>- Rolivo</p>"
    )
    try:
        mode = send_email(user.email, subject, text, html)
    except MailError as err:
        print("Email failed:", err)
        _refund(user.email)
        raise HTTPException(status_code=502, detail="The email could not be sent right now. Try again in a minute.")
    if mode == "console":
        return {"sent": False, "message": "Email is not set up on this server yet, so the link was printed in the backend window instead."}
    return {"sent": True, "message": "Check your inbox. The link works for 30 minutes."}


@router.post("/forgot")
def forgot(body: EmailBody, request: Request, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Enter the email you signed up with.")
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        raise HTTPException(status_code=404, detail="No account was found with this email.")
    _throttle(email)
    return _send_link(user, request, "reset your password")


# ---- one-time codes (OTP) ------------------------------------------------
# A 6-digit code is emailed. The server hands the browser a signed "ticket" that holds only
# a hash of the code, so nothing needs to be stored, and a restart does not break it.
# Right code + ticket -> a short-lived reset token -> /auth/reset sets the new password.
OTP_MINUTES = 10
MAX_TRIES = 5
_tries = {}  # email -> [wrong guesses, time of first one]


class OtpRequest(BaseModel):
    email: str


class OtpVerify(BaseModel):
    ticket: str
    code: str


def _otp_hash(user, code):
    msg = f"{user.id}:{_fingerprint(user)}:{code}".encode()
    return hmac.new(SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()


def _send_code(user, reason):
    code = f"{secrets.randbelow(10**6):06d}"
    exp = datetime.now(timezone.utc) + timedelta(minutes=OTP_MINUTES)
    ticket = jwt.encode({"sub": str(user.id), "purpose": "otp", "h": _otp_hash(user, code), "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)
    subject = f"{code} is your Rolivo code"
    text = (
        f"Hi,\n\nYou asked to {reason}. Your one-time code is:\n\n{code}\n\n"
        f"It works for {OTP_MINUTES} minutes. If you did not ask for it, ignore this email. Your password stays the same.\n\n- Rolivo"
    )
    html = (
        f"<p>Hi,</p><p>You asked to {escape(reason)}. Your one-time code is:</p>"
        f'<p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:16px 0">{code}</p>'
        f"<p>It works for {OTP_MINUTES} minutes. If you did not ask for it, ignore this email. Your password stays the same.</p><p>- Rolivo</p>"
    )
    try:
        mode = send_email(user.email, subject, text, html)
    except MailError as err:
        print("Email failed:", err)
        _refund(user.email)
        raise HTTPException(status_code=502, detail="The email could not be sent right now. Try again in a minute.")
    if mode == "console":
        return {"ticket": ticket, "sent": False, "message": "Email is not set up on this server yet, so the code was printed in the backend window instead."}
    return {"ticket": ticket, "sent": True, "message": f"We sent a 6-digit code to {user.email}. It works for {OTP_MINUTES} minutes."}


@router.post("/otp/request")
def otp_request(body: OtpRequest, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Enter the email you signed up with.")
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        raise HTTPException(status_code=404, detail="No account was found with this email.")
    _throttle(email)
    return _send_code(user, "reset your password")


@router.post("/change-password/request")
def change_request(user: User = Depends(current_user)):
    _throttle(user.email)
    return _send_code(user, "change your password")


@router.post("/otp/verify")
def otp_verify(body: OtpVerify, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(body.ticket, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("purpose") != "otp":
            raise ValueError("wrong kind of ticket")
        user = db.get(User, int(payload["sub"]))
    except Exception:
        raise HTTPException(status_code=400, detail="This code has expired. Ask for a new one.")
    if user is None:
        raise HTTPException(status_code=400, detail="This code has expired. Ask for a new one.")

    now = time.time()
    count, first = _tries.get(user.email, [0, now])
    if now - first > 15 * 60:
        count, first = 0, now
    if count >= MAX_TRIES:
        raise HTTPException(status_code=429, detail="Too many wrong codes. Wait 15 minutes, then ask for a new code.")
    code = "".join(ch for ch in body.code if ch.isdigit())
    if not hmac.compare_digest(_otp_hash(user, code), str(payload.get("h"))):
        _tries[user.email] = [count + 1, first]
        left = MAX_TRIES - count - 1
        raise HTTPException(status_code=400, detail=f"That code is not right. {left} {'try' if left == 1 else 'tries'} left." if left > 0 else "That code is not right. Ask for a new code in 15 minutes.")
    _tries.pop(user.email, None)
    return {"ok": True, "token": _make_reset_token(user, minutes=10)}


@router.get("/reset/check")
def reset_check(token: str, db: Session = Depends(get_db)):
    user = _user_from_token(token, db)
    return {"ok": True, "email": user.email}


@router.post("/reset")
def reset(body: ResetBody, db: Session = Depends(get_db)):
    user = _user_from_token(body.token, db)
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Use a password with at least 8 characters.")
    if len(body.password) > 128:
        raise HTTPException(status_code=400, detail="That password is too long.")
    user.password_hash = ph.hash(body.password)
    db.commit()
    return {"ok": True, "message": "Your password was changed. Sign in with the new one."}


# ---- change email: a code goes to the NEW address, so only its owner can claim it ------------
class NewEmail(BaseModel):
    new_email: str


class EmailConfirm(BaseModel):
    ticket: str
    code: str


def _email_hash(user, new_email, code):
    msg = f"email:{user.id}:{new_email}:{code}".encode()
    return hmac.new(SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()


@router.post("/email/request")
def email_request(body: NewEmail, user: User = Depends(current_user), db: Session = Depends(get_db)):
    new = body.new_email.strip().lower()
    if "@" not in new or "." not in new.split("@")[-1] or len(new) > 200:
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    if new == user.email:
        raise HTTPException(status_code=400, detail="That is already your email.")
    if db.scalar(select(User).where(User.email == new)) is not None:
        raise HTTPException(status_code=409, detail="Another account already uses that email.")
    _throttle(user.email)
    code = f"{secrets.randbelow(10**6):06d}"
    exp = datetime.now(timezone.utc) + timedelta(minutes=OTP_MINUTES)
    ticket = jwt.encode(
        {"sub": str(user.id), "purpose": "email", "new": new, "h": _email_hash(user, new, code), "exp": exp},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
    text = (
        f"Hi,\n\nUse this code to confirm {new} as your Rolivo email:\n\n{code}\n\n"
        f"It works for {OTP_MINUTES} minutes. If you did not ask for it, ignore this email.\n\n- Rolivo"
    )
    html = (
        f"<p>Hi,</p><p>Use this code to confirm {escape(new)} as your Rolivo email:</p>"
        f'<p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:16px 0">{code}</p>'
        f"<p>It works for {OTP_MINUTES} minutes. If you did not ask for it, ignore this email.</p><p>- Rolivo</p>"
    )
    try:
        mode = send_email(new, f"{code} confirms your new Rolivo email", text, html)
    except MailError as err:
        print("Email failed:", err)
        _refund(user.email)
        raise HTTPException(status_code=502, detail="The email could not be sent right now. Try again in a minute.")
    if mode == "console":
        return {"ticket": ticket, "message": "Email is not set up on this server yet, so the code was printed in the backend window instead."}
    return {"ticket": ticket, "message": f"We sent a 6-digit code to {new}."}


@router.post("/email/confirm")
def email_confirm(body: EmailConfirm, user: User = Depends(current_user), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(body.ticket, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("purpose") != "email" or payload.get("sub") != str(user.id):
            raise ValueError("not for this account")
        new = str(payload["new"])
    except Exception:
        raise HTTPException(status_code=400, detail="This code has expired. Ask for a new one.")
    now = time.time()
    key = "email:" + user.email
    count, first = _tries.get(key, [0, now])
    if now - first > 15 * 60:
        count, first = 0, now
    if count >= MAX_TRIES:
        raise HTTPException(status_code=429, detail="Too many wrong codes. Wait 15 minutes, then ask for a new code.")
    code = "".join(ch for ch in body.code if ch.isdigit())
    if not hmac.compare_digest(_email_hash(user, new, code), str(payload.get("h"))):
        _tries[key] = [count + 1, first]
        raise HTTPException(status_code=400, detail="That code is not right.")
    if db.scalar(select(User).where(User.email == new)) is not None:
        raise HTTPException(status_code=409, detail="Another account already uses that email.")
    _tries.pop(key, None)
    user.email = new
    db.commit()
    return {"ok": True, "email": new, "message": "Your email was changed."}


# ---- sign up with a verified email, and "Continue with Google" -------------------------
# Sign up: the person gives an email and password, we email a 6-digit code, and the account is
# created only after the right code comes back. The signed ticket holds a hash of the code and the
# email, never the password, so nothing needs to be stored.
class SignupRequest(BaseModel):
    email: str
    password: str


class SignupVerify(BaseModel):
    ticket: str
    code: str
    password: str


class GoogleBody(BaseModel):
    credential: str


def _check_new_account(email, password, db):
    if len(email) > 254 or "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Use a password with at least 8 characters.")
    if len(password) > 128:
        raise HTTPException(status_code=400, detail="That password is too long.")
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists. Sign in instead, or reset your password if you forgot it.",
        )


def _signup_hash(email, code):
    return hmac.new(SECRET_KEY.encode(), f"signup:{email}:{code}".encode(), hashlib.sha256).hexdigest()


@router.post("/signup/request")
def signup_request(body: SignupRequest, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    _check_new_account(email, body.password, db)
    key = "signup:" + email
    _throttle(key)
    code = f"{secrets.randbelow(10**6):06d}"
    exp = datetime.now(timezone.utc) + timedelta(minutes=OTP_MINUTES)
    ticket = jwt.encode({"purpose": "signup", "email": email, "h": _signup_hash(email, code), "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)
    subject = f"{code} confirms your Rolivo email"
    text = (
        f"Hi,\n\nWelcome to Rolivo. Your confirmation code is:\n\n{code}\n\n"
        f"It works for {OTP_MINUTES} minutes. If you did not sign up, ignore this email and nothing will be created.\n\n- Rolivo"
    )
    html = (
        "<p>Hi,</p><p>Welcome to Rolivo. Your confirmation code is:</p>"
        f'<p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:16px 0">{code}</p>'
        f"<p>It works for {OTP_MINUTES} minutes. If you did not sign up, ignore this email and nothing will be created.</p><p>- Rolivo</p>"
    )
    try:
        mode = send_email(email, subject, text, html)
    except MailError as err:
        print("Email failed:", err)
        _refund(key)
        raise HTTPException(status_code=502, detail="The email could not be sent right now. Try again in a minute.")
    if mode == "console":
        return {"ticket": ticket, "message": "Email is not set up on this server yet, so the code was printed in the backend window instead."}
    return {"ticket": ticket, "message": f"We sent a 6-digit code to {email}. It works for {OTP_MINUTES} minutes."}


@router.post("/signup/verify")
def signup_verify(body: SignupVerify, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(body.ticket, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("purpose") != "signup":
            raise ValueError("wrong kind of ticket")
        email = str(payload["email"])
    except Exception:
        raise HTTPException(status_code=400, detail="This code has expired. Go back and ask for a new one.")
    _check_new_account(email, body.password, db)
    now = time.time()
    key = "signup:" + email
    count, first = _tries.get(key, [0, now])
    if now - first > 15 * 60:
        count, first = 0, now
    if count >= MAX_TRIES:
        raise HTTPException(status_code=429, detail="Too many wrong codes. Wait 15 minutes, then ask for a new code.")
    code = "".join(ch for ch in body.code if ch.isdigit())
    if not hmac.compare_digest(_signup_hash(email, code), str(payload.get("h"))):
        _tries[key] = [count + 1, first]
        left = MAX_TRIES - count - 1
        raise HTTPException(status_code=400, detail=f"That code is not right. {left} {'try' if left == 1 else 'tries'} left." if left > 0 else "That code is not right. Ask for a new code in 15 minutes.")
    _tries.pop(key, None)
    user = User(email=email, password_hash=ph.hash(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"token": make_token(user.id), "email": user.email}


@router.get("/google/config")
def google_config():
    # the Google client id is public (it is in every "Continue with Google" button); no secret here
    return {"client_id": os.getenv("GOOGLE_CLIENT_ID", "").strip()}


@router.post("/google")
def google_sign_in(body: GoogleBody, db: Session = Depends(get_db)):
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    if not client_id:
        raise HTTPException(status_code=503, detail="Google sign-in is not set up on this server yet.")
    credential = body.credential.strip()
    if not credential or len(credential) > 4096:
        raise HTTPException(status_code=400, detail="Google sign-in failed. Please try again.")
    url = "https://oauth2.googleapis.com/tokeninfo?" + urllib.parse.urlencode({"id_token": credential})
    try:
        with urllib.request.urlopen(url, timeout=10) as res:
            info = json.loads(res.read().decode())
    except urllib.error.HTTPError:
        raise HTTPException(status_code=401, detail="Google could not confirm this sign-in. Please try again.")
    except Exception:
        raise HTTPException(status_code=502, detail="Could not reach Google right now. Try again in a minute.")
    email = str(info.get("email") or "").strip().lower()
    good = (
        info.get("aud") == client_id
        and info.get("iss") in ("accounts.google.com", "https://accounts.google.com")
        and str(info.get("email_verified")).lower() == "true"
        and "@" in email
    )
    if not good:
        raise HTTPException(status_code=401, detail="Google could not confirm this sign-in. Please try again.")
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        # a Google-only account gets a random password nobody knows; "Forgot password" can set a real one later
        user = User(email=email, password_hash=ph.hash(secrets.token_urlsafe(32)))
        db.add(user)
        db.commit()
        db.refresh(user)
    return {"token": make_token(user.id), "email": user.email}
