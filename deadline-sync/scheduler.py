"""APScheduler wiring for all sync jobs."""
import logging

from apscheduler.schedulers.background import BackgroundScheduler

import config as cfg_module
import notifier
from sources import canvas, microsoft, gmail, ical, apple_calendar

logger = logging.getLogger(__name__)


def _run_canvas():
    try:
        canvas.sync_all()
    except Exception as e:
        logger.error("Canvas sync job error: %s", e)


def _run_microsoft():
    try:
        microsoft.sync_all()
    except Exception as e:
        logger.error("Microsoft sync job error: %s", e)


def _run_gmail():
    try:
        gmail.sync_all()
    except Exception as e:
        logger.error("Gmail sync job error: %s", e)


def _run_ical():
    try:
        ical.sync_all()
    except Exception as e:
        logger.error("iCal sync job error: %s", e)


def _run_apple_calendar():
    try:
        apple_calendar.sync_all()
    except Exception as e:
        logger.error("Apple Calendar sync job error: %s", e)


def _run_notifier():
    try:
        notifier.check_and_notify()
    except Exception as e:
        logger.error("Notifier job error: %s", e)


def build_scheduler() -> BackgroundScheduler:
    cfg = cfg_module.load()
    interval = cfg.get("sync", {}).get("interval_minutes", 15)

    scheduler = BackgroundScheduler()

    # Canvas + Microsoft + iCal: every interval_minutes
    scheduler.add_job(_run_canvas, "interval", minutes=interval, id="canvas")
    scheduler.add_job(_run_microsoft, "interval", minutes=interval, id="microsoft")
    scheduler.add_job(_run_ical, "interval", minutes=interval, id="ical")
    scheduler.add_job(_run_apple_calendar, "interval", minutes=interval, id="apple_calendar")

    # Gmail: every 2x interval (slower, quota-aware)
    scheduler.add_job(_run_gmail, "interval", minutes=interval * 2, id="gmail")

    # Notifier check: every 5 minutes
    scheduler.add_job(_run_notifier, "interval", minutes=5, id="notifier")

    return scheduler


def run_initial_sync() -> None:
    """Fire all syncs once at startup."""
    logger.info("Running initial sync...")
    _run_canvas()
    _run_microsoft()
    _run_ical()
    _run_gmail()
    _run_apple_calendar()
    logger.info("Initial sync complete.")
