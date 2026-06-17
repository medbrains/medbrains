-- ============================================================
-- MedBrains schema — module: notifications (in-app notification centre)
-- Per-user, tenant-scoped notification feed with read/unread state.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,                       -- recipient
    kind text NOT NULL DEFAULT 'info',           -- info | success | warning | danger
    title text NOT NULL,
    body text,
    category text,                               -- source/module label, e.g. "Billing"
    entity_type text,                            -- linked resource type, e.g. "invoice"
    entity_id uuid,
    action_url text,                             -- where clicking the item navigates
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

-- Hot path: a user's unread feed, newest first.
CREATE INDEX IF NOT EXISTS idx_notifications_user_feed
    ON public.notifications (tenant_id, user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_notifications ON public.notifications;
CREATE POLICY tenant_isolation_notifications ON public.notifications
    USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)))
    WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));
