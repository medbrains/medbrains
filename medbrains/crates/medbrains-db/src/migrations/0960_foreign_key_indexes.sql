-- RLS-Posture: unchanged
-- Tenant-Column: n/a
-- New-Tables: none
-- Drops: none
-- Indexes for the foreign keys that are actually used.
--
-- A schema audit found 978 foreign keys with no index on the referencing
-- column. Indexing all of them would be its own anti-pattern: an index nothing
-- reads still costs write throughput, disk and vacuum time on every insert,
-- and a hospital's write path is not somewhere to spend that speculatively.
--
-- The usual argument for indexing a foreign key barely applies to this schema.
-- It is that a parent DELETE scans the whole child table to check the
-- constraint — but 757 of 872 tables carry a `soft_delete_guardrail` trigger
-- that rewrites DELETE into an UPDATE of `deleted_at`, so that check never
-- fires, and 1,976 of the foreign keys are NO ACTION besides.
--
-- What remains is join cost, which depends on whether anything looks rows up
-- by the column. So these 84 were selected by `scripts/triage_fk_indexes.py`
-- from evidence in the Rust sources rather than from the catalog: each one
-- carries the reason it was chosen on the line above it.
--
-- The other 894 are deliberately left alone. They are not proven useless, only
-- unproven useful — the honest signal is `pg_stat_user_tables.seq_scan` from a
-- production instance under real load, and until that exists this is the best
-- available evidence rather than a guess dressed as one.
--
-- Regenerate with:  python3 scripts/triage_fk_indexes.py --emit-sql


-- cancer_stagings.patient_id -> patients: queried 282x, cascade, but parent soft-deletes, child of patients
CREATE INDEX IF NOT EXISTS idx_cancer_stagings_patient_id
    ON public.cancer_stagings (patient_id);

-- dental_exams.patient_id -> patients: queried 282x, cascade, but parent soft-deletes, child of patients
CREATE INDEX IF NOT EXISTS idx_dental_exams_patient_id
    ON public.dental_exams (patient_id);

-- ophtho_exams.patient_id -> patients: queried 282x, cascade, but parent soft-deletes, child of patients
CREATE INDEX IF NOT EXISTS idx_ophtho_exams_patient_id
    ON public.ophtho_exams (patient_id);

-- radiation_sessions.patient_id -> patients: queried 282x, cascade, but parent soft-deletes, child of patients
CREATE INDEX IF NOT EXISTS idx_radiation_sessions_patient_id
    ON public.radiation_sessions (patient_id);

-- tele_consultations.patient_id -> patients: queried 282x, child of patients
CREATE INDEX IF NOT EXISTS idx_tele_consultations_patient_id
    ON public.tele_consultations (patient_id);

-- access_alerts.user_id -> users: queried 80x
CREATE INDEX IF NOT EXISTS idx_access_alerts_user_id
    ON public.access_alerts (user_id);

-- access_group_members.user_id -> users: queried 80x
CREATE INDEX IF NOT EXISTS idx_access_group_members_user_id
    ON public.access_group_members (user_id);

-- access_log.user_id -> users: queried 80x
CREATE INDEX IF NOT EXISTS idx_access_log_user_id
    ON public.access_log (user_id);

-- break_glass_events.user_id -> users: queried 80x
CREATE INDEX IF NOT EXISTS idx_break_glass_events_user_id
    ON public.break_glass_events (user_id);

-- camp_approval_items.camp_id -> camps: queried 89x
CREATE INDEX IF NOT EXISTS idx_camp_approval_items_camp_id
    ON public.camp_approval_items (camp_id);

-- camp_asset_reservations.camp_id -> camps: queried 89x
CREATE INDEX IF NOT EXISTS idx_camp_asset_reservations_camp_id
    ON public.camp_asset_reservations (camp_id);

-- camp_closure_tasks.camp_id -> camps: queried 89x
CREATE INDEX IF NOT EXISTS idx_camp_closure_tasks_camp_id
    ON public.camp_closure_tasks (camp_id);

-- camp_counters.camp_id -> camps: queried 89x
CREATE INDEX IF NOT EXISTS idx_camp_counters_camp_id
    ON public.camp_counters (camp_id);

-- camp_department_counters.camp_id -> camps: queried 89x
CREATE INDEX IF NOT EXISTS idx_camp_department_counters_camp_id
    ON public.camp_department_counters (camp_id);

-- camp_doctor_roster.camp_id -> camps: queried 89x
CREATE INDEX IF NOT EXISTS idx_camp_doctor_roster_camp_id
    ON public.camp_doctor_roster (camp_id);

-- camp_incidents.camp_id -> camps: queried 89x
CREATE INDEX IF NOT EXISTS idx_camp_incidents_camp_id
    ON public.camp_incidents (camp_id);

-- camp_medicine_pricing_rules.camp_id -> camps: queried 89x
CREATE INDEX IF NOT EXISTS idx_camp_medicine_pricing_rules_camp_id
    ON public.camp_medicine_pricing_rules (camp_id);

-- camp_print_plan_items.camp_id -> camps: queried 89x
CREATE INDEX IF NOT EXISTS idx_camp_print_plan_items_camp_id
    ON public.camp_print_plan_items (camp_id);

-- camp_referral_plans.camp_id -> camps: queried 89x
CREATE INDEX IF NOT EXISTS idx_camp_referral_plans_camp_id
    ON public.camp_referral_plans (camp_id);

-- camp_referrals.camp_id -> camps: queried 89x
CREATE INDEX IF NOT EXISTS idx_camp_referrals_camp_id
    ON public.camp_referrals (camp_id);

-- camp_registrations.camp_id -> camps: queried 89x
CREATE INDEX IF NOT EXISTS idx_camp_registrations_camp_id
    ON public.camp_registrations (camp_id);

-- camp_remote_checklist_items.camp_id -> camps: queried 89x
CREATE INDEX IF NOT EXISTS idx_camp_remote_checklist_items_camp_id
    ON public.camp_remote_checklist_items (camp_id);

-- camp_remote_setups.camp_id -> camps: queried 89x
CREATE INDEX IF NOT EXISTS idx_camp_remote_setups_camp_id
    ON public.camp_remote_setups (camp_id);

-- camp_service_pricing_rules.camp_id -> camps: queried 89x
CREATE INDEX IF NOT EXISTS idx_camp_service_pricing_rules_camp_id
    ON public.camp_service_pricing_rules (camp_id);

-- camp_site_readiness_items.camp_id -> camps: queried 89x
CREATE INDEX IF NOT EXISTS idx_camp_site_readiness_items_camp_id
    ON public.camp_site_readiness_items (camp_id);

-- camp_sponsor_plans.camp_id -> camps: queried 89x
CREATE INDEX IF NOT EXISTS idx_camp_sponsor_plans_camp_id
    ON public.camp_sponsor_plans (camp_id);

-- camp_staff_roster.camp_id -> camps: queried 89x
CREATE INDEX IF NOT EXISTS idx_camp_staff_roster_camp_id
    ON public.camp_staff_roster (camp_id);

-- camp_supply_items.camp_id -> camps: queried 89x
CREATE INDEX IF NOT EXISTS idx_camp_supply_items_camp_id
    ON public.camp_supply_items (camp_id);

-- camp_sync_events.camp_id -> camps: queried 89x
CREATE INDEX IF NOT EXISTS idx_camp_sync_events_camp_id
    ON public.camp_sync_events (camp_id);

-- camp_target_populations.camp_id -> camps: queried 89x
CREATE INDEX IF NOT EXISTS idx_camp_target_populations_camp_id
    ON public.camp_target_populations (camp_id);

-- camp_team_members.camp_id -> camps: queried 89x
CREATE INDEX IF NOT EXISTS idx_camp_team_members_camp_id
    ON public.camp_team_members (camp_id);

-- device_pairing_tokens.department_id -> departments: queried 118x
CREATE INDEX IF NOT EXISTS idx_device_pairing_tokens_department_id
    ON public.device_pairing_tokens (department_id);

-- doctor_profiles.user_id -> users: queried 80x, cascade, but parent soft-deletes
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_user_id
    ON public.doctor_profiles (user_id);

-- employees.user_id -> users: queried 80x
CREATE INDEX IF NOT EXISTS idx_employees_user_id
    ON public.employees (user_id);

-- eod_digest_history.user_id -> users: queried 80x
CREATE INDEX IF NOT EXISTS idx_eod_digest_history_user_id
    ON public.eod_digest_history (user_id);

-- eod_digest_subscriptions.user_id -> users: queried 80x
CREATE INDEX IF NOT EXISTS idx_eod_digest_subscriptions_user_id
    ON public.eod_digest_subscriptions (user_id);

-- lms_certificates.user_id -> users: queried 80x
CREATE INDEX IF NOT EXISTS idx_lms_certificates_user_id
    ON public.lms_certificates (user_id);

-- lms_enrollments.user_id -> users: queried 80x
CREATE INDEX IF NOT EXISTS idx_lms_enrollments_user_id
    ON public.lms_enrollments (user_id);

-- nurse_profiles.user_id -> users: queried 80x, cascade, but parent soft-deletes
CREATE INDEX IF NOT EXISTS idx_nurse_profiles_user_id
    ON public.nurse_profiles (user_id);

-- paired_devices.department_id -> departments: queried 118x
CREATE INDEX IF NOT EXISTS idx_paired_devices_department_id
    ON public.paired_devices (department_id);

-- pg_logbook_entries.user_id -> users: queried 80x
CREATE INDEX IF NOT EXISTS idx_pg_logbook_entries_user_id
    ON public.pg_logbook_entries (user_id);

-- quality_document_acknowledgments.user_id -> users: queried 80x
CREATE INDEX IF NOT EXISTS idx_quality_document_acknowledgments_user_id
    ON public.quality_document_acknowledgments (user_id);

-- stations.department_id -> departments: queried 118x
CREATE INDEX IF NOT EXISTS idx_stations_department_id
    ON public.stations (department_id);

-- vpn_devices.user_id -> users: queried 80x, cascade, but parent soft-deletes
CREATE INDEX IF NOT EXISTS idx_vpn_devices_user_id
    ON public.vpn_devices (user_id);

-- trial_adverse_events.trial_id -> clinical_trials: queried 10x, cascade on a hard-deleting parent
CREATE INDEX IF NOT EXISTS idx_trial_adverse_events_trial_id
    ON public.trial_adverse_events (trial_id);

-- trial_irb_submissions.trial_id -> clinical_trials: queried 10x, cascade on a hard-deleting parent
CREATE INDEX IF NOT EXISTS idx_trial_irb_submissions_trial_id
    ON public.trial_irb_submissions (trial_id);

-- trial_randomizations.trial_id -> clinical_trials: queried 10x, cascade on a hard-deleting parent
CREATE INDEX IF NOT EXISTS idx_trial_randomizations_trial_id
    ON public.trial_randomizations (trial_id);

-- trial_visits.trial_id -> clinical_trials: queried 10x, cascade on a hard-deleting parent
CREATE INDEX IF NOT EXISTS idx_trial_visits_trial_id
    ON public.trial_visits (trial_id);

-- health_package_bookings.package_id -> health_packages: queried 8x, cascade on a hard-deleting parent
CREATE INDEX IF NOT EXISTS idx_health_package_bookings_package_id
    ON public.health_package_bookings (package_id);

-- payment_terminals.location_id -> locations: queried 30x
CREATE INDEX IF NOT EXISTS idx_payment_terminals_location_id
    ON public.payment_terminals (location_id);

-- payslips.run_id -> payroll_runs: queried 4x, cascade on a hard-deleting parent
CREATE INDEX IF NOT EXISTS idx_payslips_run_id
    ON public.payslips (run_id);

-- sso_auth_state.provider_id -> identity_providers: queried 3x, cascade on a hard-deleting parent
CREATE INDEX IF NOT EXISTS idx_sso_auth_state_provider_id
    ON public.sso_auth_state (provider_id);

-- tele_chat_messages.consultation_id -> tele_consultations: queried 3x, cascade on a hard-deleting parent
CREATE INDEX IF NOT EXISTS idx_tele_chat_messages_consultation_id
    ON public.tele_chat_messages (consultation_id);

-- tele_triage.consultation_id -> tele_consultations: queried 3x, cascade on a hard-deleting parent
CREATE INDEX IF NOT EXISTS idx_tele_triage_consultation_id
    ON public.tele_triage (consultation_id);

-- ai_messages.conversation_id -> ai_conversations: queried 2x, cascade on a hard-deleting parent
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id
    ON public.ai_messages (conversation_id);

-- medication_reconciliation_items.reconciliation_id -> medication_reconciliations: queried 2x, cascade on a hard-deleting parent
CREATE INDEX IF NOT EXISTS idx_medication_reconciliation_items_reconciliation_id
    ON public.medication_reconciliation_items (reconciliation_id);

-- dental_chart_entries.exam_id -> dental_exams: queried 1x, cascade on a hard-deleting parent
CREATE INDEX IF NOT EXISTS idx_dental_chart_entries_exam_id
    ON public.dental_chart_entries (exam_id);

-- admissions.er_visit_id -> er_visits: queried 10x, child of er_visits
CREATE INDEX IF NOT EXISTS idx_admissions_er_visit_id
    ON public.admissions (er_visit_id);

-- ambulance_drivers.employee_id -> employees: queried 25x
CREATE INDEX IF NOT EXISTS idx_ambulance_drivers_employee_id
    ON public.ambulance_drivers (employee_id);

-- appraisals.employee_id -> employees: queried 25x
CREATE INDEX IF NOT EXISTS idx_appraisals_employee_id
    ON public.appraisals (employee_id);

-- attendance_records.employee_id -> employees: queried 25x
CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_id
    ON public.attendance_records (employee_id);

-- camp_staff_roster.employee_id -> employees: queried 25x
CREATE INDEX IF NOT EXISTS idx_camp_staff_roster_employee_id
    ON public.camp_staff_roster (employee_id);

-- camp_team_members.employee_id -> employees: queried 25x
CREATE INDEX IF NOT EXISTS idx_camp_team_members_employee_id
    ON public.camp_team_members (employee_id);

-- duty_rosters.employee_id -> employees: queried 25x
CREATE INDEX IF NOT EXISTS idx_duty_rosters_employee_id
    ON public.duty_rosters (employee_id);

-- ed_triage_entries.er_visit_id -> er_visits: queried 10x, cascade, but parent soft-deletes, child of er_visits
CREATE INDEX IF NOT EXISTS idx_ed_triage_entries_er_visit_id
    ON public.ed_triage_entries (er_visit_id);

-- employee_credentials.employee_id -> employees: queried 25x, cascade, but parent soft-deletes
CREATE INDEX IF NOT EXISTS idx_employee_credentials_employee_id
    ON public.employee_credentials (employee_id);

-- er_code_activations.er_visit_id -> er_visits: queried 10x, child of er_visits
CREATE INDEX IF NOT EXISTS idx_er_code_activations_er_visit_id
    ON public.er_code_activations (er_visit_id);

-- er_observation_notes.er_visit_id -> er_visits: queried 10x, cascade, but parent soft-deletes, child of er_visits
CREATE INDEX IF NOT EXISTS idx_er_observation_notes_er_visit_id
    ON public.er_observation_notes (er_visit_id);

-- leave_applications.employee_id -> users: queried 25x
CREATE INDEX IF NOT EXISTS idx_leave_applications_employee_id
    ON public.leave_applications (employee_id);

-- leave_balances.employee_id -> employees: queried 25x
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_id
    ON public.leave_balances (employee_id);

-- leave_requests.employee_id -> employees: queried 25x
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id
    ON public.leave_requests (employee_id);

-- mlc_cases.er_visit_id -> er_visits: queried 10x, child of er_visits
CREATE INDEX IF NOT EXISTS idx_mlc_cases_er_visit_id
    ON public.mlc_cases (er_visit_id);

-- mrd_death_register.er_visit_id -> er_visits: queried 10x, child of er_visits
CREATE INDEX IF NOT EXISTS idx_mrd_death_register_er_visit_id
    ON public.mrd_death_register (er_visit_id);

-- occ_health_drug_screens.employee_id -> employees: queried 25x
CREATE INDEX IF NOT EXISTS idx_occ_health_drug_screens_employee_id
    ON public.occ_health_drug_screens (employee_id);

-- occ_health_injury_reports.employee_id -> employees: queried 25x
CREATE INDEX IF NOT EXISTS idx_occ_health_injury_reports_employee_id
    ON public.occ_health_injury_reports (employee_id);

-- occ_health_screenings.employee_id -> employees: queried 25x
CREATE INDEX IF NOT EXISTS idx_occ_health_screenings_employee_id
    ON public.occ_health_screenings (employee_id);

-- occ_health_vaccinations.employee_id -> employees: queried 25x
CREATE INDEX IF NOT EXISTS idx_occ_health_vaccinations_employee_id
    ON public.occ_health_vaccinations (employee_id);

-- on_call_schedules.employee_id -> employees: queried 25x
CREATE INDEX IF NOT EXISTS idx_on_call_schedules_employee_id
    ON public.on_call_schedules (employee_id);

-- payslips.employee_id -> employees: queried 25x, cascade, but parent soft-deletes
CREATE INDEX IF NOT EXISTS idx_payslips_employee_id
    ON public.payslips (employee_id);

-- salary_structures.employee_id -> employees: queried 25x, cascade, but parent soft-deletes
CREATE INDEX IF NOT EXISTS idx_salary_structures_employee_id
    ON public.salary_structures (employee_id);

-- statutory_records.employee_id -> employees: queried 25x
CREATE INDEX IF NOT EXISTS idx_statutory_records_employee_id
    ON public.statutory_records (employee_id);

-- tds_certificates.employee_id -> users: queried 25x
CREATE INDEX IF NOT EXISTS idx_tds_certificates_employee_id
    ON public.tds_certificates (employee_id);

-- training_attendance.employee_id -> users: queried 25x
CREATE INDEX IF NOT EXISTS idx_training_attendance_employee_id
    ON public.training_attendance (employee_id);

-- training_records.employee_id -> employees: queried 25x
CREATE INDEX IF NOT EXISTS idx_training_records_employee_id
    ON public.training_records (employee_id);

