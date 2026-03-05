#!/usr/bin/env python3
"""macOS menu bar app for deadlines — uses rumps (no Xcode required)."""
import sys
import os
import sqlite3
import subprocess
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))

import rumps
import urllib.request
import urllib.parse

DB_PATH = os.path.join(os.path.dirname(__file__), "deadlines.db")
API_URL = "http://localhost:8765"

TODOS_PATH = os.path.join(os.path.dirname(__file__), "..", "todos.json")

SOURCE_LABELS = {
    "canvas_gt":  "GT Canvas",
    "canvas_ucf": "UCF Canvas",
    "microsoft":  "Microsoft",
    "gmail":      "Gmail",
    "todo":       "Todo",
}

SOURCE_ICONS = {
    "canvas_gt":  "🟡",
    "canvas_ucf": "🟡",
    "microsoft":  "🔵",
    "gmail":      "🔴",
    "todo":       "📝",
}

# IDs already notified as emergency this session (avoid repeat alerts)
_emergency_notified = set()


def fetch_deadlines_today() -> list[dict]:
    """Return overdue + due today (local midnight to midnight), including todos."""
    results = []

    # Deadlines from DB
    if os.path.exists(DB_PATH):
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                """
                SELECT * FROM deadlines
                WHERE dismissed = 0
                  AND datetime(due_at) < datetime('now', 'localtime', 'start of day', '+1 day')
                ORDER BY due_at ASC
                """,
            ).fetchall()
            conn.close()
            results.extend([dict(r) for r in rows])
        except Exception:
            pass

    # Todos from todos.json — include undone todos due today or overdue
    todos_path = os.path.normpath(TODOS_PATH)
    if os.path.exists(todos_path):
        try:
            import json as _json
            with open(todos_path) as f:
                todos = _json.load(f)
            today_str = datetime.now().strftime("%Y-%m-%d")
            for t in todos:
                if t.get("done"):
                    continue
                due_date = t.get("dueDate")
                if not due_date or due_date > today_str:
                    continue  # future or no date
                due_time = t.get("dueTime") or "23:59"
                due_at = f"{due_date}T{due_time}:00"
                results.append({
                    "id": f"todo:{t['id']}",
                    "source": "todo",
                    "title": t.get("text", ""),
                    "course": t.get("location") or None,
                    "due_at": due_at,
                    "dismissed": 0,
                    "_todo_id": t["id"],
                })
        except Exception:
            pass

    results.sort(key=lambda d: d["due_at"])
    return results


def seconds_until(due_at: str) -> float:
    try:
        due = datetime.fromisoformat(due_at.replace("Z", "+00:00"))
        return (due - datetime.now(timezone.utc)).total_seconds()
    except Exception:
        return float("inf")


def is_emergency(due_at: str) -> bool:
    """Overdue or due within 3 hours."""
    return seconds_until(due_at) < 3 * 3600


def relative_time(due_at: str) -> str:
    try:
        diff = seconds_until(due_at)
        if diff < 0:
            return "Overdue"
        d = int(diff // 86400)
        h = int(diff // 3600)
        m = int(diff // 60)
        if d >= 2:
            return f"{d}d"
        if d == 1:
            return "1d"
        if h >= 1:
            return f"{h}h"
        return f"{m}m"
    except Exception:
        return "?"


def format_date(due_at: str) -> str:
    try:
        due = datetime.fromisoformat(due_at.replace("Z", "+00:00")).astimezone()
        return due.strftime("%b %d %I:%M %p")
    except Exception:
        return due_at[:10]


def notify(title: str, message: str, subtitle: str = ""):
    script = (f'display notification "{message}" '
              f'with title "{title}"'
              + (f' subtitle "{subtitle}"' if subtitle else ""))
    subprocess.run(["osascript", "-e", script], capture_output=True)


def dismiss_deadline(deadline_id: str):
    """Call the API to dismiss a deadline."""
    try:
        encoded = urllib.parse.quote(deadline_id, safe="")
        req = urllib.request.Request(
            f"{API_URL}/deadlines/{encoded}/dismiss",
            method="POST",
        )
        urllib.request.urlopen(req, timeout=5)
    except Exception:
        pass


def dismiss_todo(todo_id):
    """Mark a todo as done via the API."""
    try:
        import json as _json
        data = _json.dumps({"done": True}).encode()
        req = urllib.request.Request(
            f"{API_URL}/todos/{todo_id}",
            data=data,
            method="PATCH",
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=5)
    except Exception:
        pass


class DeadlineMenuBar(rumps.App):
    def __init__(self):
        super().__init__("📅", quit_button=None)
        self.deadlines = []
        self._last_morning = None
        self.refresh_menu()
        self._timer = rumps.Timer(self.on_timer, 60)
        self._timer.start()

    def on_timer(self, _):
        self.refresh_menu()
        self._maybe_morning_summary()

    def _maybe_morning_summary(self):
        now = datetime.now()
        if now.hour == 9 and now.minute < 2:
            today = now.date()
            if today != self._last_morning:
                self._last_morning = today
                items = self.deadlines[:8]
                if items:
                    lines = []
                    for d in items:
                        timer = relative_time(d["due_at"])
                        title = d["title"][:45]
                        lines.append(f"• {title} [{timer}]")
                    body = "\n".join(lines)
                else:
                    body = "Nothing due today — enjoy! 🎉"
                notify("☀️ Good morning! Today's deadlines:", body)

    def refresh_menu(self):
        self.deadlines = fetch_deadlines_today()

        emergency = [d for d in self.deadlines if is_emergency(d["due_at"])]
        urgent    = [d for d in self.deadlines
                     if not is_emergency(d["due_at"]) and seconds_until(d["due_at"]) < 86400]
        normal    = [d for d in self.deadlines
                     if not is_emergency(d["due_at"]) and seconds_until(d["due_at"]) >= 86400]

        # ── Menu bar title: character emoji + time ──────────────────────
        if emergency:
            first = emergency[0]
            timer = relative_time(first["due_at"])
            extra = f" +{len(emergency)-1}" if len(emergency) > 1 else ""
            self.title = f"🦊 {timer}{extra}"
        elif urgent:
            first = urgent[0]
            timer = relative_time(first["due_at"])
            extra = f" +{len(urgent)-1}" if len(urgent) > 1 else ""
            self.title = f"🐰 {timer}{extra}"
        elif [d for d in self.deadlines if seconds_until(d["due_at"]) < 72 * 3600]:
            soon_list = [d for d in self.deadlines if seconds_until(d["due_at"]) < 72 * 3600]
            timer = relative_time(soon_list[0]["due_at"])
            self.title = f"🐃 {timer}"
        else:
            self.title = "🦥"

        # ── Fire immediate notifications for new emergencies ─────────────
        for d in emergency:
            if d["id"] not in _emergency_notified:
                _emergency_notified.add(d["id"])
                diff = seconds_until(d["due_at"])
                msg = "Overdue!" if diff < 0 else f"Due in {relative_time(d['due_at'])}!"
                source = SOURCE_LABELS.get(d["source"], d["source"])
                notify(f"🚨 {d['title'][:50]}", msg, source)

        # ── Rebuild menu ─────────────────────────────────────────────────
        menu_items = []

        # Emergency section (pinned at top)
        if emergency:
            menu_items.append(rumps.MenuItem("🦊  EMERGENCY — Nick's on it!"))
            for d in emergency:
                timer = relative_time(d["due_at"])
                ddl = format_date(d["due_at"])
                title = d["title"][:50] + "…" if len(d["title"]) > 50 else d["title"]
                source = SOURCE_LABELS.get(d["source"], d["source"])
                menu_items.append(rumps.MenuItem(f"   🚨 {title}"))
                menu_items.append(rumps.MenuItem(f"      📅 {ddl}  [{timer}]  {source}"))
                did = d["id"]
                todo_id = d.get("_todo_id")
                def make_dismiss(deadline_id, tid, app=self):
                    def on_dismiss(_):
                        if tid is not None:
                            dismiss_todo(tid)
                        else:
                            dismiss_deadline(deadline_id)
                        app.refresh_menu()
                    return on_dismiss
                menu_items.append(rumps.MenuItem(f"      ✓ Dismiss", callback=make_dismiss(did, todo_id)))
            menu_items.append(None)

        if not self.deadlines:
            menu_items.append(rumps.MenuItem("No upcoming deadlines"))
        else:
            # Urgent section
            if urgent:
                menu_items.append(rumps.MenuItem("🐰  Judy says hurry! (< 24h)"))
                for d in urgent:
                    icon = SOURCE_ICONS.get(d["source"], "⚪")
                    timer = relative_time(d["due_at"])
                    ddl = format_date(d["due_at"])
                    title = d["title"][:50] + "…" if len(d["title"]) > 50 else d["title"]
                    menu_items.append(rumps.MenuItem(f"   {icon} {title}"))
                    menu_items.append(rumps.MenuItem(f"      📅 {ddl}  [{timer}]"))
                    did = d["id"]
                    tid = d.get("_todo_id")
                    def make_dismiss_u(deadline_id, todo_id, app=self):
                        def on_dismiss(_):
                            if todo_id is not None:
                                dismiss_todo(todo_id)
                            else:
                                dismiss_deadline(deadline_id)
                            app.refresh_menu()
                        return on_dismiss
                    menu_items.append(rumps.MenuItem(f"      ✓ Dismiss", callback=make_dismiss_u(did, tid)))
                menu_items.append(None)

            # Normal deadlines grouped by date
            current_date = None
            for d in normal[:15]:
                try:
                    due_dt = datetime.fromisoformat(d["due_at"].replace("Z", "+00:00")).astimezone()
                    date_label = due_dt.strftime("%a, %b %d")
                    time_label = due_dt.strftime("%I:%M %p")
                except Exception:
                    date_label = d["due_at"][:10]
                    time_label = ""

                if date_label != current_date:
                    if current_date is not None:
                        menu_items.append(None)
                    menu_items.append(rumps.MenuItem(f"── {date_label} ──"))
                    current_date = date_label

                icon = SOURCE_ICONS.get(d["source"], "⚪")
                timer = relative_time(d["due_at"])
                title = d["title"][:50] + "…" if len(d["title"]) > 50 else d["title"]
                source = SOURCE_LABELS.get(d["source"], d["source"])
                menu_items.append(rumps.MenuItem(f"   {icon} {title}"))
                menu_items.append(rumps.MenuItem(f"      📅 {time_label}  [{timer}]  {source}"))

        menu_items.append(None)
        menu_items.append(rumps.MenuItem("Refresh", callback=self.on_refresh))
        menu_items.append(rumps.MenuItem(f"{len(self.deadlines)} due today"))
        menu_items.append(None)
        menu_items.append(rumps.MenuItem("Quit", callback=rumps.quit_application))

        self.menu.clear()
        self.menu = menu_items

    @rumps.clicked("Refresh")
    def on_refresh(self, _):
        self.refresh_menu()


if __name__ == "__main__":
    app = DeadlineMenuBar()
    app.run()
