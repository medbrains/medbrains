-- Camp data-loss guardrails.
--
-- High-volume camp data must be recoverable. These tables now carry
-- soft-delete metadata, physical deletes are blocked at the database layer,
-- and existing camp child foreign keys are changed away from cascade delete.

CREATE OR REPLACE FUNCTION public.prevent_camp_physical_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_setting('app.allow_physical_delete', true) = 'true' THEN
        RETURN OLD;
    END IF;

    RAISE EXCEPTION 'physical delete is disabled for public.%; set deleted_at/deleted_by/delete_reason instead', TG_TABLE_NAME
        USING ERRCODE = 'check_violation';
END;
$$;

DO $$
DECLARE
    table_name text;
    trigger_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'camps',
        'camp_registrations',
        'camp_screenings',
        'camp_lab_samples',
        'camp_followups',
        'camp_billing_records',
        'camp_team_members',
        'camp_remote_setups',
        'camp_remote_checklist_items',
        'camp_supply_items',
        'camp_referrals',
        'camp_incidents',
        'camp_sync_events',
        'camp_asset_reservations'
    ]
    LOOP
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at timestamptz', table_name);
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_by uuid', table_name);
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS delete_reason text', table_name);
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id, deleted_at)',
            'idx_' || table_name || '_soft_delete',
            table_name
        );

        trigger_name := 'trg_' || table_name || '_prevent_delete';
        IF NOT EXISTS (
            SELECT 1
            FROM pg_trigger
            WHERE tgname = trigger_name
        ) THEN
            EXECUTE format(
                'CREATE TRIGGER %I BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.prevent_camp_physical_delete()',
                trigger_name,
                table_name
            );
        END IF;
    END LOOP;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'camp_team_members_camp_id_fkey'
    ) THEN
        ALTER TABLE public.camp_team_members DROP CONSTRAINT camp_team_members_camp_id_fkey;
        ALTER TABLE public.camp_team_members
            ADD CONSTRAINT camp_team_members_camp_id_fkey
            FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'camp_remote_setups_camp_id_fkey'
    ) THEN
        ALTER TABLE public.camp_remote_setups DROP CONSTRAINT camp_remote_setups_camp_id_fkey;
        ALTER TABLE public.camp_remote_setups
            ADD CONSTRAINT camp_remote_setups_camp_id_fkey
            FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'camp_remote_checklist_camp_id_fkey'
    ) THEN
        ALTER TABLE public.camp_remote_checklist_items DROP CONSTRAINT camp_remote_checklist_camp_id_fkey;
        ALTER TABLE public.camp_remote_checklist_items
            ADD CONSTRAINT camp_remote_checklist_camp_id_fkey
            FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'camp_supply_items_camp_id_fkey'
    ) THEN
        ALTER TABLE public.camp_supply_items DROP CONSTRAINT camp_supply_items_camp_id_fkey;
        ALTER TABLE public.camp_supply_items
            ADD CONSTRAINT camp_supply_items_camp_id_fkey
            FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'camp_referrals_camp_id_fkey'
    ) THEN
        ALTER TABLE public.camp_referrals DROP CONSTRAINT camp_referrals_camp_id_fkey;
        ALTER TABLE public.camp_referrals
            ADD CONSTRAINT camp_referrals_camp_id_fkey
            FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'camp_incidents_camp_id_fkey'
    ) THEN
        ALTER TABLE public.camp_incidents DROP CONSTRAINT camp_incidents_camp_id_fkey;
        ALTER TABLE public.camp_incidents
            ADD CONSTRAINT camp_incidents_camp_id_fkey
            FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'camp_sync_events_camp_id_fkey'
    ) THEN
        ALTER TABLE public.camp_sync_events DROP CONSTRAINT camp_sync_events_camp_id_fkey;
        ALTER TABLE public.camp_sync_events
            ADD CONSTRAINT camp_sync_events_camp_id_fkey
            FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'camp_asset_reservations_camp_id_fkey'
    ) THEN
        ALTER TABLE public.camp_asset_reservations DROP CONSTRAINT camp_asset_reservations_camp_id_fkey;
        ALTER TABLE public.camp_asset_reservations
            ADD CONSTRAINT camp_asset_reservations_camp_id_fkey
            FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_camp_registrations_active_camp
    ON public.camp_registrations (tenant_id, camp_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_camp_sync_events_active_key
    ON public.camp_sync_events (tenant_id, idempotency_key)
    WHERE deleted_at IS NULL;
