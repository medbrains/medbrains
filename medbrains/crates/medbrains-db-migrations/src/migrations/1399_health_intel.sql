-- ====================================================================
-- Migration: 1399_health_intel.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: health_intel_terms, health_intel_heartbeats, health_intel_condition_signals, health_intel_environment
-- Drops: none
-- ====================================================================
-- Health intelligence, phase 1 (RFCs/RFC-OSINT.md §4, §7 item 2).
--
-- health_intel_terms        GLOBAL. The keyword map that tags public news by
--                           condition and region. Data, not code: a new
--                           condition or a renamed state is a row.
-- health_intel_heartbeats   GLOBAL. One row per scheduled job and per public
--                           feed: when it last tried, last succeeded, and why
--                           it failed. A row older than two intervals is a
--                           stopped check, shown as an alert ("no news" is
--                           never "good news").
-- health_intel_condition_signals  per hospital: this week vs usual, by
--                           condition, replaced by each hourly recompute.
--                           Aggregate counts only, no patient identities.
-- health_intel_environment  per hospital: the last weather + air-quality
--                           attempt and the last good reading.
--
-- The two global tables hold nothing hospital-specific; they are listed in
-- check_rls.py GLOBAL_TABLES with the other reference tables.

CREATE TABLE public.health_intel_terms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind text NOT NULL CHECK (kind IN ('condition', 'region')),
    tag text NOT NULL,
    term text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (kind, term)
);

CREATE TABLE public.health_intel_heartbeats (
    name text PRIMARY KEY,
    kind text NOT NULL CHECK (kind IN ('job', 'feed')),
    label text NOT NULL,
    interval_secs integer NOT NULL CHECK (interval_secs BETWEEN 60 AND 86400),
    last_attempt_at timestamptz,
    last_ok_at timestamptz,
    last_error text,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.news_feed_articles
    ADD COLUMN IF NOT EXISTS conditions text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS regions text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS tagged_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_news_feed_conditions
    ON public.news_feed_articles USING gin (conditions);
CREATE INDEX IF NOT EXISTS idx_news_feed_untagged
    ON public.news_feed_articles (updated_at) WHERE tagged_at IS NULL;

CREATE TABLE public.health_intel_condition_signals (
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    condition text NOT NULL,
    this_week integer NOT NULL CHECK (this_week >= 0),
    usual numeric(10,2),
    spread numeric(10,2),
    method text NOT NULL CHECK (method IN ('same_weeks_previous_years', 'rolling_8_weeks', 'not_enough_history')),
    level text NOT NULL CHECK (level IN ('usual', 'higher', 'much_higher')),
    series integer[] NOT NULL,
    computed_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, condition)
);

CREATE TABLE public.health_intel_environment (
    tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),
    attempted_at timestamptz NOT NULL,
    ok_at timestamptz,
    error text,
    latitude numeric(10,7),
    longitude numeric(10,7),
    temperature_c numeric(5,1),
    weather_code integer,
    forecast_max_c numeric(5,1),
    forecast_max_on date,
    pm2_5 numeric(7,1),
    pm10 numeric(7,1)
);

ALTER TABLE public.health_intel_condition_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_intel_condition_signals FORCE ROW LEVEL SECURITY;
ALTER TABLE public.health_intel_environment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_intel_environment FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_health_intel_condition_signals
    ON public.health_intel_condition_signals
    USING ((tenant_id)::text = current_setting('app.tenant_id', true))
    WITH CHECK ((tenant_id)::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation_health_intel_environment
    ON public.health_intel_environment
    USING ((tenant_id)::text = current_setting('app.tenant_id', true))
    WITH CHECK ((tenant_id)::text = current_setting('app.tenant_id', true));

-- ── The keyword map ────────────────────────────────────────────────────
-- Matched with phraseto_tsquery('english', term) against the article's
-- title, summary and text, so "dengue" also matches "Dengue's".
INSERT INTO public.health_intel_terms (kind, tag, term) VALUES
    ('condition', 'Dengue', 'dengue'),
    ('condition', 'Malaria', 'malaria'),
    ('condition', 'Cholera', 'cholera'),
    ('condition', 'Acute diarrhoeal disease', 'acute diarrhoeal disease'),
    ('condition', 'Measles', 'measles'),
    ('condition', 'Typhoid', 'typhoid'),
    ('condition', 'Typhoid', 'enteric fever'),
    ('condition', 'Leptospirosis', 'leptospirosis'),
    ('condition', 'Scrub typhus', 'scrub typhus'),
    ('condition', 'Influenza / ILI', 'influenza'),
    ('condition', 'Influenza / ILI', 'influenza-like illness'),
    ('condition', 'Influenza / ILI', 'avian flu'),
    ('condition', 'Influenza / ILI', 'H5N1'),
    ('condition', 'COVID-19', 'covid-19'),
    ('condition', 'COVID-19', 'sars-cov-2'),
    ('condition', 'Heat illness', 'heatstroke'),
    ('condition', 'Heat illness', 'heat stroke'),
    ('condition', 'Heat illness', 'heatwave'),
    ('condition', 'Heat illness', 'heat wave'),
    ('condition', 'Chikungunya', 'chikungunya'),
    ('condition', 'Hepatitis E', 'hepatitis e'),
    ('condition', 'Japanese encephalitis / AES', 'japanese encephalitis'),
    ('condition', 'Japanese encephalitis / AES', 'acute encephalitis syndrome'),
    ('condition', 'Nipah', 'nipah'),
    ('condition', 'Mpox', 'mpox'),
    ('condition', 'Diphtheria', 'diphtheria'),
    ('condition', 'Rabies', 'rabies'),
    ('condition', 'Ebola / Marburg', 'ebola'),
    ('condition', 'Ebola / Marburg', 'marburg'),
    ('condition', 'MERS', 'middle east respiratory syndrome'),
    ('condition', 'Yellow fever', 'yellow fever'),
    ('condition', 'Zika', 'zika'),
    ('region', 'India', 'india'),
    ('region', 'Andhra Pradesh', 'andhra pradesh'),
    ('region', 'Arunachal Pradesh', 'arunachal pradesh'),
    ('region', 'Assam', 'assam'),
    ('region', 'Bihar', 'bihar'),
    ('region', 'Chhattisgarh', 'chhattisgarh'),
    ('region', 'Goa', 'goa'),
    ('region', 'Gujarat', 'gujarat'),
    ('region', 'Haryana', 'haryana'),
    ('region', 'Himachal Pradesh', 'himachal pradesh'),
    ('region', 'Jharkhand', 'jharkhand'),
    ('region', 'Karnataka', 'karnataka'),
    ('region', 'Kerala', 'kerala'),
    ('region', 'Madhya Pradesh', 'madhya pradesh'),
    ('region', 'Maharashtra', 'maharashtra'),
    ('region', 'Manipur', 'manipur'),
    ('region', 'Meghalaya', 'meghalaya'),
    ('region', 'Mizoram', 'mizoram'),
    ('region', 'Nagaland', 'nagaland'),
    ('region', 'Odisha', 'odisha'),
    ('region', 'Punjab', 'punjab'),
    ('region', 'Rajasthan', 'rajasthan'),
    ('region', 'Sikkim', 'sikkim'),
    ('region', 'Tamil Nadu', 'tamil nadu'),
    ('region', 'Telangana', 'telangana'),
    ('region', 'Tripura', 'tripura'),
    ('region', 'Uttar Pradesh', 'uttar pradesh'),
    ('region', 'Uttarakhand', 'uttarakhand'),
    ('region', 'West Bengal', 'west bengal'),
    ('region', 'Delhi', 'delhi'),
    ('region', 'Jammu and Kashmir', 'jammu and kashmir'),
    ('region', 'Ladakh', 'ladakh'),
    ('region', 'Puducherry', 'puducherry'),
    ('region', 'Chandigarh', 'chandigarh'),
    ('region', 'Andaman and Nicobar Islands', 'andaman'),
    ('region', 'Lakshadweep', 'lakshadweep'),
    ('region', 'Dadra and Nagar Haveli and Daman and Diu', 'daman')
ON CONFLICT (kind, term) DO NOTHING;
