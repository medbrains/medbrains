-- Migration 101: CMS & Blog System
-- Hospital website content management: posts, categories, tags, media, authors, subscribers

-- ── Post Status Enum ─────────────────────────────────────────────────────────

CREATE TYPE cms_post_status AS ENUM (
    'draft',
    'pending_review',
    'pending_medical_review',
    'approved',
    'published',
    'scheduled',
    'archived'
);

-- ── Content Type Enum ────────────────────────────────────────────────────────

CREATE TYPE cms_content_type AS ENUM (
    'article',
    'quick_post',
    'opinion',
    'case_study',
    'news',
    'event',
    'announcement'
);

-- ── Categories ───────────────────────────────────────────────────────────────

CREATE TABLE cms_categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    parent_id       UUID REFERENCES cms_categories(id),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL,
    description     TEXT,
    color           TEXT DEFAULT '#228be6',
    icon            TEXT,
    requires_medical_review BOOLEAN DEFAULT FALSE,
    sort_order      INT DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_cms_categories_tenant ON cms_categories(tenant_id);
CREATE INDEX idx_cms_categories_parent ON cms_categories(parent_id);
CREATE INDEX idx_cms_categories_slug ON cms_categories(tenant_id, slug);

ALTER TABLE cms_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY cms_categories_tenant ON cms_categories
    USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ── Tags ─────────────────────────────────────────────────────────────────────

CREATE TABLE cms_tags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_cms_tags_tenant ON cms_tags(tenant_id);
CREATE INDEX idx_cms_tags_slug ON cms_tags(tenant_id, slug);

ALTER TABLE cms_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY cms_tags_tenant ON cms_tags
    USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ── Authors ──────────────────────────────────────────────────────────────────

CREATE TABLE cms_authors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    user_id         UUID REFERENCES users(id),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL,
    bio             TEXT,
    credentials     TEXT,
    designation     TEXT,
    avatar_url      TEXT,
    website         TEXT,
    twitter         TEXT,
    linkedin        TEXT,
    role            TEXT DEFAULT 'author',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_cms_authors_tenant ON cms_authors(tenant_id);
CREATE INDEX idx_cms_authors_user ON cms_authors(user_id);
CREATE INDEX idx_cms_authors_slug ON cms_authors(tenant_id, slug);

ALTER TABLE cms_authors ENABLE ROW LEVEL SECURITY;
CREATE POLICY cms_authors_tenant ON cms_authors
    USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ── Media Library ────────────────────────────────────────────────────────────

CREATE TABLE cms_media (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    filename        TEXT NOT NULL,
    original_name   TEXT NOT NULL,
    mime_type       TEXT NOT NULL,
    file_size       BIGINT NOT NULL,
    url             TEXT NOT NULL,
    thumbnail_url   TEXT,
    alt_text        TEXT,
    caption         TEXT,
    width           INT,
    height          INT,
    uploaded_by     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cms_media_tenant ON cms_media(tenant_id);
CREATE INDEX idx_cms_media_type ON cms_media(tenant_id, mime_type);

ALTER TABLE cms_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY cms_media_tenant ON cms_media
    USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ── Posts ────────────────────────────────────────────────────────────────────

CREATE TABLE cms_posts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    author_id           UUID NOT NULL REFERENCES cms_authors(id),
    category_id         UUID REFERENCES cms_categories(id),
    -- Content
    title               TEXT NOT NULL,
    slug                TEXT NOT NULL,
    excerpt             TEXT,
    content             TEXT NOT NULL,
    content_type        cms_content_type NOT NULL DEFAULT 'article',
    -- Media
    feature_image_id    UUID REFERENCES cms_media(id),
    feature_image_alt   TEXT,
    feature_image_caption TEXT,
    -- SEO
    meta_title          TEXT,
    meta_description    TEXT,
    og_image_id         UUID REFERENCES cms_media(id),
    canonical_url       TEXT,
    -- Status & Workflow
    status              cms_post_status NOT NULL DEFAULT 'draft',
    is_featured         BOOLEAN DEFAULT FALSE,
    reading_time_minutes INT,
    -- Scheduling
    published_at        TIMESTAMPTZ,
    scheduled_at        TIMESTAMPTZ,
    -- Review
    submitted_for_review_at TIMESTAMPTZ,
    reviewed_by         UUID REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    review_notes        TEXT,
    medical_reviewed_by UUID REFERENCES users(id),
    medical_reviewed_at TIMESTAMPTZ,
    medical_review_notes TEXT,
    -- Timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_cms_posts_tenant ON cms_posts(tenant_id);
CREATE INDEX idx_cms_posts_author ON cms_posts(author_id);
CREATE INDEX idx_cms_posts_category ON cms_posts(category_id);
CREATE INDEX idx_cms_posts_status ON cms_posts(tenant_id, status);
CREATE INDEX idx_cms_posts_slug ON cms_posts(tenant_id, slug);
CREATE INDEX idx_cms_posts_published ON cms_posts(tenant_id, published_at)
    WHERE status = 'published';
CREATE INDEX idx_cms_posts_featured ON cms_posts(tenant_id, is_featured)
    WHERE is_featured = TRUE;

ALTER TABLE cms_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY cms_posts_tenant ON cms_posts
    USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ── Post Tags (Many-to-Many) ─────────────────────────────────────────────────

CREATE TABLE cms_post_tags (
    post_id         UUID NOT NULL REFERENCES cms_posts(id) ON DELETE CASCADE,
    tag_id          UUID NOT NULL REFERENCES cms_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX idx_cms_post_tags_post ON cms_post_tags(post_id);
CREATE INDEX idx_cms_post_tags_tag ON cms_post_tags(tag_id);

-- ── Post Revisions ───────────────────────────────────────────────────────────

CREATE TABLE cms_post_revisions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID NOT NULL REFERENCES cms_posts(id) ON DELETE CASCADE,
    revision_number INT NOT NULL,
    title           TEXT NOT NULL,
    content         TEXT NOT NULL,
    excerpt         TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(post_id, revision_number)
);

CREATE INDEX idx_cms_post_revisions ON cms_post_revisions(post_id);

-- ── Post Views (Analytics) ───────────────────────────────────────────────────

CREATE TABLE cms_post_views (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID NOT NULL REFERENCES cms_posts(id) ON DELETE CASCADE,
    viewed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_hash         TEXT,
    user_agent      TEXT,
    referrer        TEXT
);

CREATE INDEX idx_cms_post_views_post ON cms_post_views(post_id);
CREATE INDEX idx_cms_post_views_date ON cms_post_views(post_id, viewed_at);

-- ── Subscribers ──────────────────────────────────────────────────────────────

CREATE TABLE cms_subscribers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    email           TEXT NOT NULL,
    name            TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
    confirmation_token TEXT,
    confirmed_at    TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, email)
);

CREATE INDEX idx_cms_subscribers_tenant ON cms_subscribers(tenant_id);
CREATE INDEX idx_cms_subscribers_status ON cms_subscribers(tenant_id, status);
CREATE INDEX idx_cms_subscribers_email ON cms_subscribers(tenant_id, email);

ALTER TABLE cms_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY cms_subscribers_tenant ON cms_subscribers
    USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ── Static Pages ─────────────────────────────────────────────────────────────

CREATE TABLE cms_pages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    title           TEXT NOT NULL,
    slug            TEXT NOT NULL,
    content         TEXT NOT NULL,
    template        TEXT DEFAULT 'default',
    meta_title      TEXT,
    meta_description TEXT,
    is_published    BOOLEAN DEFAULT FALSE,
    sort_order      INT DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_cms_pages_tenant ON cms_pages(tenant_id);
CREATE INDEX idx_cms_pages_slug ON cms_pages(tenant_id, slug);

ALTER TABLE cms_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY cms_pages_tenant ON cms_pages
    USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ── Site Settings ────────────────────────────────────────────────────────────

CREATE TABLE cms_settings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) UNIQUE,
    -- Site Info
    site_title      TEXT,
    site_tagline    TEXT,
    site_description TEXT,
    logo_url        TEXT,
    favicon_url     TEXT,
    -- Social
    twitter_handle  TEXT,
    facebook_url    TEXT,
    instagram_url   TEXT,
    youtube_url     TEXT,
    linkedin_url    TEXT,
    -- SEO
    default_meta_title TEXT,
    default_meta_description TEXT,
    google_analytics_id TEXT,
    -- Display
    posts_per_page  INT DEFAULT 10,
    show_author_bio BOOLEAN DEFAULT TRUE,
    enable_comments BOOLEAN DEFAULT FALSE,
    -- Contact
    contact_email   TEXT,
    contact_phone   TEXT,
    address         TEXT,
    -- Custom
    custom_css      TEXT,
    custom_js       TEXT,
    custom_head     TEXT,
    -- Config
    config          JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cms_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY cms_settings_tenant ON cms_settings
    USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ── Menus ────────────────────────────────────────────────────────────────────

CREATE TABLE cms_menus (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    name            TEXT NOT NULL,
    location        TEXT NOT NULL,
    items           JSONB DEFAULT '[]'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, location)
);

CREATE INDEX idx_cms_menus_tenant ON cms_menus(tenant_id);

ALTER TABLE cms_menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY cms_menus_tenant ON cms_menus
    USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ── Triggers ─────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_cms_categories_updated_at BEFORE UPDATE ON cms_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_cms_authors_updated_at BEFORE UPDATE ON cms_authors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_cms_posts_updated_at BEFORE UPDATE ON cms_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_cms_pages_updated_at BEFORE UPDATE ON cms_pages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_cms_settings_updated_at BEFORE UPDATE ON cms_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_cms_menus_updated_at BEFORE UPDATE ON cms_menus
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Views for Analytics ──────────────────────────────────────────────────────

CREATE OR REPLACE VIEW cms_post_analytics AS
SELECT
    p.id,
    p.tenant_id,
    p.title,
    p.slug,
    p.status,
    p.published_at,
    a.name as author_name,
    c.name as category_name,
    COUNT(v.id) as total_views,
    COUNT(DISTINCT DATE(v.viewed_at)) as days_with_views,
    MAX(v.viewed_at) as last_viewed_at
FROM cms_posts p
LEFT JOIN cms_authors a ON p.author_id = a.id
LEFT JOIN cms_categories c ON p.category_id = c.id
LEFT JOIN cms_post_views v ON p.id = v.post_id
GROUP BY p.id, a.name, c.name;
