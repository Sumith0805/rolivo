"""Deletes EVERY account and everything that belongs to it (resumes, profiles, jobs, analyses).

    python reset_users.py

It uses the database your .env points to. It shows which one (type only, no passwords), how many
rows it would delete, and asks you to type DELETE ALL USERS before it does anything.
"""
from sqlalchemy import delete, func, select

from db import Analysis, Job, Resume, User, get_db


def main():
    db = next(get_db())
    url = db.get_bind().url
    where = f"{url.get_backend_name()}" + (f" on host {url.host}" if url.host else " (a local file)")
    models = [("accounts", User), ("resumes and profiles", Resume), ("jobs", Job), ("analyses", Analysis)]
    print("Database:", where)
    for label, model in models:
        print(f"  {label}: {db.scalar(select(func.count()).select_from(model))}")
    if input("\nType DELETE ALL USERS to delete all of this, or press Enter to cancel: ").strip() != "DELETE ALL USERS":
        print("Cancelled. Nothing was deleted.")
        return
    for _label, model in (models[3], models[2], models[1], models[0]):
        db.execute(delete(model))
    db.commit()
    print("Done. Every account and its data was deleted.")


if __name__ == "__main__":
    main()
