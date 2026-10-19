-- ====================================================================
-- Migration: 1119_sticky_notes_from_notifications.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: sticky_note_preferences
-- Drops: none
-- ====================================================================
-- Notifications flow into sticky notes. A person pins a notification to their
-- notes, or chooses kinds of notification that always become a note. Such a
-- note is written by the system: its text is the notification's and cannot be
-- edited, it is never shared (the notification was addressed to one person
-- for a reason — a critical value is not for a ward board), and it can be
-- dismissed. When the item behind it is resolved — a critical value
-- acknowledged, an access request reviewed — the note clears itself.
--
-- Everything that turns a notification into a note, and every rule for when
-- a source counts as resolved, is in this file:
--   sticky_note_from_notification()  one note per live notification
--   trg_sticky_notes_from_notification  the per-user "always" preference,
--                                    on every notification insert, whichever
--                                    of the ~40 producers wrote it
--   sticky_note_resolvable() / resolve_sticky_notes()  the resolver registry,
--                                    run when the reader opens their notes

ALTER TABLE public.sticky_notes
    ADD COLUMN is_system boolean NOT NULL DEFAULT false,
    ADD COLUMN notification_id uuid REFERENCES public.notifications(id),
    ADD COLUMN source_kind text,
    ADD COLUMN source_id uuid,
    ADD COLUMN source_url text,
    ADD COLUMN auto_resolve boolean NOT NULL DEFAULT false,
    ADD COLUMN resolved_at timestamptz,
    ADD CONSTRAINT sticky_notes_auto_resolve_needs_source
        CHECK (NOT auto_resolve OR (source_kind IS NOT NULL AND source_id IS NOT NULL));

-- One live note per notification; a dismissed one may be pinned again.
CREATE UNIQUE INDEX uq_sticky_notes_notification ON public.sticky_notes (notification_id)
    WHERE deleted_at IS NULL AND notification_id IS NOT NULL;
CREATE INDEX idx_sticky_notes_unresolved ON public.sticky_notes (tenant_id, author_id)
    WHERE deleted_at IS NULL AND auto_resolve AND resolved_at IS NULL;

-- Which kinds of notification always become a note for this person.
-- Keys are checked by the server against its catalogue.
CREATE TABLE public.sticky_note_preferences (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    user_id uuid NOT NULL REFERENCES public.users(id),
    kinds text[] NOT NULL DEFAULT '{}' CHECK (cardinality(kinds) <= 20),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid REFERENCES public.users(id),
    delete_reason text
);

CREATE UNIQUE INDEX uq_sticky_note_preferences_user
    ON public.sticky_note_preferences (tenant_id, user_id) WHERE deleted_at IS NULL;

ALTER TABLE public.sticky_note_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sticky_note_preferences FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_sticky_note_preferences ON public.sticky_note_preferences
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_sticky_note_preferences
    BEFORE UPDATE ON public.sticky_note_preferences
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_sticky_note_preferences_soft_delete
    BEFORE DELETE ON public.sticky_note_preferences
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- A notification's source, named finely enough to say when it is resolved:
-- a lab order's critical value is resolved by acknowledgement, while "lab
-- results ready" about the same order has nothing to resolve.
CREATE FUNCTION public.sticky_note_source_kind(p_entity_type text, p_kind text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN p_entity_type = 'lab_order' AND p_kind = 'danger' THEN 'lab_critical'
        WHEN p_entity_type = 'radiology_order' AND p_kind = 'danger' THEN 'radiology_critical'
        ELSE p_entity_type
    END
$$;

-- The source kinds resolve_sticky_notes() knows how to resolve. Keep the two
-- in step: a kind listed here and not handled there would never clear.
CREATE FUNCTION public.sticky_note_resolvable(p_source_kind text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
    SELECT coalesce(p_source_kind IN ('lab_critical', 'radiology_critical', 'access_request',
                                      'prescription_refill_requests', 'prescriptions'), false)
$$;

-- The note for one of `p_user`'s notifications: the live one if it exists,
-- else a new system note in their own list. NULL when the notification is
-- not theirs — the caller answers 404.
CREATE FUNCTION public.sticky_note_from_notification(p_notification_id uuid, p_user uuid)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
    v_id uuid;
BEGIN
    SELECT s.id INTO v_id FROM public.sticky_notes s
     WHERE s.notification_id = p_notification_id AND s.author_id = p_user
       AND s.deleted_at IS NULL;
    IF v_id IS NOT NULL THEN
        RETURN v_id;
    END IF;
    INSERT INTO public.sticky_notes
        (tenant_id, author_id, body, colour, is_system, notification_id,
         source_kind, source_id, source_url, auto_resolve)
    SELECT n.tenant_id, n.user_id,
           left(n.title || coalesce(E'\n' || nullif(btrim(n.body), ''), ''), 1000),
           CASE WHEN n.kind = 'danger' THEN 'pink' ELSE 'blue' END,
           true, n.id, k.source_kind, n.entity_id, n.action_url,
           n.entity_id IS NOT NULL AND public.sticky_note_resolvable(k.source_kind)
      FROM public.notifications n
      CROSS JOIN LATERAL (SELECT public.sticky_note_source_kind(n.entity_type, n.kind)
                                 AS source_kind) k
     WHERE n.id = p_notification_id AND n.user_id = p_user
    ON CONFLICT (notification_id) WHERE deleted_at IS NULL AND notification_id IS NOT NULL
    DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
        -- Lost a race with a concurrent pin, or not the caller's notification.
        SELECT s.id INTO v_id FROM public.sticky_notes s
         WHERE s.notification_id = p_notification_id AND s.author_id = p_user
           AND s.deleted_at IS NULL;
    END IF;
    RETURN v_id;
END
$$;

-- The "always make a note" preference, applied as the notification is
-- written, in the same transaction. A note is a convenience and the
-- notification is not: a failure here is logged and swallowed, never allowed
-- to roll back a critical-value alert.
CREATE FUNCTION public.sticky_notes_from_notification()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.sticky_note_preferences p
         WHERE p.tenant_id = NEW.tenant_id AND p.user_id = NEW.user_id AND p.deleted_at IS NULL
           AND ((NEW.kind = 'danger' AND 'urgent' = ANY(p.kinds))
                OR lower(NEW.category) = ANY(p.kinds))
    ) THEN
        PERFORM public.sticky_note_from_notification(NEW.id, NEW.user_id);
    END IF;
    RETURN NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'sticky note for notification % not made: %', NEW.id, SQLERRM;
    RETURN NULL;
END
$$;

CREATE TRIGGER trg_sticky_notes_from_notification AFTER INSERT ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION public.sticky_notes_from_notification();

-- Clear `p_user`'s auto-resolving notes whose source has been resolved since
-- the note was made. Set-based: one join per source kind over the reader's
-- open notes (bounded by the partial index and LIMIT), no per-note query and
-- no background job — a note can only be seen through GET /api/notes, which
-- calls this first. A source already resolved when the note was made does not
-- clear it: the person pinned it knowing.
-- ponytail: `prescriptions` has no signed-at column, so updated_at stands in;
-- add signed_at to prescriptions if an unrelated edit after signing matters.
CREATE FUNCTION public.resolve_sticky_notes(p_tenant uuid, p_user uuid)
RETURNS integer LANGUAGE sql AS $$
    WITH open AS (
        SELECT id, source_kind, source_id, created_at FROM public.sticky_notes
         WHERE tenant_id = p_tenant AND author_id = p_user AND deleted_at IS NULL
           AND auto_resolve AND resolved_at IS NULL
         LIMIT 600
    ), lab AS (
        SELECT order_id AS source_id, max(acknowledged_at) AS at FROM public.lab_critical_alerts
         WHERE order_id IN (SELECT source_id FROM open WHERE source_kind = 'lab_critical')
           AND deleted_at IS NULL
         GROUP BY order_id HAVING bool_and(acknowledged_at IS NOT NULL)
    ), radiology AS (
        SELECT order_id AS source_id, max(acknowledged_at) AS at
          FROM public.radiology_critical_alerts
         WHERE order_id IN (SELECT source_id FROM open WHERE source_kind = 'radiology_critical')
         GROUP BY order_id HAVING bool_and(acknowledged_at IS NOT NULL)
    ), done AS (
        SELECT o.id, l.at FROM open o
          JOIN lab l ON o.source_kind = 'lab_critical' AND l.source_id = o.source_id
        UNION ALL
        SELECT o.id, r.at FROM open o
          JOIN radiology r ON o.source_kind = 'radiology_critical' AND r.source_id = o.source_id
        UNION ALL
        SELECT o.id, a.reviewed_at FROM open o
          JOIN public.iam_access_requests a ON o.source_kind = 'access_request'
           AND a.id = o.source_id AND a.status <> 'pending' AND a.reviewed_at IS NOT NULL
        UNION ALL
        SELECT o.id, q.decided_at FROM open o
          JOIN public.prescription_refill_requests q
            ON o.source_kind = 'prescription_refill_requests'
           AND q.id = o.source_id AND q.status <> 'with_doctor' AND q.decided_at IS NOT NULL
        UNION ALL
        SELECT o.id, p.updated_at FROM open o
          JOIN public.prescriptions p ON o.source_kind = 'prescriptions'
           AND p.id = o.source_id AND p.is_signed
    ), cleared AS (
        UPDATE public.sticky_notes n SET resolved_at = d.at
          FROM done d JOIN open o ON o.id = d.id
         WHERE n.id = d.id AND d.at > o.created_at
        RETURNING n.id
    )
    SELECT count(*)::integer FROM cleared
$$;
