"""Read events from Apple Calendar via AppleScript and import as deadlines."""
import logging
import subprocess
import json
from datetime import datetime, timezone, timedelta

import db
import config as cfg_module

logger = logging.getLogger(__name__)

# Calendars to always skip (system/subscription calendars)
_SKIP_ALWAYS = {
    "My Deadlines",           # our own export — avoid loop
    "Holidays in United States",
    "US Holidays",
    "United States holidays",
    "Birthdays",
    "Siri Suggestions",
    "Scheduled Reminders",
    "中国 节假日",
    "生日",
}

_APPLESCRIPT = """\
on zeroPad(n)
    if n < 10 then
        return "0" & (n as string)
    else
        return n as string
    end if
end zeroPad

on dateToISO(d)
    set y to year of d as string
    set mo to zeroPad(month of d as integer)
    set dy to zeroPad(day of d)
    set h to zeroPad(hours of d)
    set mi to zeroPad(minutes of d)
    set s to zeroPad(seconds of d)
    return y & "-" & mo & "-" & dy & "T" & h & ":" & mi & ":" & s
end dateToISO

set output to ""
set delim to "|||"
set rowDelim to "^^^"

tell application "Calendar"
    set calNames to {CAL_NAMES_PLACEHOLDER}
    repeat with calName in calNames
        try
            set cal to calendar calName
            set allEvents to every event of cal
            repeat with e in allEvents
                try
                    set eStart to start date of e
                    if eStart > (current date) then
                        set eSummary to summary of e
                        set eUid to uid of e
                        set eEnd to end date of e
                        set eUrl to ""
                        try
                            set eUrl to url of e
                        end try
                        set eNotes to ""
                        try
                            set eNotes to description of e
                        end try
                        set startStr to my dateToISO(eStart)
                        set endStr to my dateToISO(eEnd)
                        set row to calName & delim & eUid & delim & eSummary & delim & startStr & delim & endStr & delim & eUrl & delim & eNotes
                        set output to output & row & rowDelim
                    end if
                end try
            end repeat
        end try
    end repeat
end tell
return output
"""


def _parse_isodatetime(s: str) -> datetime | None:
    """Parse AppleScript ISO8601 date string to UTC datetime."""
    s = s.strip()
    if not s:
        return None
    # AppleScript returns format like "2026-03-05T10:30:00" (local time, no tz)
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y%m%dT%H%M%SZ", "%Y%m%dT%H%M%S"):
        try:
            dt = datetime.strptime(s, fmt)
            # Assume local time → convert to UTC
            import time
            local_offset = timedelta(seconds=-time.timezone)
            return (dt - local_offset).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def _get_calendar_names() -> list[str]:
    cfg = cfg_module.load()
    apple_cfg = cfg.get("apple_calendar", {})

    # If explicit include list set, use that
    include = apple_cfg.get("include_calendars")
    if include:
        return [c for c in include if c not in _SKIP_ALWAYS]

    # Otherwise get all calendar names from Calendar.app, minus skipped ones
    result = subprocess.run(
        ["osascript", "-e", 'tell application "Calendar" to get name of every calendar'],
        capture_output=True, text=True, timeout=10
    )
    if result.returncode != 0:
        logger.error("apple_calendar: failed to list calendars: %s", result.stderr)
        return []

    all_names = [n.strip() for n in result.stdout.strip().split(",")]
    exclude = set(apple_cfg.get("exclude_calendars", [])) | _SKIP_ALWAYS
    return [n for n in all_names if n not in exclude]


def sync_all() -> int:
    cal_names = _get_calendar_names()
    if not cal_names:
        logger.info("apple_calendar: no calendars to sync")
        return 0

    # Build AppleScript calendar list literal
    cal_list_as = "{" + ", ".join(f'"{n}"' for n in cal_names) + "}"
    script = _APPLESCRIPT.replace("{CAL_NAMES_PLACEHOLDER}", cal_list_as)

    try:
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True, text=True, timeout=60
        )
    except subprocess.TimeoutExpired:
        logger.error("apple_calendar: AppleScript timed out")
        return 0

    if result.returncode != 0:
        logger.error("apple_calendar: AppleScript error: %s", result.stderr.strip())
        return 0

    rows = [r for r in result.stdout.strip().split("^^^") if r.strip()]
    count = 0

    for row in rows:
        parts = row.strip().split("|||")
        if len(parts) < 5:
            continue
        cal_name, uid, summary, start_str, end_str, *rest = parts
        url = rest[0].strip() if len(rest) > 0 else ""
        notes = rest[1].strip() if len(rest) > 1 else ""

        # Use end date as due_at, fall back to start
        due_dt = _parse_isodatetime(end_str) or _parse_isodatetime(start_str)
        if not due_dt:
            continue

        deadline = {
            "id": f"apple_calendar:{uid}",
            "source": "apple_calendar",
            "source_id": uid,
            "title": summary.strip(),
            "course": cal_name.strip(),
            "due_at": due_dt.isoformat(),
            "url": url or None,
            "notes": notes[:500] or None,
        }
        db.upsert_deadline(deadline)
        count += 1

    db.log_sync("apple_calendar", count)
    logger.info("apple_calendar: synced %d events from %s", count, cal_names)
    return count
