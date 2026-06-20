#!/usr/bin/env python3
"""Ingest free, authoritative medical news into `news_feed_articles`.

Pulls per-topic public RSS feeds (MedlinePlus / CDC / WHO), extracts clean
fields (and best-effort full text via newspaper4k when NEWS_FULLTEXT=1), and
upserts by URL. Designed to run on a loop via a systemd timer / cron.

Run:  uv run python scripts/news_ingest.py
Env:  DATABASE_URL (or POSTGRES_* parts) · NEWS_FULLTEXT=1 to scrape body text.
"""

from __future__ import annotations

import datetime
import html
import os
import re
import time
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

MAX_PER_FEED = 15
SUMMARY_LIMIT = 600

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


def ingest() -> int:
    want_fulltext = os.environ.get("NEWS_FULLTEXT") == "1"
    count = 0
    with psycopg.connect(database_url()) as conn, conn.cursor() as cur:
        for topic, feed_url in FEEDS.items():
            parsed = feedparser.parse(feed_url)
            for entry in parsed.entries[:MAX_PER_FEED]:
                title = (entry.get("title") or "").strip()
                link = (entry.get("link") or "").strip()
                if not title or not link:
                    continue
                summary = strip_html(entry.get("summary") or entry.get("description"))
                if summary and len(summary) > SUMMARY_LIMIT:
                    summary = summary[:SUMMARY_LIMIT].rstrip() + "…"
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
    print(f"news_ingest: upserted {total} articles across {len(FEEDS)} topics")
