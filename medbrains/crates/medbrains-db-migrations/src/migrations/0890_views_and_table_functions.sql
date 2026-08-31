CREATE FUNCTION public.sso_active_providers() RETURNS TABLE(id uuid, name text, protocol text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT id, name, protocol
    FROM public.identity_providers
    WHERE is_active = true
    ORDER BY name;
$$;

CREATE FUNCTION public.sso_active_providers_by_host(p_domain text) RETURNS TABLE(id uuid, name text, protocol text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    WITH host_tenant AS (
        SELECT t.id AS tenant_id
        FROM public.tenants t
        WHERE p_domain IS NOT NULL
          AND lower(t.custom_domain) = lower(p_domain)
          AND t.is_active = true
        LIMIT 1
    )
    SELECT ip.id, ip.name, ip.protocol
    FROM public.identity_providers ip
    WHERE ip.is_active = true
      AND (
        NOT EXISTS (SELECT 1 FROM host_tenant)
        OR ip.tenant_id = (SELECT tenant_id FROM host_tenant)
      )
    ORDER BY ip.name;
$$;

CREATE FUNCTION public.sso_provider_for_login(p_id uuid) RETURNS public.identity_providers
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT * FROM public.identity_providers WHERE id = p_id AND is_active = true;
$$;

CREATE VIEW public.cms_post_analytics AS
SELECT
    NULL::uuid AS id,
    NULL::uuid AS tenant_id,
    NULL::text AS title,
    NULL::text AS slug,
    NULL::public.cms_post_status AS status,
    NULL::timestamp with time zone AS published_at,
    NULL::text AS author_name,
    NULL::text AS category_name,
    NULL::bigint AS total_views,
    NULL::bigint AS days_with_views,
    NULL::timestamp with time zone AS last_viewed_at;

CREATE VIEW public.token_scopes AS
 SELECT d.tenant_id,
    'department'::text AS scope,
    d.id AS scope_id,
    d.name AS label,
    (d.department_type)::text AS kind,
    NULL::integer AS capacity_per_hour,
    NULL::text AS location_label,
    NULL::uuid AS camp_id,
    d.is_active
   FROM public.departments d
UNION ALL
 SELECT c.tenant_id,
    'counter'::text AS scope,
    c.id AS scope_id,
    c.counter_name AS label,
    c.counter_type AS kind,
    c.capacity_per_hour,
    c.location_label,
    c.camp_id,
    (c.status = ANY (ARRAY['ready'::text, 'active'::text])) AS is_active
   FROM public.camp_counters c
  WHERE (c.deleted_at IS NULL)
UNION ALL
 SELECT s.tenant_id,
    'station'::text AS scope,
    s.id AS scope_id,
    s.name AS label,
    s.station_type AS kind,
    NULL::integer AS capacity_per_hour,
    (s.location_scope ->> 'label'::text) AS location_label,
    NULL::uuid AS camp_id,
    s.is_active
   FROM public.stations s
  WHERE (s.deleted_at IS NULL);

-- Name: cms_post_analytics _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.cms_post_analytics AS
 SELECT p.id,
    p.tenant_id,
    p.title,
    p.slug,
    p.status,
    p.published_at,
    a.name AS author_name,
    c.name AS category_name,
    count(v.id) AS total_views,
    count(DISTINCT date(v.viewed_at)) AS days_with_views,
    max(v.viewed_at) AS last_viewed_at
   FROM (((public.cms_posts p
     LEFT JOIN public.cms_authors a ON ((p.author_id = a.id)))
     LEFT JOIN public.cms_categories c ON ((p.category_id = c.id)))
     LEFT JOIN public.cms_post_views v ON ((p.id = v.post_id)))
  GROUP BY p.id, a.name, c.name;
