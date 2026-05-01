-- ============================================================
-- MedBrains schema — module: auth
-- ============================================================

--
-- Name: access_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    user_id uuid NOT NULL,
    access_type text NOT NULL,
    module text,
    ip_address text,
    is_authorized boolean,
    alert_sent boolean DEFAULT false NOT NULL,
    acknowledged_at timestamp with time zone,
    acknowledged_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.access_alerts FORCE ROW LEVEL SECURITY;



--
-- Name: access_group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_group_members (
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    added_by uuid,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone
);



--
-- Name: access_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: access_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    patient_id uuid,
    action text DEFAULT 'view'::text NOT NULL,
    ip_address text,
    user_agent text,
    module text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    correlation_id uuid
);



--
-- Name: break_glass_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.break_glass_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    patient_id uuid,
    reason text NOT NULL,
    justification text,
    modules_accessed text[] DEFAULT '{}'::text[] NOT NULL,
    start_time timestamp with time zone DEFAULT now() NOT NULL,
    end_time timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    ip_address text,
    user_agent text,
    supervisor_id uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.break_glass_events FORCE ROW LEVEL SECURITY;



--
-- Name: dpdp_consents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dpdp_consents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    consent_number text,
    patient_id uuid NOT NULL,
    guardian_name text,
    retention_period text DEFAULT '5 years or as per legal requirement'::text NOT NULL,
    consent_given boolean DEFAULT false NOT NULL,
    consent_method text DEFAULT 'Physical'::text NOT NULL,
    witness_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.dpdp_consents FORCE ROW LEVEL SECURITY;



--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    device_fingerprint text,
    ip_address inet,
    user_agent text,
    family_id uuid DEFAULT gen_random_uuid(),
    replaced_by uuid,
    used_at timestamp with time zone
);



--
-- Name: relation_tuples; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
)
PARTITION BY HASH (tenant_id);



--
-- Name: relation_tuples_p0; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p0 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p1 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p10; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p10 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p11; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p11 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p12; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p12 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p13; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p13 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p14; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p14 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p15; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p15 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p16; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p16 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p17; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p17 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p18; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p18 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p19; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p19 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p2; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p2 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p20; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p20 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p21; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p21 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p22; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p22 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p23; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p23 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p24; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p24 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p25; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p25 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p26; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p26 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p27; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p27 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p28; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p28 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p29; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p29 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p3; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p3 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p30; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p30 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p31; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p31 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p4; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p4 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p5; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p5 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p6; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p6 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p7; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p7 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p8; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p8 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: relation_tuples_p9; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relation_tuples_p9 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);



--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    permissions jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    field_access_defaults jsonb DEFAULT '{}'::jsonb NOT NULL,
    widget_access_defaults jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT chk_roles_code_length CHECK (((length(code) >= 2) AND (length(code) <= 20))),
    CONSTRAINT chk_roles_name_length CHECK (((length(name) >= 2) AND (length(name) <= 100)))
);



--
-- Name: sensitive_patients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sensitive_patients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    sensitivity_type text NOT NULL,
    reason text,
    access_restricted_to uuid[],
    alert_on_access boolean DEFAULT true NOT NULL,
    notify_users uuid[],
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.sensitive_patients FORCE ROW LEVEL SECURITY;



--
-- Name: user_facility_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_facility_assignments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    facility_id uuid NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    username text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    full_name text NOT NULL,
    role public.user_role NOT NULL,
    access_matrix jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    specialization text,
    medical_registration_number text,
    qualification text,
    consultation_fee numeric(10,2),
    department_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    perm_version integer DEFAULT 1 NOT NULL,
    supervisor_id uuid,
    user_level text,
    designation_id uuid,
    CONSTRAINT chk_users_email_pattern CHECK ((email ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'::text)),
    CONSTRAINT chk_users_full_name_length CHECK (((length(full_name) >= 2) AND (length(full_name) <= 100))),
    CONSTRAINT chk_users_username_length CHECK (((length(username) >= 3) AND (length(username) <= 30))),
    CONSTRAINT chk_users_username_pattern CHECK ((username ~ '^[a-z][a-z0-9_]*$'::text)),
    CONSTRAINT users_user_level_check CHECK (((user_level IS NULL) OR (user_level = ANY (ARRAY['intern'::text, 'resident'::text, 'senior_resident'::text, 'consultant'::text, 'hod'::text]))))
);



--
-- Name: relation_tuples_p0; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p0 FOR VALUES WITH (modulus 32, remainder 0);



--
-- Name: relation_tuples_p1; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p1 FOR VALUES WITH (modulus 32, remainder 1);



--
-- Name: relation_tuples_p10; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p10 FOR VALUES WITH (modulus 32, remainder 10);



--
-- Name: relation_tuples_p11; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p11 FOR VALUES WITH (modulus 32, remainder 11);



--
-- Name: relation_tuples_p12; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p12 FOR VALUES WITH (modulus 32, remainder 12);



--
-- Name: relation_tuples_p13; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p13 FOR VALUES WITH (modulus 32, remainder 13);



--
-- Name: relation_tuples_p14; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p14 FOR VALUES WITH (modulus 32, remainder 14);



--
-- Name: relation_tuples_p15; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p15 FOR VALUES WITH (modulus 32, remainder 15);



--
-- Name: relation_tuples_p16; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p16 FOR VALUES WITH (modulus 32, remainder 16);



--
-- Name: relation_tuples_p17; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p17 FOR VALUES WITH (modulus 32, remainder 17);



--
-- Name: relation_tuples_p18; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p18 FOR VALUES WITH (modulus 32, remainder 18);



--
-- Name: relation_tuples_p19; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p19 FOR VALUES WITH (modulus 32, remainder 19);



--
-- Name: relation_tuples_p2; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p2 FOR VALUES WITH (modulus 32, remainder 2);



--
-- Name: relation_tuples_p20; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p20 FOR VALUES WITH (modulus 32, remainder 20);



--
-- Name: relation_tuples_p21; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p21 FOR VALUES WITH (modulus 32, remainder 21);



--
-- Name: relation_tuples_p22; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p22 FOR VALUES WITH (modulus 32, remainder 22);



--
-- Name: relation_tuples_p23; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p23 FOR VALUES WITH (modulus 32, remainder 23);



--
-- Name: relation_tuples_p24; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p24 FOR VALUES WITH (modulus 32, remainder 24);



--
-- Name: relation_tuples_p25; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p25 FOR VALUES WITH (modulus 32, remainder 25);



--
-- Name: relation_tuples_p26; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p26 FOR VALUES WITH (modulus 32, remainder 26);



--
-- Name: relation_tuples_p27; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p27 FOR VALUES WITH (modulus 32, remainder 27);



--
-- Name: relation_tuples_p28; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p28 FOR VALUES WITH (modulus 32, remainder 28);



--
-- Name: relation_tuples_p29; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p29 FOR VALUES WITH (modulus 32, remainder 29);



--
-- Name: relation_tuples_p3; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p3 FOR VALUES WITH (modulus 32, remainder 3);



--
-- Name: relation_tuples_p30; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p30 FOR VALUES WITH (modulus 32, remainder 30);



--
-- Name: relation_tuples_p31; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p31 FOR VALUES WITH (modulus 32, remainder 31);



--
-- Name: relation_tuples_p4; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p4 FOR VALUES WITH (modulus 32, remainder 4);



--
-- Name: relation_tuples_p5; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p5 FOR VALUES WITH (modulus 32, remainder 5);



--
-- Name: relation_tuples_p6; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p6 FOR VALUES WITH (modulus 32, remainder 6);



--
-- Name: relation_tuples_p7; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p7 FOR VALUES WITH (modulus 32, remainder 7);



--
-- Name: relation_tuples_p8; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p8 FOR VALUES WITH (modulus 32, remainder 8);



--
-- Name: relation_tuples_p9; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p9 FOR VALUES WITH (modulus 32, remainder 9);



--
-- Name: access_alerts access_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_alerts
    ADD CONSTRAINT access_alerts_pkey PRIMARY KEY (id);



--
-- Name: access_group_members access_group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_group_members
    ADD CONSTRAINT access_group_members_pkey PRIMARY KEY (group_id, user_id);



--
-- Name: access_groups access_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_groups
    ADD CONSTRAINT access_groups_pkey PRIMARY KEY (id);



--
-- Name: access_groups access_groups_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_groups
    ADD CONSTRAINT access_groups_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: access_log access_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_log
    ADD CONSTRAINT access_log_pkey PRIMARY KEY (id);



--
-- Name: break_glass_events break_glass_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.break_glass_events
    ADD CONSTRAINT break_glass_events_pkey PRIMARY KEY (id);



--
-- Name: dpdp_consents dpdp_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dpdp_consents
    ADD CONSTRAINT dpdp_consents_pkey PRIMARY KEY (id);



--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);



--
-- Name: refresh_tokens refresh_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);



--
-- Name: relation_tuples relation_tuples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples
    ADD CONSTRAINT relation_tuples_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p0 relation_tuples_p0_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p0
    ADD CONSTRAINT relation_tuples_p0_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p10 relation_tuples_p10_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p10
    ADD CONSTRAINT relation_tuples_p10_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p11 relation_tuples_p11_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p11
    ADD CONSTRAINT relation_tuples_p11_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p12 relation_tuples_p12_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p12
    ADD CONSTRAINT relation_tuples_p12_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p13 relation_tuples_p13_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p13
    ADD CONSTRAINT relation_tuples_p13_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p14 relation_tuples_p14_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p14
    ADD CONSTRAINT relation_tuples_p14_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p15 relation_tuples_p15_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p15
    ADD CONSTRAINT relation_tuples_p15_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p16 relation_tuples_p16_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p16
    ADD CONSTRAINT relation_tuples_p16_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p17 relation_tuples_p17_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p17
    ADD CONSTRAINT relation_tuples_p17_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p18 relation_tuples_p18_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p18
    ADD CONSTRAINT relation_tuples_p18_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p19 relation_tuples_p19_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p19
    ADD CONSTRAINT relation_tuples_p19_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p1 relation_tuples_p1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p1
    ADD CONSTRAINT relation_tuples_p1_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p20 relation_tuples_p20_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p20
    ADD CONSTRAINT relation_tuples_p20_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p21 relation_tuples_p21_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p21
    ADD CONSTRAINT relation_tuples_p21_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p22 relation_tuples_p22_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p22
    ADD CONSTRAINT relation_tuples_p22_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p23 relation_tuples_p23_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p23
    ADD CONSTRAINT relation_tuples_p23_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p24 relation_tuples_p24_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p24
    ADD CONSTRAINT relation_tuples_p24_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p25 relation_tuples_p25_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p25
    ADD CONSTRAINT relation_tuples_p25_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p26 relation_tuples_p26_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p26
    ADD CONSTRAINT relation_tuples_p26_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p27 relation_tuples_p27_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p27
    ADD CONSTRAINT relation_tuples_p27_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p28 relation_tuples_p28_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p28
    ADD CONSTRAINT relation_tuples_p28_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p29 relation_tuples_p29_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p29
    ADD CONSTRAINT relation_tuples_p29_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p2 relation_tuples_p2_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p2
    ADD CONSTRAINT relation_tuples_p2_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p30 relation_tuples_p30_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p30
    ADD CONSTRAINT relation_tuples_p30_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p31 relation_tuples_p31_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p31
    ADD CONSTRAINT relation_tuples_p31_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p3 relation_tuples_p3_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p3
    ADD CONSTRAINT relation_tuples_p3_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p4 relation_tuples_p4_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p4
    ADD CONSTRAINT relation_tuples_p4_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p5 relation_tuples_p5_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p5
    ADD CONSTRAINT relation_tuples_p5_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p6 relation_tuples_p6_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p6
    ADD CONSTRAINT relation_tuples_p6_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p7 relation_tuples_p7_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p7
    ADD CONSTRAINT relation_tuples_p7_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p8 relation_tuples_p8_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p8
    ADD CONSTRAINT relation_tuples_p8_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: relation_tuples_p9 relation_tuples_p9_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p9
    ADD CONSTRAINT relation_tuples_p9_pkey PRIMARY KEY (tenant_id, tuple_id);



--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);



--
-- Name: roles roles_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: sensitive_patients sensitive_patients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensitive_patients
    ADD CONSTRAINT sensitive_patients_pkey PRIMARY KEY (id);



--
-- Name: sensitive_patients sensitive_patients_tenant_id_patient_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensitive_patients
    ADD CONSTRAINT sensitive_patients_tenant_id_patient_id_key UNIQUE (tenant_id, patient_id);



--
-- Name: user_facility_assignments user_facility_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_facility_assignments
    ADD CONSTRAINT user_facility_assignments_pkey PRIMARY KEY (id);



--
-- Name: user_facility_assignments user_facility_assignments_tenant_id_user_id_facility_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_facility_assignments
    ADD CONSTRAINT user_facility_assignments_tenant_id_user_id_facility_id_key UNIQUE (tenant_id, user_id, facility_id);



--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);



--
-- Name: users users_tenant_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_email_key UNIQUE (tenant_id, email);



--
-- Name: users users_tenant_id_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_username_key UNIQUE (tenant_id, username);



--
-- Name: idx_access_alerts_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_alerts_tenant ON public.access_alerts USING btree (tenant_id, created_at DESC);



--
-- Name: idx_access_groups_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_groups_tenant ON public.access_groups USING btree (tenant_id) WHERE (is_active = true);



--
-- Name: idx_access_log_correlation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_log_correlation ON public.access_log USING btree (correlation_id) WHERE (correlation_id IS NOT NULL);



--
-- Name: idx_access_log_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_log_entity ON public.access_log USING btree (entity_type, entity_id);



--
-- Name: idx_access_log_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_log_patient ON public.access_log USING btree (tenant_id, patient_id, created_at DESC);



--
-- Name: idx_access_log_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_log_tenant ON public.access_log USING btree (tenant_id, created_at DESC);



--
-- Name: idx_access_log_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_log_user ON public.access_log USING btree (tenant_id, user_id, created_at DESC);



--
-- Name: idx_agm_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agm_user ON public.access_group_members USING btree (tenant_id, user_id) WHERE (expires_at IS NULL);



--
-- Name: idx_agm_user_expiring; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agm_user_expiring ON public.access_group_members USING btree (tenant_id, user_id, expires_at) WHERE (expires_at IS NOT NULL);



--
-- Name: idx_break_glass_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_break_glass_active ON public.break_glass_events USING btree (tenant_id, is_active);



--
-- Name: idx_dpdp_consents_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dpdp_consents_patient ON public.dpdp_consents USING btree (tenant_id, patient_id, created_at DESC);



--
-- Name: idx_refresh_tokens_family; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_family ON public.refresh_tokens USING btree (family_id);



--
-- Name: idx_refresh_tokens_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_hash ON public.refresh_tokens USING btree (token_hash);



--
-- Name: idx_refresh_tokens_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_user ON public.refresh_tokens USING btree (user_id);



--
-- Name: idx_refresh_tokens_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_user_active ON public.refresh_tokens USING btree (user_id) WHERE (revoked = false);



--
-- Name: idx_roles_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roles_tenant ON public.roles USING btree (tenant_id);



--
-- Name: idx_ufa_facility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ufa_facility ON public.user_facility_assignments USING btree (facility_id);



--
-- Name: idx_ufa_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ufa_tenant ON public.user_facility_assignments USING btree (tenant_id);



--
-- Name: idx_ufa_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ufa_user ON public.user_facility_assignments USING btree (user_id);



--
-- Name: idx_users_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_tenant ON public.users USING btree (tenant_id);



--
-- Name: rt_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rt_expiry_idx ON ONLY public.relation_tuples USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p0_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p0_expires_at_idx ON public.relation_tuples_p0 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: rt_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rt_lookup_idx ON ONLY public.relation_tuples USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p0_tenant_id_object_type_object_id_relation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p0_tenant_id_object_type_object_id_relation_idx ON public.relation_tuples_p0 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: rt_derived_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rt_derived_idx ON ONLY public.relation_tuples USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p0_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p0_tenant_id_source_derived_from_idx ON public.relation_tuples_p0 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: rt_subject_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rt_subject_idx ON ONLY public.relation_tuples USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p0_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p0_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p0 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p10_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p10_expires_at_idx ON public.relation_tuples_p10 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p10_tenant_id_object_type_object_id_relatio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p10_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p10 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p10_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p10_tenant_id_source_derived_from_idx ON public.relation_tuples_p10 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p10_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p10_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p10 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p11_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p11_expires_at_idx ON public.relation_tuples_p11 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p11_tenant_id_object_type_object_id_relatio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p11_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p11 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p11_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p11_tenant_id_source_derived_from_idx ON public.relation_tuples_p11 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p11_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p11_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p11 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p12_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p12_expires_at_idx ON public.relation_tuples_p12 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p12_tenant_id_object_type_object_id_relatio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p12_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p12 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p12_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p12_tenant_id_source_derived_from_idx ON public.relation_tuples_p12 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p12_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p12_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p12 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p13_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p13_expires_at_idx ON public.relation_tuples_p13 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p13_tenant_id_object_type_object_id_relatio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p13_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p13 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p13_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p13_tenant_id_source_derived_from_idx ON public.relation_tuples_p13 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p13_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p13_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p13 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p14_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p14_expires_at_idx ON public.relation_tuples_p14 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p14_tenant_id_object_type_object_id_relatio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p14_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p14 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p14_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p14_tenant_id_source_derived_from_idx ON public.relation_tuples_p14 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p14_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p14_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p14 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p15_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p15_expires_at_idx ON public.relation_tuples_p15 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p15_tenant_id_object_type_object_id_relatio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p15_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p15 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p15_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p15_tenant_id_source_derived_from_idx ON public.relation_tuples_p15 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p15_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p15_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p15 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p16_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p16_expires_at_idx ON public.relation_tuples_p16 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p16_tenant_id_object_type_object_id_relatio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p16_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p16 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p16_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p16_tenant_id_source_derived_from_idx ON public.relation_tuples_p16 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p16_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p16_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p16 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p17_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p17_expires_at_idx ON public.relation_tuples_p17 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p17_tenant_id_object_type_object_id_relatio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p17_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p17 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p17_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p17_tenant_id_source_derived_from_idx ON public.relation_tuples_p17 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p17_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p17_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p17 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p18_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p18_expires_at_idx ON public.relation_tuples_p18 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p18_tenant_id_object_type_object_id_relatio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p18_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p18 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p18_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p18_tenant_id_source_derived_from_idx ON public.relation_tuples_p18 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p18_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p18_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p18 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p19_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p19_expires_at_idx ON public.relation_tuples_p19 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p19_tenant_id_object_type_object_id_relatio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p19_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p19 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p19_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p19_tenant_id_source_derived_from_idx ON public.relation_tuples_p19 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p19_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p19_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p19 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p1_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p1_expires_at_idx ON public.relation_tuples_p1 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p1_tenant_id_object_type_object_id_relation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p1_tenant_id_object_type_object_id_relation_idx ON public.relation_tuples_p1 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p1_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p1_tenant_id_source_derived_from_idx ON public.relation_tuples_p1 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p1_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p1_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p1 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p20_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p20_expires_at_idx ON public.relation_tuples_p20 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p20_tenant_id_object_type_object_id_relatio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p20_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p20 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p20_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p20_tenant_id_source_derived_from_idx ON public.relation_tuples_p20 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p20_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p20_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p20 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p21_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p21_expires_at_idx ON public.relation_tuples_p21 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p21_tenant_id_object_type_object_id_relatio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p21_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p21 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p21_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p21_tenant_id_source_derived_from_idx ON public.relation_tuples_p21 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p21_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p21_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p21 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p22_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p22_expires_at_idx ON public.relation_tuples_p22 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p22_tenant_id_object_type_object_id_relatio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p22_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p22 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p22_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p22_tenant_id_source_derived_from_idx ON public.relation_tuples_p22 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p22_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p22_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p22 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p23_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p23_expires_at_idx ON public.relation_tuples_p23 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p23_tenant_id_object_type_object_id_relatio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p23_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p23 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p23_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p23_tenant_id_source_derived_from_idx ON public.relation_tuples_p23 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p23_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p23_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p23 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p24_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p24_expires_at_idx ON public.relation_tuples_p24 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p24_tenant_id_object_type_object_id_relatio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p24_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p24 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p24_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p24_tenant_id_source_derived_from_idx ON public.relation_tuples_p24 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p24_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p24_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p24 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p25_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p25_expires_at_idx ON public.relation_tuples_p25 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p25_tenant_id_object_type_object_id_relatio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p25_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p25 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p25_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p25_tenant_id_source_derived_from_idx ON public.relation_tuples_p25 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p25_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p25_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p25 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p26_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p26_expires_at_idx ON public.relation_tuples_p26 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p26_tenant_id_object_type_object_id_relatio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p26_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p26 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p26_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p26_tenant_id_source_derived_from_idx ON public.relation_tuples_p26 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p26_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p26_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p26 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p27_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p27_expires_at_idx ON public.relation_tuples_p27 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p27_tenant_id_object_type_object_id_relatio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p27_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p27 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p27_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p27_tenant_id_source_derived_from_idx ON public.relation_tuples_p27 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p27_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p27_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p27 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p28_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p28_expires_at_idx ON public.relation_tuples_p28 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p28_tenant_id_object_type_object_id_relatio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p28_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p28 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p28_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p28_tenant_id_source_derived_from_idx ON public.relation_tuples_p28 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p28_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p28_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p28 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p29_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p29_expires_at_idx ON public.relation_tuples_p29 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p29_tenant_id_object_type_object_id_relatio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p29_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p29 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p29_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p29_tenant_id_source_derived_from_idx ON public.relation_tuples_p29 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p29_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p29_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p29 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p2_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p2_expires_at_idx ON public.relation_tuples_p2 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p2_tenant_id_object_type_object_id_relation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p2_tenant_id_object_type_object_id_relation_idx ON public.relation_tuples_p2 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p2_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p2_tenant_id_source_derived_from_idx ON public.relation_tuples_p2 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p2_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p2_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p2 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p30_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p30_expires_at_idx ON public.relation_tuples_p30 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p30_tenant_id_object_type_object_id_relatio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p30_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p30 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p30_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p30_tenant_id_source_derived_from_idx ON public.relation_tuples_p30 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p30_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p30_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p30 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p31_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p31_expires_at_idx ON public.relation_tuples_p31 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p31_tenant_id_object_type_object_id_relatio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p31_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p31 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p31_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p31_tenant_id_source_derived_from_idx ON public.relation_tuples_p31 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p31_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p31_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p31 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p3_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p3_expires_at_idx ON public.relation_tuples_p3 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p3_tenant_id_object_type_object_id_relation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p3_tenant_id_object_type_object_id_relation_idx ON public.relation_tuples_p3 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p3_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p3_tenant_id_source_derived_from_idx ON public.relation_tuples_p3 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p3_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p3_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p3 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p4_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p4_expires_at_idx ON public.relation_tuples_p4 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p4_tenant_id_object_type_object_id_relation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p4_tenant_id_object_type_object_id_relation_idx ON public.relation_tuples_p4 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p4_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p4_tenant_id_source_derived_from_idx ON public.relation_tuples_p4 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p4_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p4_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p4 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p5_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p5_expires_at_idx ON public.relation_tuples_p5 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p5_tenant_id_object_type_object_id_relation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p5_tenant_id_object_type_object_id_relation_idx ON public.relation_tuples_p5 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p5_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p5_tenant_id_source_derived_from_idx ON public.relation_tuples_p5 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p5_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p5_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p5 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p6_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p6_expires_at_idx ON public.relation_tuples_p6 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p6_tenant_id_object_type_object_id_relation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p6_tenant_id_object_type_object_id_relation_idx ON public.relation_tuples_p6 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p6_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p6_tenant_id_source_derived_from_idx ON public.relation_tuples_p6 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p6_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p6_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p6 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p7_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p7_expires_at_idx ON public.relation_tuples_p7 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p7_tenant_id_object_type_object_id_relation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p7_tenant_id_object_type_object_id_relation_idx ON public.relation_tuples_p7 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p7_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p7_tenant_id_source_derived_from_idx ON public.relation_tuples_p7 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p7_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p7_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p7 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p8_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p8_expires_at_idx ON public.relation_tuples_p8 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p8_tenant_id_object_type_object_id_relation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p8_tenant_id_object_type_object_id_relation_idx ON public.relation_tuples_p8 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p8_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p8_tenant_id_source_derived_from_idx ON public.relation_tuples_p8 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p8_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p8_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p8 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p9_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p9_expires_at_idx ON public.relation_tuples_p9 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));



--
-- Name: relation_tuples_p9_tenant_id_object_type_object_id_relation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p9_tenant_id_object_type_object_id_relation_idx ON public.relation_tuples_p9 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p9_tenant_id_source_derived_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p9_tenant_id_source_derived_from_idx ON public.relation_tuples_p9 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);



--
-- Name: relation_tuples_p9_tenant_id_subject_type_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX relation_tuples_p9_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p9 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);



--
-- Name: relation_tuples_p0_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p0_expires_at_idx;



--
-- Name: relation_tuples_p0_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p0_pkey;



--
-- Name: relation_tuples_p0_tenant_id_object_type_object_id_relation_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p0_tenant_id_object_type_object_id_relation_idx;



--
-- Name: relation_tuples_p0_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p0_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p0_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p0_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p10_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p10_expires_at_idx;



--
-- Name: relation_tuples_p10_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p10_pkey;



--
-- Name: relation_tuples_p10_tenant_id_object_type_object_id_relatio_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p10_tenant_id_object_type_object_id_relatio_idx;



--
-- Name: relation_tuples_p10_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p10_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p10_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p10_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p11_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p11_expires_at_idx;



--
-- Name: relation_tuples_p11_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p11_pkey;



--
-- Name: relation_tuples_p11_tenant_id_object_type_object_id_relatio_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p11_tenant_id_object_type_object_id_relatio_idx;



--
-- Name: relation_tuples_p11_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p11_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p11_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p11_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p12_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p12_expires_at_idx;



--
-- Name: relation_tuples_p12_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p12_pkey;



--
-- Name: relation_tuples_p12_tenant_id_object_type_object_id_relatio_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p12_tenant_id_object_type_object_id_relatio_idx;



--
-- Name: relation_tuples_p12_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p12_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p12_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p12_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p13_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p13_expires_at_idx;



--
-- Name: relation_tuples_p13_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p13_pkey;



--
-- Name: relation_tuples_p13_tenant_id_object_type_object_id_relatio_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p13_tenant_id_object_type_object_id_relatio_idx;



--
-- Name: relation_tuples_p13_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p13_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p13_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p13_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p14_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p14_expires_at_idx;



--
-- Name: relation_tuples_p14_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p14_pkey;



--
-- Name: relation_tuples_p14_tenant_id_object_type_object_id_relatio_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p14_tenant_id_object_type_object_id_relatio_idx;



--
-- Name: relation_tuples_p14_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p14_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p14_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p14_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p15_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p15_expires_at_idx;



--
-- Name: relation_tuples_p15_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p15_pkey;



--
-- Name: relation_tuples_p15_tenant_id_object_type_object_id_relatio_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p15_tenant_id_object_type_object_id_relatio_idx;



--
-- Name: relation_tuples_p15_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p15_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p15_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p15_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p16_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p16_expires_at_idx;



--
-- Name: relation_tuples_p16_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p16_pkey;



--
-- Name: relation_tuples_p16_tenant_id_object_type_object_id_relatio_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p16_tenant_id_object_type_object_id_relatio_idx;



--
-- Name: relation_tuples_p16_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p16_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p16_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p16_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p17_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p17_expires_at_idx;



--
-- Name: relation_tuples_p17_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p17_pkey;



--
-- Name: relation_tuples_p17_tenant_id_object_type_object_id_relatio_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p17_tenant_id_object_type_object_id_relatio_idx;



--
-- Name: relation_tuples_p17_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p17_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p17_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p17_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p18_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p18_expires_at_idx;



--
-- Name: relation_tuples_p18_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p18_pkey;



--
-- Name: relation_tuples_p18_tenant_id_object_type_object_id_relatio_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p18_tenant_id_object_type_object_id_relatio_idx;



--
-- Name: relation_tuples_p18_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p18_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p18_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p18_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p19_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p19_expires_at_idx;



--
-- Name: relation_tuples_p19_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p19_pkey;



--
-- Name: relation_tuples_p19_tenant_id_object_type_object_id_relatio_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p19_tenant_id_object_type_object_id_relatio_idx;



--
-- Name: relation_tuples_p19_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p19_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p19_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p19_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p1_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p1_expires_at_idx;



--
-- Name: relation_tuples_p1_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p1_pkey;



--
-- Name: relation_tuples_p1_tenant_id_object_type_object_id_relation_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p1_tenant_id_object_type_object_id_relation_idx;



--
-- Name: relation_tuples_p1_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p1_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p1_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p1_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p20_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p20_expires_at_idx;



--
-- Name: relation_tuples_p20_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p20_pkey;



--
-- Name: relation_tuples_p20_tenant_id_object_type_object_id_relatio_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p20_tenant_id_object_type_object_id_relatio_idx;



--
-- Name: relation_tuples_p20_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p20_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p20_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p20_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p21_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p21_expires_at_idx;



--
-- Name: relation_tuples_p21_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p21_pkey;



--
-- Name: relation_tuples_p21_tenant_id_object_type_object_id_relatio_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p21_tenant_id_object_type_object_id_relatio_idx;



--
-- Name: relation_tuples_p21_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p21_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p21_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p21_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p22_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p22_expires_at_idx;



--
-- Name: relation_tuples_p22_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p22_pkey;



--
-- Name: relation_tuples_p22_tenant_id_object_type_object_id_relatio_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p22_tenant_id_object_type_object_id_relatio_idx;



--
-- Name: relation_tuples_p22_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p22_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p22_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p22_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p23_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p23_expires_at_idx;



--
-- Name: relation_tuples_p23_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p23_pkey;



--
-- Name: relation_tuples_p23_tenant_id_object_type_object_id_relatio_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p23_tenant_id_object_type_object_id_relatio_idx;



--
-- Name: relation_tuples_p23_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p23_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p23_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p23_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p24_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p24_expires_at_idx;



--
-- Name: relation_tuples_p24_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p24_pkey;



--
-- Name: relation_tuples_p24_tenant_id_object_type_object_id_relatio_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p24_tenant_id_object_type_object_id_relatio_idx;



--
-- Name: relation_tuples_p24_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p24_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p24_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p24_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p25_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p25_expires_at_idx;



--
-- Name: relation_tuples_p25_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p25_pkey;



--
-- Name: relation_tuples_p25_tenant_id_object_type_object_id_relatio_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p25_tenant_id_object_type_object_id_relatio_idx;



--
-- Name: relation_tuples_p25_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p25_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p25_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p25_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p26_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p26_expires_at_idx;



--
-- Name: relation_tuples_p26_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p26_pkey;



--
-- Name: relation_tuples_p26_tenant_id_object_type_object_id_relatio_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p26_tenant_id_object_type_object_id_relatio_idx;



--
-- Name: relation_tuples_p26_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p26_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p26_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p26_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p27_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p27_expires_at_idx;



--
-- Name: relation_tuples_p27_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p27_pkey;



--
-- Name: relation_tuples_p27_tenant_id_object_type_object_id_relatio_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p27_tenant_id_object_type_object_id_relatio_idx;



--
-- Name: relation_tuples_p27_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p27_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p27_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p27_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p28_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p28_expires_at_idx;



--
-- Name: relation_tuples_p28_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p28_pkey;



--
-- Name: relation_tuples_p28_tenant_id_object_type_object_id_relatio_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p28_tenant_id_object_type_object_id_relatio_idx;



--
-- Name: relation_tuples_p28_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p28_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p28_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p28_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p29_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p29_expires_at_idx;



--
-- Name: relation_tuples_p29_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p29_pkey;



--
-- Name: relation_tuples_p29_tenant_id_object_type_object_id_relatio_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p29_tenant_id_object_type_object_id_relatio_idx;



--
-- Name: relation_tuples_p29_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p29_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p29_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p29_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p2_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p2_expires_at_idx;



--
-- Name: relation_tuples_p2_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p2_pkey;



--
-- Name: relation_tuples_p2_tenant_id_object_type_object_id_relation_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p2_tenant_id_object_type_object_id_relation_idx;



--
-- Name: relation_tuples_p2_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p2_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p2_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p2_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p30_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p30_expires_at_idx;



--
-- Name: relation_tuples_p30_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p30_pkey;



--
-- Name: relation_tuples_p30_tenant_id_object_type_object_id_relatio_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p30_tenant_id_object_type_object_id_relatio_idx;



--
-- Name: relation_tuples_p30_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p30_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p30_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p30_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p31_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p31_expires_at_idx;



--
-- Name: relation_tuples_p31_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p31_pkey;



--
-- Name: relation_tuples_p31_tenant_id_object_type_object_id_relatio_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p31_tenant_id_object_type_object_id_relatio_idx;



--
-- Name: relation_tuples_p31_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p31_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p31_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p31_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p3_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p3_expires_at_idx;



--
-- Name: relation_tuples_p3_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p3_pkey;



--
-- Name: relation_tuples_p3_tenant_id_object_type_object_id_relation_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p3_tenant_id_object_type_object_id_relation_idx;



--
-- Name: relation_tuples_p3_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p3_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p3_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p3_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p4_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p4_expires_at_idx;



--
-- Name: relation_tuples_p4_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p4_pkey;



--
-- Name: relation_tuples_p4_tenant_id_object_type_object_id_relation_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p4_tenant_id_object_type_object_id_relation_idx;



--
-- Name: relation_tuples_p4_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p4_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p4_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p4_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p5_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p5_expires_at_idx;



--
-- Name: relation_tuples_p5_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p5_pkey;



--
-- Name: relation_tuples_p5_tenant_id_object_type_object_id_relation_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p5_tenant_id_object_type_object_id_relation_idx;



--
-- Name: relation_tuples_p5_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p5_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p5_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p5_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p6_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p6_expires_at_idx;



--
-- Name: relation_tuples_p6_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p6_pkey;



--
-- Name: relation_tuples_p6_tenant_id_object_type_object_id_relation_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p6_tenant_id_object_type_object_id_relation_idx;



--
-- Name: relation_tuples_p6_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p6_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p6_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p6_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p7_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p7_expires_at_idx;



--
-- Name: relation_tuples_p7_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p7_pkey;



--
-- Name: relation_tuples_p7_tenant_id_object_type_object_id_relation_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p7_tenant_id_object_type_object_id_relation_idx;



--
-- Name: relation_tuples_p7_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p7_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p7_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p7_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p8_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p8_expires_at_idx;



--
-- Name: relation_tuples_p8_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p8_pkey;



--
-- Name: relation_tuples_p8_tenant_id_object_type_object_id_relation_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p8_tenant_id_object_type_object_id_relation_idx;



--
-- Name: relation_tuples_p8_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p8_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p8_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p8_tenant_id_subject_type_subject_id_idx;



--
-- Name: relation_tuples_p9_expires_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_expiry_idx ATTACH PARTITION public.relation_tuples_p9_expires_at_idx;



--
-- Name: relation_tuples_p9_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.relation_tuples_pkey ATTACH PARTITION public.relation_tuples_p9_pkey;



--
-- Name: relation_tuples_p9_tenant_id_object_type_object_id_relation_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_lookup_idx ATTACH PARTITION public.relation_tuples_p9_tenant_id_object_type_object_id_relation_idx;



--
-- Name: relation_tuples_p9_tenant_id_source_derived_from_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_derived_idx ATTACH PARTITION public.relation_tuples_p9_tenant_id_source_derived_from_idx;



--
-- Name: relation_tuples_p9_tenant_id_subject_type_subject_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.rt_subject_idx ATTACH PARTITION public.relation_tuples_p9_tenant_id_subject_type_subject_id_idx;



--
-- Name: roles audit_roles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_roles AFTER INSERT OR DELETE OR UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('admin');



--
-- Name: users audit_users; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_users AFTER INSERT OR DELETE OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('admin');



--
-- Name: user_facility_assignments set_updated_at_ufa; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_ufa BEFORE UPDATE ON public.user_facility_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: roles trg_roles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: access_alerts access_alerts_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_alerts
    ADD CONSTRAINT access_alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);



--
-- Name: access_alerts access_alerts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_alerts
    ADD CONSTRAINT access_alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);



--
-- Name: access_group_members access_group_members_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_group_members
    ADD CONSTRAINT access_group_members_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id);



--
-- Name: access_group_members access_group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_group_members
    ADD CONSTRAINT access_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.access_groups(id) ON DELETE CASCADE;



--
-- Name: access_group_members access_group_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_group_members
    ADD CONSTRAINT access_group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);



--
-- Name: access_groups access_groups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_groups
    ADD CONSTRAINT access_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);



--
-- Name: access_log access_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_log
    ADD CONSTRAINT access_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);



--
-- Name: break_glass_events break_glass_events_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.break_glass_events
    ADD CONSTRAINT break_glass_events_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id);



--
-- Name: break_glass_events break_glass_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.break_glass_events
    ADD CONSTRAINT break_glass_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);



--
-- Name: refresh_tokens refresh_tokens_replaced_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_replaced_by_fkey FOREIGN KEY (replaced_by) REFERENCES public.refresh_tokens(id);



--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);



--
-- Name: relation_tuples relation_tuples_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.relation_tuples
    ADD CONSTRAINT relation_tuples_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id);



--
-- Name: relation_tuples relation_tuples_revoked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.relation_tuples
    ADD CONSTRAINT relation_tuples_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES public.users(id);



--
-- Name: sensitive_patients sensitive_patients_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensitive_patients
    ADD CONSTRAINT sensitive_patients_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);



--
-- Name: user_facility_assignments user_facility_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_facility_assignments
    ADD CONSTRAINT user_facility_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;



--
-- Name: users users_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id);



--
-- Name: access_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.access_alerts ENABLE ROW LEVEL SECURITY;


--
-- Name: access_group_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.access_group_members ENABLE ROW LEVEL SECURITY;


--
-- Name: access_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.access_groups ENABLE ROW LEVEL SECURITY;


--
-- Name: access_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.access_log ENABLE ROW LEVEL SECURITY;


--
-- Name: break_glass_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.break_glass_events ENABLE ROW LEVEL SECURITY;


--
-- Name: dpdp_consents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dpdp_consents ENABLE ROW LEVEL SECURITY;


--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;


--
-- Name: relation_tuples; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.relation_tuples ENABLE ROW LEVEL SECURITY;


--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;


--
-- Name: sensitive_patients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sensitive_patients ENABLE ROW LEVEL SECURITY;


--
-- Name: access_log tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.access_log USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: access_alerts tenant_isolation_access_alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_access_alerts ON public.access_alerts USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: access_group_members tenant_isolation_access_group_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_access_group_members ON public.access_group_members USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: access_groups tenant_isolation_access_groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_access_groups ON public.access_groups USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: break_glass_events tenant_isolation_break_glass_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_break_glass_events ON public.break_glass_events USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: dpdp_consents tenant_isolation_dpdp_consents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_dpdp_consents ON public.dpdp_consents USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: refresh_tokens tenant_isolation_refresh_tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_refresh_tokens ON public.refresh_tokens USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: relation_tuples tenant_isolation_relation_tuples; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples ON public.relation_tuples USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: roles tenant_isolation_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_roles ON public.roles USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: sensitive_patients tenant_isolation_sensitive_patients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_sensitive_patients ON public.sensitive_patients USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: user_facility_assignments tenant_isolation_ufa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ufa ON public.user_facility_assignments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: users tenant_isolation_users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_users ON public.users USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: user_facility_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_facility_assignments ENABLE ROW LEVEL SECURITY;


--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

