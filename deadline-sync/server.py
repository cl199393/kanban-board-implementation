"""FastAPI REST endpoints."""
import json
import threading
from datetime import datetime, timezone, timedelta
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from icalendar import Calendar, Event

import db
import scheduler as sched_module
import config as cfg_module
import sources.ical as ical_source

app = FastAPI(title="Deadline Sync", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "synced_at": db.last_synced_at()}


@app.get("/deadlines")
def get_deadlines(days: int = 30):
    return db.get_upcoming(days)


@app.post("/sync")
def trigger_sync():
    thread = threading.Thread(target=sched_module.run_initial_sync, daemon=True)
    thread.start()
    return {"status": "sync started"}


@app.post("/deadlines/{deadline_id}/dismiss")
def dismiss(deadline_id: str):
    found = db.dismiss_deadline(deadline_id)
    if not found:
        raise HTTPException(status_code=404, detail="Deadline not found")
    return {"status": "dismissed"}


@app.get("/calendar.ics")
def export_calendar():
    cal = Calendar()
    cal.add("prodid", "-//deadline-sync//EN")
    cal.add("version", "2.0")
    cal.add("calscale", "GREGORIAN")
    cal.add("x-wr-calname", "My Deadlines")

    # Deadlines from DB
    for row in db.get_all_active():
        due_dt = datetime.fromisoformat(row["due_at"])
        if due_dt.tzinfo is None:
            due_dt = due_dt.replace(tzinfo=timezone.utc)

        ev = Event()
        ev.add("uid", f"{row['id']}@deadline-sync")
        ev.add("summary", row["title"])
        ev.add("dtstart", due_dt)
        ev.add("dtend", due_dt)

        desc_parts = []
        if row.get("course"):
            desc_parts.append(row["course"])
        if row.get("notes"):
            desc_parts.append(row["notes"])
        if desc_parts:
            ev.add("description", "\n".join(desc_parts))
        if row.get("url"):
            ev.add("url", row["url"])

        cal.add_component(ev)

    # Todos from todos.json
    todos_path = "/Users/changliu/my-todo/todos.json"
    try:
        with open(todos_path) as f:
            todos = json.load(f)
        for todo in todos:
            if todo.get("done"):
                continue

            due_str = todo.get("dueDate")
            if due_str:
                try:
                    due_dt = datetime.fromisoformat(due_str).replace(
                        hour=23, minute=59, second=0, tzinfo=timezone.utc
                    )
                except ValueError:
                    due_dt = datetime.now(timezone.utc) + timedelta(days=7)
            else:
                due_dt = datetime.now(timezone.utc) + timedelta(days=7)

            ev = Event()
            ev.add("uid", f"todo-{todo.get('id', id(todo))}@deadline-sync")
            ev.add("summary", todo.get("text", "Untitled Todo"))
            ev.add("dtstart", due_dt)
            ev.add("dtend", due_dt)
            cal.add_component(ev)
    except (FileNotFoundError, json.JSONDecodeError):
        pass

    return Response(content=cal.to_ical(), media_type="text/calendar; charset=utf-8")


TODOS_PATH = "/Users/changliu/my-todo/todos.json"

@app.get("/todos")
def get_todos():
    try:
        with open(TODOS_PATH) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


@app.patch("/todos/{todo_id}")
def update_todo(todo_id: int, body: dict):
    try:
        with open(TODOS_PATH) as f:
            todos = json.load(f)
        updated = False
        for t in todos:
            if t.get("id") == todo_id:
                if "done" in body:
                    t["done"] = body["done"]
                updated = True
                break
        if not updated:
            raise HTTPException(status_code=404, detail="Todo not found")
        with open(TODOS_PATH, "w") as f:
            json.dump(todos, f, indent=2, ensure_ascii=False)
        return {"status": "updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


JOBS_DB_PATH = str(Path.home() / "Downloads" / "gmail_bot.db")

@app.get("/jobs")
def get_jobs():
    import sqlite3
    try:
        conn = sqlite3.connect(JOBS_DB_PATH)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM job_applications ORDER BY updated_at DESC"
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception:
        return []


@app.patch("/jobs/{job_id}")
def update_job(job_id: int, body: dict):
    import sqlite3
    status = body.get("status")
    if not status:
        raise HTTPException(status_code=400, detail="status required")
    try:
        from datetime import datetime, timezone
        conn = sqlite3.connect(JOBS_DB_PATH)
        conn.execute(
            "UPDATE job_applications SET status = ?, updated_at = ? WHERE id = ?",
            (status, datetime.now(timezone.utc).isoformat(), job_id),
        )
        conn.commit()
        conn.close()
        return {"status": "updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


RESUME_PATH = "/Users/changliu/my-todo/resume.txt"
GEMINI_API_KEY = None  # loaded lazily from env

def _get_gemini_key():
    import os
    from dotenv import load_dotenv
    load_dotenv("/Users/changliu/acamail/.env")
    return os.getenv("GEMINI_API_KEY", "")

@app.post("/tailor-resume")
def tailor_resume(body: dict):
    jd = body.get("job_description", "").strip()
    if not jd:
        raise HTTPException(status_code=400, detail="job_description required")
    try:
        with open(RESUME_PATH) as f:
            resume = f.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Resume file not found")

    prompt = f"""You are an expert resume coach helping tailor a resume for a specific job.

RESUME:
{resume}

JOB DESCRIPTION:
{jd}

Analyze the job description and provide:
1. **Match Score** (0-100): How well the current resume matches this role
2. **Missing Keywords**: Important keywords/skills from the JD not in the resume
3. **Bullet Point Rewrites**: Pick 3-5 existing resume bullets and rewrite them to better match the JD (show original → improved)
4. **Summary Statement**: Write a 2-3 sentence tailored professional summary for this specific role
5. **Key Strengths to Highlight**: Top 3 things from the resume that are most relevant to this role

Be specific, actionable, and concise. Format clearly with headers."""

    try:
        from google import genai
        key = _get_gemini_key()
        client = genai.Client(api_key=key)
        response = client.models.generate_content(
            model="gemini-2.0-flash", contents=prompt
        )
        return {"result": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/ical-feeds")
def list_ical_feeds():
    return cfg_module.load().get("ical_feeds", [])


@app.post("/ical-feeds")
def add_ical_feed(feed: dict):
    cfg = cfg_module.load()
    feeds = cfg.setdefault("ical_feeds", [])

    if any(f["id"] == feed["id"] for f in feeds):
        raise HTTPException(status_code=409, detail="Feed ID already exists")

    feeds.append(feed)
    cfg_module.save(cfg)

    lookahead = cfg.get("sync", {}).get("lookahead_days", 30)
    threading.Thread(
        target=ical_source.sync_feed, args=(feed, lookahead), daemon=True
    ).start()

    return {"status": "added"}
