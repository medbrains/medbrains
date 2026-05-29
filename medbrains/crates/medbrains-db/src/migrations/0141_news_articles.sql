-- RLS-Posture: tenant-scoped
-- Hospital news / advisories module.
--
-- Categories:
--   outbreak_alert       — disease surge (dengue, flu) — drives simulator
--                          ICD bias when active
--   weather_advisory     — heat wave, severe rain, cyclone
--   festival_advisory    — operational note tied to a festival
--   internal_notice      — staff / admin broadcast
--
-- `icd_boost` is a text[] of ICD-10 codes the simulator should over-
-- represent in its diagnosis pool while the article is active. Empty
-- array = no influence on the engine (still shown in the UI).

CREATE TABLE IF NOT EXISTS public.news_articles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    category text NOT NULL,
    title text NOT NULL,
    body text NOT NULL DEFAULT '',
    severity text NOT NULL DEFAULT 'info',
    source text,
    icd_boost text[] NOT NULL DEFAULT '{}'::text[],
    is_active boolean NOT NULL DEFAULT true,
    published_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT news_articles_category_check CHECK (
        category IN (
            'outbreak_alert',
            'weather_advisory',
            'festival_advisory',
            'internal_notice'
        )
    ),
    CONSTRAINT news_articles_severity_check CHECK (
        severity IN ('info', 'warning', 'critical')
    )
);

CREATE INDEX IF NOT EXISTS idx_news_articles_active
    ON public.news_articles (tenant_id, category, published_at DESC)
    WHERE is_active = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_news_articles_simulator_outbreak
    ON public.news_articles (tenant_id, expires_at)
    WHERE is_active = true
      AND deleted_at IS NULL
      AND category = 'outbreak_alert';

ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS news_articles_tenant_rls ON public.news_articles;
CREATE POLICY news_articles_tenant_rls ON public.news_articles
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP TRIGGER IF EXISTS news_articles_set_updated_at ON public.news_articles;
CREATE TRIGGER news_articles_set_updated_at
    BEFORE UPDATE ON public.news_articles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
