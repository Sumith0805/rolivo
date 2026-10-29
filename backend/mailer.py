import json
import os
import smtplib
import ssl
import urllib.request
from email.message import EmailMessage

from pathlib import Path

from dotenv import load_dotenv

# Always read the .env that sits next to this file, whatever folder the server was started from,
# and let it win over empty settings that may already exist in the computer's environment.
load_dotenv(Path(__file__).resolve().parent / ".env", override=True)

# Sends one email. Two ways, picked by which settings exist in the server's environment:
#   BREVO_API_KEY + MAIL_FROM          -> Brevo over HTTPS (works on Render's free plan)
#   GMAIL_USER + GMAIL_APP_PASSWORD    -> Gmail over SMTP (works on your own computer)
# With neither, the message is printed in the backend window so you can test locally.


class MailError(Exception):
    pass


def _sender():
    return os.getenv("MAIL_FROM") or os.getenv("GMAIL_USER") or "no-reply@rolivo.local"


def mail_mode():
    if os.getenv("BREVO_API_KEY") and os.getenv("MAIL_FROM"):
        return "brevo"
    if os.getenv("GMAIL_USER") and os.getenv("GMAIL_APP_PASSWORD"):
        return "gmail"
    return "console"


def send_email(to, subject, text, html):
    """Returns "sent" or "console". Raises MailError when a real send fails."""
    mode = mail_mode()
    if mode == "brevo":
        body = json.dumps(
            {
                "sender": {"name": "Rolivo", "email": os.getenv("MAIL_FROM")},
                "to": [{"email": to}],
                "subject": subject,
                "textContent": text,
                "htmlContent": html,
            }
        ).encode()
        req = urllib.request.Request(
            "https://api.brevo.com/v3/smtp/email",
            data=body,
            headers={"api-key": os.getenv("BREVO_API_KEY"), "content-type": "application/json", "accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as res:
                if res.status >= 300:
                    raise MailError(f"Brevo answered {res.status}")
        except MailError:
            raise
        except Exception as err:
            raise MailError(f"Could not send through Brevo: {err}")
        return "sent"
    if mode == "gmail":
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = f"Rolivo <{_sender()}>"
        msg["To"] = to
        msg.set_content(text)
        msg.add_alternative(html, subtype="html")
        try:
            with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=15, context=ssl.create_default_context()) as smtp:
                smtp.login(os.getenv("GMAIL_USER"), os.getenv("GMAIL_APP_PASSWORD").replace(" ", ""))
                smtp.send_message(msg)
        except Exception as err:
            raise MailError(f"Could not send through Gmail: {err}")
        return "sent"
    print("\n----- EMAIL (not sent: no email settings found) -----")
    print("To:", to)
    print("Subject:", subject)
    print(text)
    print("-----------------------------------------------------\n")
    return "console"


print("Rolivo email mode:", mail_mode(), "(gmail or brevo means real emails; console means codes print here)")
