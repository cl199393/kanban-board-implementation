"""Poll Canvas LMS assignments for all configured instances."""
import logging
from datetime import datetime, timezone, timedelta
from typing import Generator

import httpx

from normalizer import from_canvas
import db
import config as cfg_module

logger = logging.getLogger(__name__)


def _paginate(client: httpx.Client, url: str) -> Generator[dict, None, None]:
    """Follow Canvas pagination Link headers."""
    while url:
        resp = client.get(url)
        resp.raise_for_status()
        yield from resp.json()
        # Canvas sends: Link: <url>; rel="next", <url>; rel="last"
        link_header = resp.headers.get("Link", "")
        url = _next_url(link_header)


def _next_url(link_header: str) -> str | None:
    for part in link_header.split(","):
        part = part.strip()
        if 'rel="next"' in part:
            return part.split(";")[0].strip().strip("<>")
    return None


def sync_instance(instance: dict, lookahead_days: int) -> int:
    base = instance["base_url"].rstrip("/")
    token = instance["api_token"]
    instance_id = instance["id"]
    headers = {"Authorization": f"Bearer {token}"}
    count = 0

    end_date = (datetime.now(timezone.utc) + timedelta(days=lookahead_days)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )

    with httpx.Client(headers=headers, timeout=30) as client:
        # Get all active courses first
        courses_url = f"{base}/api/v1/courses?enrollment_state=active&per_page=50"
        try:
            courses = list(_paginate(client, courses_url))
        except httpx.HTTPError as e:
            logger.error("Canvas %s: failed to fetch courses: %s", instance_id, e)
            db.log_sync(instance_id, 0, str(e))
            return 0

        exclude_patterns = cfg_module.load().get("exclude_course_patterns", [])

        for course in courses:
            cid = course.get("id")
            if not cid:
                continue
            course_name = (course.get("name") or course.get("course_code") or "").upper()
            if any(course_name.startswith(p.upper()) for p in exclude_patterns):
                logger.info("Canvas %s: skipping excluded course %s", instance_id, course_name)
                continue
            assignments_url = (
                f"{base}/api/v1/courses/{cid}/assignments"
                f"?per_page=50&bucket=upcoming&order_by=due_at"
            )
            try:
                for raw in _paginate(client, assignments_url):
                    # Attach course name for display
                    raw["context_name"] = course.get("name") or course.get("course_code")
                    deadline = from_canvas(raw, instance_id)
                    if deadline:
                        db.upsert_deadline(deadline)
                        count += 1
            except httpx.HTTPError as e:
                logger.warning(
                    "Canvas %s: course %s assignments error: %s", instance_id, cid, e
                )

    db.log_sync(instance_id, count)
    logger.info("Canvas %s: synced %d deadlines", instance_id, count)
    return count


def sync_all() -> int:
    cfg = cfg_module.load()
    lookahead = cfg.get("sync", {}).get("lookahead_days", 30)
    total = 0
    for instance in cfg.get("canvas_instances", []):
        if instance.get("api_token", "").startswith("YOUR_"):
            logger.info("Canvas %s: skipping (token not configured)", instance["id"])
            continue
        total += sync_instance(instance, lookahead)
    return total
