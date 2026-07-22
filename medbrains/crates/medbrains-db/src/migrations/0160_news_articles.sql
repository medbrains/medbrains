-- Migration: 0160_news_articles.sql
-- RLS-Posture: catalog
-- news_feed_articles is global public content: no tenant_id, read via the pool.
-- External medical news, ingested by the newspaper4k worker from public feeds.
-- Distinct from `news_articles` (0141, tenant-scoped internal advisories): this
-- is GLOBAL public content (no tenant_id / RLS), queried via the pool directly
-- like other reference tables. Full-text searchable. Articles-only (no read state).

CREATE TABLE IF NOT EXISTS news_feed_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic TEXT NOT NULL,                 -- role topic, e.g. "Clinical medicine"
    source TEXT NOT NULL,                -- publisher host, e.g. "medlineplus.gov"
    title TEXT NOT NULL,
    summary TEXT,                        -- clean snippet
    content TEXT,                        -- full article text (best-effort, newspaper4k)
    url TEXT NOT NULL,                   -- canonical article link
    image_url TEXT,
    author TEXT,
    lang TEXT NOT NULL DEFAULT 'en',
    published_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Generated full-text search vector over title + summary + content.
    search_tsv tsvector GENERATED ALWAYS AS (
        to_tsvector(
            'english',
            coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(content, '')
        )
    ) STORED,
    -- The same article URL can belong to several topics (shared feeds), so a
    -- topic keeps its own copy — uniqueness is per (topic, url).
    CONSTRAINT news_feed_articles_topic_url_key UNIQUE (topic, url)
);

CREATE INDEX IF NOT EXISTS idx_news_feed_topic_pub
    ON news_feed_articles (topic, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_feed_pub
    ON news_feed_articles (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_feed_search
    ON news_feed_articles USING GIN (search_tsv);

DROP TRIGGER IF EXISTS trg_news_feed_articles_updated_at ON news_feed_articles;
CREATE TRIGGER trg_news_feed_articles_updated_at
    BEFORE UPDATE ON news_feed_articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
