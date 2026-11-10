#!/usr/bin/env python3
"""Ingest free, authoritative medical news into `news_feed_articles`.

Pulls per-topic public RSS feeds (MedlinePlus / CDC / WHO), extracts clean
fields (and best-effort full text via newspaper4k when NEWS_FULLTEXT=1), and
upserts by URL. Designed to run on a loop via a systemd timer / cron.

Also pulls WHO Disease Outbreak News (official JSON API) under the topic
"Outbreak notices" as title + link + short summary only, never the full text
(WHO content is CC BY-NC-SA 3.0 IGO; we link to the source).

Every feed reports a heartbeat to `health_intel_heartbeats` (`feed:<url>`):
a feed that has not succeeded for two intervals shows as stopped on
Health -> Intelligence (RFC-OSINT §3a).

Run:  uv run python scripts/news_ingest.py
Env:  DATABASE_URL (or POSTGRES_* parts) · NEWS_FULLTEXT=1 to scrape body text.
"""

from __future__ import annotations

import datetime
import html
import json
import os
import re
import time
import urllib.request
from urllib.parse import urlparse

import feedparser
import psycopg

# Topic -> public feed with distinct per-article links. Free + authoritative:
# CDC (MMWR + Newsroom), WHO, and ScienceDaily Health & Medicine specialties.
SD = "https://www.sciencedaily.com/rss/health_medicine"
FEEDS: dict[str, str] = {
    "Clinical medicine": f"{SD}.xml",
    "Surgery": f"{SD}.xml",
    "Nursing": f"{SD}.xml",
    "Pharmacy": f"{SD}/pharmacology.xml",
    "Radiology": f"{SD}/medical_imaging.xml",
    "Dentistry": f"{SD}/dentistry.xml",
    "Learning & education": f"{SD}.xml",
    "Laboratory": "https://tools.cdc.gov/api/v2/resources/media/132608.rss",
    "Health management": "https://tools.cdc.gov/api/v2/resources/media/316422.rss",
    "Health headlines": "https://www.who.int/rss-feeds/news-english.xml",
}

# WHO Disease Outbreak News: the RSS feed was retired; this is WHO's own API.
WHO_DON_TOPIC = "Outbreak notices"
WHO_DON_API = (
    "https://www.who.int/api/news/diseaseoutbreaknews"
    "?$top=15&$orderby=PublicationDate%20desc&$select=Title,UrlName,PublicationDate,Summary"
)
WHO_DON_ITEM = "https://www.who.int/emergencies/disease-outbreak-news/item/"

MAX_PER_FEED = 15
SUMMARY_LIMIT = 600
# The timer's interval; the screen calls a feed stopped after two of these.
FEED_INTERVAL_SECS = 1800
HTTP_TIMEOUT_SECS = 20
# who.int refuses Python's default agent with 403.
USER_AGENT = "MedBrains-news-ingest/1.0 (+https://github.com/DomnicAmalan/MedBrains)"

HEARTBEAT = """
INSERT INTO health_intel_heartbeats
    (name, kind, label, interval_secs, last_attempt_at, last_ok_at, last_error)
VALUES (%(name)s, 'feed', %(label)s, %(interval)s, now(),
        CASE WHEN %(error)s::text IS NULL THEN now() END, %(error)s)
ON CONFLICT (name) DO UPDATE SET
    label = EXCLUDED.label,
    interval_secs = EXCLUDED.interval_secs,
    last_attempt_at = EXCLUDED.last_attempt_at,
    last_ok_at = COALESCE(EXCLUDED.last_ok_at, health_intel_heartbeats.last_ok_at),
    last_error = EXCLUDED.last_error,
    updated_at = now()
"""

UPSERT = """
INSERT INTO news_feed_articles
    (topic, source, title, summary, content, url, image_url, author, published_at)
VALUES (%(topic)s, %(source)s, %(title)s, %(summary)s, %(content)s, %(url)s,
        %(image_url)s, %(author)s, %(published_at)s)
ON CONFLICT (topic, url) DO UPDATE SET
    source = EXCLUDED.source,
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    content = COALESCE(EXCLUDED.content, news_feed_articles.content),
    image_url = COALESCE(EXCLUDED.image_url, news_feed_articles.image_url),
    author = EXCLUDED.author,
    published_at = EXCLUDED.published_at,
    fetched_at = now(),
    updated_at = now()
"""


def database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    user = os.environ.get("POSTGRES_USER", "medbrains")
    password = os.environ.get("POSTGRES_PASSWORD", "medbrains_dev")
    host = os.environ.get("POSTGRES_HOST", "127.0.0.1")
    port = os.environ.get("POSTGRES_PORT", "5435")
    name = os.environ.get("POSTGRES_DB", "medbrains")
    return f"postgresql://{user}:{password}@{host}:{port}/{name}"


def strip_html(value: str | None) -> str | None:
    if not value:
        return None
    text = re.sub(r"<[^>]+>", " ", value)
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def hostname(url: str) -> str:
    try:
        return (urlparse(url).hostname or "").replace("www.", "")
    except ValueError:
        return ""


def published_at(entry) -> datetime.datetime | None:
    parsed = entry.get("published_parsed") or entry.get("updated_parsed")
    if not parsed:
        return None
    return datetime.datetime.fromtimestamp(time.mktime(parsed), tz=datetime.timezone.utc)


def full_text(url: str) -> str | None:
    """Best-effort full article text via newspaper4k (opt-in, may fail)."""
    try:
        from newspaper import Article

        article = Article(url)
        article.download()
        article.parse()
        return (article.text or "").strip() or None
    except Exception:  # noqa: BLE001 — scraping is best-effort; never block ingest
        return None


def short(value: str | None) -> str | None:
    text = strip_html(value)
    if text and len(text) > SUMMARY_LIMIT:
        return text[:SUMMARY_LIMIT].rstrip() + "…"
    return text


def heartbeat(cur, url: str, label: str, error: str | None) -> None:
    cur.execute(
        HEARTBEAT,
        {"name": f"feed:{url}", "label": label, "interval": FEED_INTERVAL_SECS, "error": error},
    )


def feed_error(parsed) -> str | None:
    """Why a parsed feed counts as failed, or None if it worked."""
    status = parsed.get("status")
    if status is not None and status >= 400:
        return f"HTTP {status}"
    if not parsed.entries:
        problem = parsed.get("bozo_exception")
        return f"no entries ({problem})" if problem else "no entries"
    return None


def ingest_who_don(cur) -> int:
    """WHO Disease Outbreak News: title, link and a short summary only."""
    try:
        request = urllib.request.Request(
            WHO_DON_API,
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECS) as resp:  # noqa: S310
            items = json.load(resp).get("value", [])[:MAX_PER_FEED]
    except (OSError, ValueError) as error:
        heartbeat(cur, WHO_DON_API, "WHO Disease Outbreak News", str(error)[:300])
        return 0
    count = 0
    for item in items:
        title, slug = (item.get("Title") or "").strip(), (item.get("UrlName") or "").strip()
        if not title or not slug:
            continue
        published = item.get("PublicationDate")
        cur.execute(
            UPSERT,
            {
                "topic": WHO_DON_TOPIC,
                "source": "who.int",
                "title": title,
                "summary": short(item.get("Summary")),
                "content": None,
                "url": WHO_DON_ITEM + slug,
                "image_url": None,
                "author": "World Health Organization",
                "published_at": datetime.datetime.fromisoformat(published.replace("Z", "+00:00"))
                if published
                else None,
            },
        )
        count += 1
    heartbeat(cur, WHO_DON_API, "WHO Disease Outbreak News", None if items else "no entries")
    return count


def ingest() -> int:
    want_fulltext = os.environ.get("NEWS_FULLTEXT") == "1"
    count = 0
    with psycopg.connect(database_url()) as conn, conn.cursor() as cur:
        count += ingest_who_don(cur)
        seen: set[str] = set()
        for topic, feed_url in FEEDS.items():
            parsed = feedparser.parse(feed_url)
            if feed_url not in seen:
                seen.add(feed_url)
                heartbeat(cur, feed_url, f"{hostname(feed_url)} ({topic})", feed_error(parsed))
            for entry in parsed.entries[:MAX_PER_FEED]:
                title = (entry.get("title") or "").strip()
                link = (entry.get("link") or "").strip()
                if not title or not link:
                    continue
                summary = short(entry.get("summary") or entry.get("description"))
                cur.execute(
                    UPSERT,
                    {
                        "topic": topic,
                        "source": hostname(link),
                        "title": title,
                        "summary": summary,
                        "content": full_text(link) if want_fulltext else None,
                        "url": link,
                        "image_url": None,
                        "author": (entry.get("author") or None),
                        "published_at": published_at(entry),
                    },
                )
                count += 1
        conn.commit()
    return count


if __name__ == "__main__":
    total = ingest()
    print(f"news_ingest: upserted {total} articles across {len(FEEDS) + 1} topics")
