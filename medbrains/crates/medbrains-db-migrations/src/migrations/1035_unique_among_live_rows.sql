-- ====================================================================
-- Migration: 1035_unique_among_live_rows.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: 38 unique constraints, each replaced by a partial unique index of the same name
-- ====================================================================
-- A soft-deleted row kept its code. Delete department "CARD" and the code
-- could never be used again: creating it answered "already exists" for a row
-- nobody can see. The same held for every master and link a screen deletes
-- from — roles, locations, services, a learning path's courses, a doctor's
-- schedule for a weekday.
--
-- These keys now hold among live rows only (WHERE deleted_at IS NULL): one
-- live department per code, any number of deleted ones. Chosen narrowly —
-- tables the application actually deletes from, keyed by a code, a name or a
-- pair of references. Numbers issued to people and documents (UHID, invoice,
-- MLC, accession, barcode…) keep their full uniqueness: a number once issued
-- is never issued again, deleted or not. So do users' username and email,
-- and sequences, whose rows are counters and are never deleted.
--
-- Upserts on these keys name the same predicate (ON CONFLICT … WHERE
-- deleted_at IS NULL); boot seeds insert only codes that never existed, so a
-- master an admin deleted stays deleted across restarts.

ALTER TABLE public.bed_types DROP CONSTRAINT bed_types_tenant_id_code_key;
CREATE UNIQUE INDEX bed_types_tenant_id_code_key ON public.bed_types (tenant_id, code) WHERE deleted_at IS NULL;

ALTER TABLE public.billing_packages DROP CONSTRAINT billing_packages_tenant_id_code_key;
CREATE UNIQUE INDEX billing_packages_tenant_id_code_key ON public.billing_packages (tenant_id, code) WHERE deleted_at IS NULL;

ALTER TABLE public.camp_counters DROP CONSTRAINT camp_counters_tenant_camp_source_key;
CREATE UNIQUE INDEX camp_counters_tenant_camp_source_key ON public.camp_counters (tenant_id, camp_id, source_key) WHERE deleted_at IS NULL;

ALTER TABLE public.camp_department_counters DROP CONSTRAINT camp_department_counters_tenant_camp_source_key;
CREATE UNIQUE INDEX camp_department_counters_tenant_camp_source_key ON public.camp_department_counters (tenant_id, camp_id, source_key) WHERE deleted_at IS NULL;

ALTER TABLE public.charge_master DROP CONSTRAINT charge_master_tenant_id_code_key;
CREATE UNIQUE INDEX charge_master_tenant_id_code_key ON public.charge_master (tenant_id, code) WHERE deleted_at IS NULL;

ALTER TABLE public.chronic_programs DROP CONSTRAINT chronic_programs_tenant_id_code_key;
CREATE UNIQUE INDEX chronic_programs_tenant_id_code_key ON public.chronic_programs (tenant_id, code) WHERE deleted_at IS NULL;

ALTER TABLE public.consent_templates DROP CONSTRAINT consent_templates_tenant_id_code_key;
CREATE UNIQUE INDEX consent_templates_tenant_id_code_key ON public.consent_templates (tenant_id, code) WHERE deleted_at IS NULL;

ALTER TABLE public.corporate_enrollments DROP CONSTRAINT corporate_enrollments_tenant_id_corporate_id_patient_id_key;
CREATE UNIQUE INDEX corporate_enrollments_tenant_id_corporate_id_patient_id_key ON public.corporate_enrollments (tenant_id, corporate_id, patient_id) WHERE deleted_at IS NULL;

ALTER TABLE public.dashboards DROP CONSTRAINT dashboards_tenant_id_code_key;
CREATE UNIQUE INDEX dashboards_tenant_id_code_key ON public.dashboards (tenant_id, code) WHERE deleted_at IS NULL;

ALTER TABLE public.departments DROP CONSTRAINT departments_tenant_id_code_key;
CREATE UNIQUE INDEX departments_tenant_id_code_key ON public.departments (tenant_id, code) WHERE deleted_at IS NULL;

ALTER TABLE public.dlt_templates DROP CONSTRAINT dlt_templates_tenant_id_template_id_key;
CREATE UNIQUE INDEX dlt_templates_tenant_id_template_id_key ON public.dlt_templates (tenant_id, template_id) WHERE deleted_at IS NULL;

ALTER TABLE public.doctor_schedule_exceptions DROP CONSTRAINT doctor_schedule_exceptions_tenant_id_doctor_id_exception_da_key;
CREATE UNIQUE INDEX doctor_schedule_exceptions_tenant_id_doctor_id_exception_da_key ON public.doctor_schedule_exceptions (tenant_id, doctor_id, exception_date) WHERE deleted_at IS NULL;

ALTER TABLE public.doctor_schedules DROP CONSTRAINT doctor_schedules_tenant_id_doctor_id_department_id_day_of_w_key;
CREATE UNIQUE INDEX doctor_schedules_tenant_id_doctor_id_department_id_day_of_w_key ON public.doctor_schedules (tenant_id, doctor_id, department_id, day_of_week) WHERE deleted_at IS NULL;

ALTER TABLE public.facilities DROP CONSTRAINT facilities_tenant_id_code_key;
CREATE UNIQUE INDEX facilities_tenant_id_code_key ON public.facilities (tenant_id, code) WHERE deleted_at IS NULL;

ALTER TABLE public.integration_pipelines DROP CONSTRAINT integration_pipelines_tenant_id_code_key;
CREATE UNIQUE INDEX integration_pipelines_tenant_id_code_key ON public.integration_pipelines (tenant_id, code) WHERE deleted_at IS NULL;

ALTER TABLE public.lab_panel_tests DROP CONSTRAINT lab_panel_tests_panel_id_test_id_key;
CREATE UNIQUE INDEX lab_panel_tests_panel_id_test_id_key ON public.lab_panel_tests (panel_id, test_id) WHERE deleted_at IS NULL;

ALTER TABLE public.lab_test_panels DROP CONSTRAINT lab_test_panels_tenant_id_code_key;
CREATE UNIQUE INDEX lab_test_panels_tenant_id_code_key ON public.lab_test_panels (tenant_id, code) WHERE deleted_at IS NULL;

ALTER TABLE public.lms_learning_path_courses DROP CONSTRAINT lms_learning_path_courses_path_id_course_id_key;
CREATE UNIQUE INDEX lms_learning_path_courses_path_id_course_id_key ON public.lms_learning_path_courses (path_id, course_id) WHERE deleted_at IS NULL;

ALTER TABLE public.locations DROP CONSTRAINT locations_tenant_id_code_key;
CREATE UNIQUE INDEX locations_tenant_id_code_key ON public.locations (tenant_id, code) WHERE deleted_at IS NULL;

ALTER TABLE public.master_insurance_providers DROP CONSTRAINT master_insurance_providers_tenant_id_code_key;
CREATE UNIQUE INDEX master_insurance_providers_tenant_id_code_key ON public.master_insurance_providers (tenant_id, code) WHERE deleted_at IS NULL;

ALTER TABLE public.master_occupations DROP CONSTRAINT master_occupations_tenant_id_code_key;
CREATE UNIQUE INDEX master_occupations_tenant_id_code_key ON public.master_occupations (tenant_id, code) WHERE deleted_at IS NULL;

ALTER TABLE public.master_relations DROP CONSTRAINT master_relations_tenant_id_code_key;
CREATE UNIQUE INDEX master_relations_tenant_id_code_key ON public.master_relations (tenant_id, code) WHERE deleted_at IS NULL;

ALTER TABLE public.master_religions DROP CONSTRAINT master_religions_tenant_id_code_key;
CREATE UNIQUE INDEX master_religions_tenant_id_code_key ON public.master_religions (tenant_id, code) WHERE deleted_at IS NULL;

ALTER TABLE public.order_basket_drafts DROP CONSTRAINT order_basket_drafts_tenant_id_encounter_id_owner_user_id_key;
CREATE UNIQUE INDEX order_basket_drafts_tenant_id_encounter_id_owner_user_id_key ON public.order_basket_drafts (tenant_id, encounter_id, owner_user_id) WHERE deleted_at IS NULL;

ALTER TABLE public.patient_addresses DROP CONSTRAINT patient_addresses_tenant_id_patient_id_address_type_key;
CREATE UNIQUE INDEX patient_addresses_tenant_id_patient_id_address_type_key ON public.patient_addresses (tenant_id, patient_id, address_type) WHERE deleted_at IS NULL;

ALTER TABLE public.patient_family_links DROP CONSTRAINT patient_family_links_tenant_id_patient_id_related_patient_i_key;
CREATE UNIQUE INDEX patient_family_links_tenant_id_patient_id_related_patient_i_key ON public.patient_family_links (tenant_id, patient_id, related_patient_id) WHERE deleted_at IS NULL;

ALTER TABLE public.payment_methods DROP CONSTRAINT payment_methods_tenant_id_code_key;
CREATE UNIQUE INDEX payment_methods_tenant_id_code_key ON public.payment_methods (tenant_id, code) WHERE deleted_at IS NULL;

ALTER TABLE public.prescription_templates DROP CONSTRAINT prescription_templates_tenant_id_created_by_name_key;
CREATE UNIQUE INDEX prescription_templates_tenant_id_created_by_name_key ON public.prescription_templates (tenant_id, created_by, name) WHERE deleted_at IS NULL;

ALTER TABLE public.radiology_modalities DROP CONSTRAINT radiology_modalities_tenant_id_code_key;
CREATE UNIQUE INDEX radiology_modalities_tenant_id_code_key ON public.radiology_modalities (tenant_id, code) WHERE deleted_at IS NULL;

ALTER TABLE public.rate_plans DROP CONSTRAINT rate_plans_tenant_id_name_key;
CREATE UNIQUE INDEX rate_plans_tenant_id_name_key ON public.rate_plans (tenant_id, name) WHERE deleted_at IS NULL;

ALTER TABLE public.roles DROP CONSTRAINT roles_tenant_id_code_key;
CREATE UNIQUE INDEX roles_tenant_id_code_key ON public.roles (tenant_id, code) WHERE deleted_at IS NULL;

ALTER TABLE public.scheduling_overbooking_rules DROP CONSTRAINT scheduling_overbooking_rules_tenant_id_doctor_id_department_key;
CREATE UNIQUE INDEX scheduling_overbooking_rules_tenant_id_doctor_id_department_key ON public.scheduling_overbooking_rules (tenant_id, doctor_id, department_id, day_of_week) WHERE deleted_at IS NULL;

ALTER TABLE public.sensitive_patients DROP CONSTRAINT sensitive_patients_tenant_id_patient_id_key;
CREATE UNIQUE INDEX sensitive_patients_tenant_id_patient_id_key ON public.sensitive_patients (tenant_id, patient_id) WHERE deleted_at IS NULL;

ALTER TABLE public.services DROP CONSTRAINT services_tenant_id_code_key;
CREATE UNIQUE INDEX services_tenant_id_code_key ON public.services (tenant_id, code) WHERE deleted_at IS NULL;

ALTER TABLE public.tax_categories DROP CONSTRAINT tax_categories_tenant_id_code_key;
CREATE UNIQUE INDEX tax_categories_tenant_id_code_key ON public.tax_categories (tenant_id, code) WHERE deleted_at IS NULL;

ALTER TABLE public.tpa_rate_cards DROP CONSTRAINT tpa_rate_cards_tenant_id_tpa_name_insurance_provider_key;
CREATE UNIQUE INDEX tpa_rate_cards_tenant_id_tpa_name_insurance_provider_key ON public.tpa_rate_cards (tenant_id, tpa_name, insurance_provider) WHERE deleted_at IS NULL;

ALTER TABLE public.user_facility_assignments DROP CONSTRAINT user_facility_assignments_tenant_id_user_id_facility_id_key;
CREATE UNIQUE INDEX user_facility_assignments_tenant_id_user_id_facility_id_key ON public.user_facility_assignments (tenant_id, user_id, facility_id) WHERE deleted_at IS NULL;

ALTER TABLE public.ward_bed_mappings DROP CONSTRAINT ward_bed_mappings_tenant_id_bed_location_id_key;
CREATE UNIQUE INDEX ward_bed_mappings_tenant_id_bed_location_id_key ON public.ward_bed_mappings (tenant_id, bed_location_id) WHERE deleted_at IS NULL;
