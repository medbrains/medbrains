-- RLS backfill (audit P0 #8): tenant tables created without row-level
-- security. Uses the idempotent helpers from 0001_core.sql.
--
-- Deliberately NOT covered here:
--   * nhcx_callback_log, abdm_gateway_callbacks — written by unauthenticated
--     gateway callbacks before tenant context exists (NULL tenant rows are
--     legitimate for unknown correlation ids). Enabling tenant RLS would
--     break those writers; needs a writer refactor first (tracked in #160).

-- relation_tuples partitions (parent has RLS since 0003; partition policies
-- only matter for direct partition access — defense in depth).
DO $$
DECLARE
    i int;
BEGIN
    FOR i IN 0..31 LOOP
        PERFORM apply_tenant_rls(format('public.relation_tuples_p%s', i)::regclass);
    END LOOP;
END $$;

-- Camp / outreach (0117, 0138)
SELECT apply_tenant_rls('public.camp_approval_items');
SELECT apply_tenant_rls('public.camp_closure_tasks');
SELECT apply_tenant_rls('public.camp_counters');
SELECT apply_tenant_rls('public.camp_department_counters');
SELECT apply_tenant_rls('public.camp_doctor_roster');
SELECT apply_tenant_rls('public.camp_incidents');
SELECT apply_tenant_rls('public.camp_medicine_pricing_rules');
SELECT apply_tenant_rls('public.camp_print_plan_items');
SELECT apply_tenant_rls('public.camp_referral_plans');
SELECT apply_tenant_rls('public.camp_referrals');
SELECT apply_tenant_rls('public.camp_remote_checklist_items');
SELECT apply_tenant_rls('public.camp_remote_setups');
SELECT apply_tenant_rls('public.camp_service_pricing_rules');
SELECT apply_tenant_rls('public.camp_site_readiness_items');
SELECT apply_tenant_rls('public.camp_sponsor_plans');
SELECT apply_tenant_rls('public.camp_staff_roster');
SELECT apply_tenant_rls('public.camp_supply_items');
SELECT apply_tenant_rls('public.camp_sync_events');
SELECT apply_tenant_rls('public.camp_target_populations');

-- Clinical offline logs (0061)
SELECT apply_tenant_rls('public.ed_triage_entries');
SELECT apply_tenant_rls('public.nurse_shift_handoff_entries');
SELECT apply_tenant_rls('public.nursing_shift_notes');
SELECT apply_tenant_rls('public.patient_clinical_notes');

-- IAM / finance / ABDM
SELECT apply_tenant_rls('public.iam_access_requests');
SELECT apply_tenant_rls('public.bank_transaction_claim_allocations');
SELECT apply_tenant_rls('public.abdm_hfr_registrations');

-- backup_history: NULL tenant_id rows are system-wide backups
-- (it_security.rs reads "tenant_id IS NULL OR tenant_id = $1").
SELECT apply_tenant_rls_with_global('public.backup_history');
