import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from analysis import router as analysis_router
from auth import router as auth_router
from db import init_db
from export import router as export_router
from jobs import router as jobs_router
from library import router as library_router
from ratelimit import ai_limit
from resumes import router as resumes_router
from rewrite import router as rewrite_router
from roles import router as roles_router

DEV_ORIGINS = ",".join(
    f"http://{host}:{port}"
    for host in ("localhost", "127.0.0.1")
    for port in (5173, 5174, 5175)
)
origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", DEV_ORIGINS).split(",") if o.strip()]

app = FastAPI(title="Rolivo API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()
limited = [Depends(ai_limit)]
app.include_router(auth_router)
app.include_router(resumes_router, dependencies=limited)
app.include_router(jobs_router, dependencies=limited)
app.include_router(analysis_router, dependencies=limited)
app.include_router(roles_router)
app.include_router(rewrite_router, dependencies=limited)
app.include_router(library_router)
app.include_router(export_router)


@app.get("/health")
def health():
    return {"status": "ok"}