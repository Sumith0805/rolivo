import threading
import time
from collections import defaultdict, deque

from fastapi import Depends, HTTPException

from auth import current_user
from db import User

LIMITS = [(60, 6), (3600, 60)]
_calls = defaultdict(deque)
_lock = threading.Lock()


def ai_limit(user: User = Depends(current_user)):
    now = time.time()
    horizon = max(window for window, _cap in LIMITS)
    with _lock:
        q = _calls[user.id]
        while q and now - q[0] > horizon:
            q.popleft()
        for window, cap in LIMITS:
            recent = [t for t in q if now - t <= window]
            if len(recent) >= cap:
                wait = int(window - (now - recent[0])) + 1
                raise HTTPException(
                    status_code=429,
                    detail=f"You are going a bit fast. Please wait {wait} seconds and try again.",
                    headers={"Retry-After": str(wait)},
                )
        q.append(now)