import sqlite3
import os
from datetime import datetime, timezone
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "deadlines.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS deadlines (
    id          TEXT PRIMARY KEY,
    source      TEXT NOT NULL,
    source_id   TEXT NOT NULL,
    title       TEXT NOT NULL,
    course      TEXT,
    due_at      TEXT NOT NULL,
    url         TEXT,
    notes       TEXT,
    dismissed   INTEGER DEFAULT 0,
    notified_1d INTEGER DEFAULT 0,
    notified_1h INTEGER DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    source     TEXT NOT NULL,
    synced_at  TEXT NOT NULL,
    count      INTEGER DEFAULT 0,
    error      TEXT
);
"""


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(SCHEMA)


def upsert_deadline(d: dict) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO deadlines (id, source, source_id, title, course, due_at, url, notes,
                                   dismissed, notified_1d, notified_1h, created_at, updated_at)
            VALUES (:id, :source, :source_id, :title, :course, :due_at, :url, :notes,
                    0, 0, 0, :now, :now)
            ON CONFLICT(id) DO UPDATE SET
                title      = excluded.title,
                course     = excluded.course,
                due_at     = excluded.due_at,
                url        = excluded.url,
                notes      = excluded.notes,
                updated_at = excluded.updated_at
            """,
            {**d, "now": now},
        )


def get_upcoming(days: int = 30) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT * FROM deadlines
            WHERE dismissed = 0
              AND datetime(due_at) >= datetime('now')
              AND datetime(due_at) <= datetime('now', ? || ' days')
            ORDER BY due_at ASC
            """,
            (str(days),),
        ).fetchall()
    return [dict(r) for r in rows]


def get_all_active() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM deadlines WHERE dismissed = 0 ORDER BY due_at ASC"
        ).fetchall()
    return [dict(r) for r in rows]


def get_pending_notifications() -> list[dict]:
    """Return deadlines that need 1d or 1h notifications."""
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT * FROM deadlines
            WHERE dismissed = 0
              AND datetime(due_at) >= datetime('now')
              AND (
                (notified_1d = 0 AND datetime(due_at) <= datetime('now', '25 hours') AND datetime(due_at) > datetime('now', '23 hours'))
                OR
                (notified_1h = 0 AND datetime(due_at) <= datetime('now', '65 minutes') AND datetime(due_at) > datetime('now', '55 minutes'))
              )
            """
        ).fetchall()
    return [dict(r) for r in rows]


def mark_notified(deadline_id: str, level: str) -> None:
    col = "notified_1d" if level == "1d" else "notified_1h"
    with get_conn() as conn:
        conn.execute(f"UPDATE deadlines SET {col} = 1 WHERE id = ?", (deadline_id,))


def dismiss_deadline(deadline_id: str) -> bool:
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE deadlines SET dismissed = 1 WHERE id = ?", (deadline_id,)
        )
    return cur.rowcount > 0


def log_sync(source: str, count: int, error: Optional[str] = None) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO sync_log (source, synced_at, count, error) VALUES (?, ?, ?, ?)",
            (source, now, count, error),
        )


def last_synced_at() -> Optional[str]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT synced_at FROM sync_log ORDER BY id DESC LIMIT 1"
        ).fetchone()
    return row["synced_at"] if row else None
