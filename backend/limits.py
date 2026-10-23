import re

HAS_NUMBER = re.compile(r"\d")


def limit_bullets(bullets, n):
    out = list(bullets)
    while len(out) > n and n > 0:
        drop = None
        for i in range(len(out) - 1, -1, -1):
            if not HAS_NUMBER.search(out[i]):
                drop = i
                break
        if drop is None:
            drop = len(out) - 1
        out.pop(drop)
    return out