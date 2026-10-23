import json
import logging
import os
import re

from dotenv import load_dotenv
from fastapi import HTTPException
from groq import (
    APIConnectionError,
    AuthenticationError,
    BadRequestError,
    Groq,
    NotFoundError,
    RateLimitError,
)

load_dotenv()
log = logging.getLogger("uvicorn.error")

MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
_key = re.sub(r"[^A-Za-z0-9_-]", "", os.getenv("GROQ_API_KEY", ""))
client = Groq(api_key=_key) if _key else None


def _extract_json(text: str):
    text = (text or "").strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.M).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("the answer had no JSON object in it")
    return json.loads(text[start : end + 1])


def ask_json(system: str, user: str, max_tokens: int = 4096):
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="The AI service is not set up. Add GROQ_API_KEY to the .env file.",
        )
    use_json_mode = True
    budget = max_tokens
    for attempt in range(1, 4):
        try:
            kwargs = {"response_format": {"type": "json_object"}} if use_json_mode else {}
            reply = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=0,
                max_completion_tokens=budget,
                extra_body={"reasoning_effort": "low"},
                **kwargs,
            )
            choice = reply.choices[0]
            content = choice.message.content or ""
            log.info(
                "AI reply: finish_reason=%s, characters=%s, budget=%s",
                choice.finish_reason,
                len(content),
                budget,
            )
            if choice.finish_reason == "length":
                budget = min(budget * 2, 16000)
                continue
            return _extract_json(content)
        except RateLimitError:
            raise HTTPException(
                status_code=429,
                detail="The free AI limit was reached. Please wait a minute and try again.",
            )
        except AuthenticationError:
            log.warning("AI call failed: the Groq key was rejected")
            raise HTTPException(
                status_code=503,
                detail="The AI key was rejected. Create a new key and update the .env file.",
            )
        except NotFoundError:
            log.warning("AI call failed: model %s was not found", MODEL)
            raise HTTPException(
                status_code=503,
                detail=f"The AI model {MODEL} is not available. Set GROQ_MODEL in .env to a current model.",
            )
        except BadRequestError as e:
            log.warning("AI call failed (attempt %s): BadRequestError: %s", attempt, e)
            # JSON mode can be rejected by some models or when the output is not valid JSON.
            # Retry without it and rely on _extract_json to pull the object out.
            use_json_mode = False
            continue
        except APIConnectionError:
            log.warning("AI call failed (attempt %s): could not reach Groq", attempt)
            if attempt == 3:
                raise HTTPException(
                    status_code=503,
                    detail="Can't reach the AI service right now. Please try again in a moment.",
                )
            continue
        except ValueError as e:
            # includes json.JSONDecodeError from _extract_json
            log.warning("AI call failed (attempt %s): unreadable answer: %s", attempt, e)
            continue
    raise HTTPException(
        status_code=502,
        detail="The AI gave an answer that could not be read. Please try again.",
    )