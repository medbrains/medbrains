-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- Give the last 51 tenant-bearing tables the row-level policy they never had.
--
-- All 51 arrived in 0122_print_data_schema_alignment.sql, which added tables so
-- that print routes would return empty data instead of a 500. Each got
-- `ENABLE ROW LEVEL SECURITY` and none got a policy. `check_rls.py` has been
-- reporting them ever since, and until today that check had never run in CI —
-- the workflow lived in a directory GitHub does not read.
--
-- WHAT THIS IS NOT
--
-- It is not a live leak being closed. The application filters explicitly:
-- every read of these tables carries `tenant_id = $n` bound from the caller's
-- claims. This is the backstop underneath that, for the query somebody forgets
-- to filter — and `check_tenant_leak.py` currently reports four raw SQL
-- statements in routes/, which is exactly that population.
--
-- WHY THERE IS NO `FORCE ROW LEVEL SECURITY` HERE
--
-- The application connects as the table owner, and an owner bypasses RLS
-- unless the table is FORCEd. So these policies are inert today. Adding FORCE
-- would make them real — and would immediately break printing, because
-- `medbrains-print-data` opens its transactions with `state.db.begin()` and
-- never calls `set_tenant_context`, so `app.tenant_id` is unset and every
-- policy would evaluate false.
--
-- Making FORCE safe is a separate piece of work: every reader of these tables
-- has to adopt `set_tenant_context` first. Doing it in this migration would
-- trade a theoretical exposure for a certain outage.
--
-- Policies are dropped and recreated so re-running is safe.
--
-- Two tables from elsewhere are finished off here as well:
-- `payment_webhook_exceptions` (0166) and `sso_auth_state` (0201) each carry a
-- tenant_id and never had RLS switched on at all, so a policy alone would sit
-- on a table with the feature disabled and do nothing.

ALTER TABLE public.payment_webhook_exceptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_webhook_exceptions_tenant_isolation ON public.payment_webhook_exceptions;
CREATE POLICY payment_webhook_exceptions_tenant_isolation ON public.payment_webhook_exceptions
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE public.sso_auth_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blood_requests_tenant_isolation ON public.blood_requests;
CREATE POLICY blood_requests_tenant_isolation ON public.blood_requests
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS blood_units_tenant_isolation ON public.blood_units;
CREATE POLICY blood_units_tenant_isolation ON public.blood_units
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS calibration_agencies_tenant_isolation ON public.calibration_agencies;
CREATE POLICY calibration_agencies_tenant_isolation ON public.calibration_agencies
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS claim_procedures_tenant_isolation ON public.claim_procedures;
CREATE POLICY claim_procedures_tenant_isolation ON public.claim_procedures
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS crossmatch_results_tenant_isolation ON public.crossmatch_results;
CREATE POLICY crossmatch_results_tenant_isolation ON public.crossmatch_results
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS cylinder_storage_summary_tenant_isolation ON public.cylinder_storage_summary;
CREATE POLICY cylinder_storage_summary_tenant_isolation ON public.cylinder_storage_summary
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS drug_catalog_tenant_isolation ON public.drug_catalog;
CREATE POLICY drug_catalog_tenant_isolation ON public.drug_catalog
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS education_materials_tenant_isolation ON public.education_materials;
CREATE POLICY education_materials_tenant_isolation ON public.education_materials
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS encounter_diagnoses_tenant_isolation ON public.encounter_diagnoses;
CREATE POLICY encounter_diagnoses_tenant_isolation ON public.encounter_diagnoses
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS fluid_intake_tenant_isolation ON public.fluid_intake;
CREATE POLICY fluid_intake_tenant_isolation ON public.fluid_intake
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS fluid_output_tenant_isolation ON public.fluid_output;
CREATE POLICY fluid_output_tenant_isolation ON public.fluid_output
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS gas_incidents_tenant_isolation ON public.gas_incidents;
CREATE POLICY gas_incidents_tenant_isolation ON public.gas_incidents
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS gcs_assessments_tenant_isolation ON public.gcs_assessments;
CREATE POLICY gcs_assessments_tenant_isolation ON public.gcs_assessments
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS incident_reports_tenant_isolation ON public.incident_reports;
CREATE POLICY incident_reports_tenant_isolation ON public.incident_reports
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS insurance_companies_tenant_isolation ON public.insurance_companies;
CREATE POLICY insurance_companies_tenant_isolation ON public.insurance_companies
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS intake_output_tenant_isolation ON public.intake_output;
CREATE POLICY intake_output_tenant_isolation ON public.intake_output
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS inventory_catalog_tenant_isolation ON public.inventory_catalog;
CREATE POLICY inventory_catalog_tenant_isolation ON public.inventory_catalog
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS ipd_orders_tenant_isolation ON public.ipd_orders;
CREATE POLICY ipd_orders_tenant_isolation ON public.ipd_orders
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS iv_fluid_orders_tenant_isolation ON public.iv_fluid_orders;
CREATE POLICY iv_fluid_orders_tenant_isolation ON public.iv_fluid_orders
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS lab_critical_value_metrics_tenant_isolation ON public.lab_critical_value_metrics;
CREATE POLICY lab_critical_value_metrics_tenant_isolation ON public.lab_critical_value_metrics
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS lab_performance_metrics_tenant_isolation ON public.lab_performance_metrics;
CREATE POLICY lab_performance_metrics_tenant_isolation ON public.lab_performance_metrics
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS lab_pt_results_tenant_isolation ON public.lab_pt_results;
CREATE POLICY lab_pt_results_tenant_isolation ON public.lab_pt_results
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS lab_tat_metrics_tenant_isolation ON public.lab_tat_metrics;
CREATE POLICY lab_tat_metrics_tenant_isolation ON public.lab_tat_metrics
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS leave_types_tenant_isolation ON public.leave_types;
CREATE POLICY leave_types_tenant_isolation ON public.leave_types
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS medical_gas_systems_tenant_isolation ON public.medical_gas_systems;
CREATE POLICY medical_gas_systems_tenant_isolation ON public.medical_gas_systems
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS mlc_injuries_tenant_isolation ON public.mlc_injuries;
CREATE POLICY mlc_injuries_tenant_isolation ON public.mlc_injuries
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS mlc_samples_tenant_isolation ON public.mlc_samples;
CREATE POLICY mlc_samples_tenant_isolation ON public.mlc_samples
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS nabl_scope_of_accreditation_tenant_isolation ON public.nabl_scope_of_accreditation;
CREATE POLICY nabl_scope_of_accreditation_tenant_isolation ON public.nabl_scope_of_accreditation
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS package_additional_charges_tenant_isolation ON public.package_additional_charges;
CREATE POLICY package_additional_charges_tenant_isolation ON public.package_additional_charges
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS package_bills_tenant_isolation ON public.package_bills;
CREATE POLICY package_bills_tenant_isolation ON public.package_bills
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS package_exclusions_tenant_isolation ON public.package_exclusions;
CREATE POLICY package_exclusions_tenant_isolation ON public.package_exclusions
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS package_exclusions_used_tenant_isolation ON public.package_exclusions_used;
CREATE POLICY package_exclusions_used_tenant_isolation ON public.package_exclusions_used
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS package_inclusions_tenant_isolation ON public.package_inclusions;
CREATE POLICY package_inclusions_tenant_isolation ON public.package_inclusions
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS packages_tenant_isolation ON public.packages;
CREATE POLICY packages_tenant_isolation ON public.packages
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS patient_insurances_tenant_isolation ON public.patient_insurances;
CREATE POLICY patient_insurances_tenant_isolation ON public.patient_insurances
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS payment_webhook_exceptions_tenant_isolation ON public.payment_webhook_exceptions;
CREATE POLICY payment_webhook_exceptions_tenant_isolation ON public.payment_webhook_exceptions
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS pcpndt_form_f_compliance_tenant_isolation ON public.pcpndt_form_f_compliance;
CREATE POLICY pcpndt_form_f_compliance_tenant_isolation ON public.pcpndt_form_f_compliance
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS pcpndt_inspections_tenant_isolation ON public.pcpndt_inspections;
CREATE POLICY pcpndt_inspections_tenant_isolation ON public.pcpndt_inspections
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS pcpndt_procedure_summary_tenant_isolation ON public.pcpndt_procedure_summary;
CREATE POLICY pcpndt_procedure_summary_tenant_isolation ON public.pcpndt_procedure_summary
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS pcpndt_qualified_personnel_tenant_isolation ON public.pcpndt_qualified_personnel;
CREATE POLICY pcpndt_qualified_personnel_tenant_isolation ON public.pcpndt_qualified_personnel
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS peso_inspections_tenant_isolation ON public.peso_inspections;
CREATE POLICY peso_inspections_tenant_isolation ON public.peso_inspections
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS prescription_medications_tenant_isolation ON public.prescription_medications;
CREATE POLICY prescription_medications_tenant_isolation ON public.prescription_medications
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS rca_actions_tenant_isolation ON public.rca_actions;
CREATE POLICY rca_actions_tenant_isolation ON public.rca_actions
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS rca_data_sources_tenant_isolation ON public.rca_data_sources;
CREATE POLICY rca_data_sources_tenant_isolation ON public.rca_data_sources
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS rca_root_causes_tenant_isolation ON public.rca_root_causes;
CREATE POLICY rca_root_causes_tenant_isolation ON public.rca_root_causes
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS rca_team_members_tenant_isolation ON public.rca_team_members;
CREATE POLICY rca_team_members_tenant_isolation ON public.rca_team_members
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS sso_auth_state_tenant_isolation ON public.sso_auth_state;
CREATE POLICY sso_auth_state_tenant_isolation ON public.sso_auth_state
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS stat_orders_tenant_isolation ON public.stat_orders;
CREATE POLICY stat_orders_tenant_isolation ON public.stat_orders
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS stock_transfer_items_tenant_isolation ON public.stock_transfer_items;
CREATE POLICY stock_transfer_items_tenant_isolation ON public.stock_transfer_items
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tpa_companies_tenant_isolation ON public.tpa_companies;
CREATE POLICY tpa_companies_tenant_isolation ON public.tpa_companies
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS trainings_tenant_isolation ON public.trainings;
CREATE POLICY trainings_tenant_isolation ON public.trainings
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
