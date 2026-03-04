#!/usr/bin/env python3
"""macOS menu bar app for deadlines — uses rumps (no Xcode required)."""
import sys
import os
import sqlite3
import subprocess
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))

import rumps

DB_PATH = os.path.join(os.path.dirname(__file__), "deadlines.db")

SOURCE_LABELS = {
    "canvas_gt":  "GT Canvas",
    "canvas_ucf": "UCF Canvas",
    "microsoft":  "Microsoft",
    "gmail":      "Gmail",
}

SOURCE_ICONS = {
    "canvas_gt":  "🟡",
    "canvas_ucf": "🟡",
    "microsoft":  "🔵",
    "gmail":      "🔴",
}

# IDs already notified as emergency this session (avoid repeat alerts)
_emergency_notified = set()


def fetch_deadlines(days: int = 30) -> list[dict]:
    if not os.path.exists(DB_PATH):
        return []
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT * FROM deadlines
            WHERE dismissed = 0
              AND due_at <= datetime('now', ? || ' days')
            ORDER BY due_at ASC
            """,
            (str(days),),
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception:
        return []


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


class DeadlineMenuBar(rumps.App):
    def __init__(self):
        super().__init__("📅", quit_button=None)
        self.deadlines = []
        self.refresh_menu()
        self._timer = rumps.Timer(self.on_timer, 120)
        self._timer.start()

    def on_timer(self, _):
        self.refresh_menu()

    def refresh_menu(self):
        self.deadlines = fetch_deadlines(30)

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
        menu_items.append(rumps.MenuItem(f"{len(self.deadlines)} deadlines total"))
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
