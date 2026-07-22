-- Migration: 0161_blog_posts.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Hospital blog — tenant-authored posts shown in Health Pulse alongside the
-- ingested news feed. Tenant-scoped with RLS (transaction-scoped app.tenant_id).

CREATE TABLE IF NOT EXISTS public.blog_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    excerpt TEXT,
    body_html TEXT NOT NULL DEFAULT '',
    cover_image_url TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    author_id UUID,
    author_name TEXT,
    published_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT blog_posts_status_check CHECK (status IN ('draft', 'published', 'archived')),
    CONSTRAINT blog_posts_tenant_slug_key UNIQUE (tenant_id, slug)
);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_blog_posts ON public.blog_posts;
CREATE POLICY tenant_isolation_blog_posts ON public.blog_posts
    USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)))
    WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE INDEX IF NOT EXISTS idx_blog_posts_status_pub
    ON public.blog_posts (tenant_id, status, published_at DESC);

DROP TRIGGER IF EXISTS trg_blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER trg_blog_posts_updated_at
    BEFORE UPDATE ON public.blog_posts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
