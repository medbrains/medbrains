-- cross-module FK constraints — applied last

--
-- Name: access_alerts access_alerts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_alerts
    ADD CONSTRAINT access_alerts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: access_group_members access_group_members_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_group_members
    ADD CONSTRAINT access_group_members_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: access_groups access_groups_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_groups
    ADD CONSTRAINT access_groups_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: access_log access_log_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_log
    ADD CONSTRAINT access_log_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: access_log access_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_log
    ADD CONSTRAINT access_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: adherence_records adherence_records_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adherence_records
    ADD CONSTRAINT adherence_records_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: adherence_records adherence_records_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adherence_records
    ADD CONSTRAINT adherence_records_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.chronic_enrollments(id);


--
-- Name: adherence_records adherence_records_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adherence_records
    ADD CONSTRAINT adherence_records_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: adherence_records adherence_records_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adherence_records
    ADD CONSTRAINT adherence_records_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: adherence_records adherence_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adherence_records
    ADD CONSTRAINT adherence_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: admission_attenders admission_attenders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_attenders
    ADD CONSTRAINT admission_attenders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: admission_checklists admission_checklists_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_checklists
    ADD CONSTRAINT admission_checklists_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id);


--
-- Name: admission_checklists admission_checklists_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_checklists
    ADD CONSTRAINT admission_checklists_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: admissions admissions_admitting_doctor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_admitting_doctor_fkey FOREIGN KEY (admitting_doctor) REFERENCES public.users(id);


--
-- Name: admissions admissions_bed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_bed_id_fkey FOREIGN KEY (bed_id) REFERENCES public.locations(id);


--
-- Name: admissions admissions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: admissions admissions_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: admissions admissions_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: admissions admissions_primary_nurse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_primary_nurse_id_fkey FOREIGN KEY (primary_nurse_id) REFERENCES public.users(id);


--
-- Name: admissions admissions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: adr_reports adr_reports_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adr_reports
    ADD CONSTRAINT adr_reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: adr_reports adr_reports_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adr_reports
    ADD CONSTRAINT adr_reports_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: adr_reports adr_reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adr_reports
    ADD CONSTRAINT adr_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users(id);


--
-- Name: adr_reports adr_reports_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adr_reports
    ADD CONSTRAINT adr_reports_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: adr_reports adr_reports_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adr_reports
    ADD CONSTRAINT adr_reports_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: advance_adjustments advance_adjustments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.advance_adjustments
    ADD CONSTRAINT advance_adjustments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: aebas_department_attendance aebas_department_attendance_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aebas_department_attendance
    ADD CONSTRAINT aebas_department_attendance_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: aebas_period_summary aebas_period_summary_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aebas_period_summary
    ADD CONSTRAINT aebas_period_summary_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: age_estimations age_estimations_examining_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.age_estimations
    ADD CONSTRAINT age_estimations_examining_doctor_id_fkey FOREIGN KEY (examining_doctor_id) REFERENCES public.users(id);


--
-- Name: age_estimations age_estimations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.age_estimations
    ADD CONSTRAINT age_estimations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ambulance_drivers ambulance_drivers_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_drivers
    ADD CONSTRAINT ambulance_drivers_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: ambulance_drivers ambulance_drivers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_drivers
    ADD CONSTRAINT ambulance_drivers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ambulance_maintenance ambulance_maintenance_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_maintenance
    ADD CONSTRAINT ambulance_maintenance_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: ambulance_maintenance ambulance_maintenance_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_maintenance
    ADD CONSTRAINT ambulance_maintenance_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: ambulance_maintenance ambulance_maintenance_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_maintenance
    ADD CONSTRAINT ambulance_maintenance_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ambulance_trip_logs ambulance_trip_logs_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_trip_logs
    ADD CONSTRAINT ambulance_trip_logs_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: ambulance_trip_logs ambulance_trip_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_trip_logs
    ADD CONSTRAINT ambulance_trip_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ambulance_trips ambulance_trips_dispatched_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_trips
    ADD CONSTRAINT ambulance_trips_dispatched_by_fkey FOREIGN KEY (dispatched_by) REFERENCES public.users(id);


--
-- Name: ambulance_trips ambulance_trips_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_trips
    ADD CONSTRAINT ambulance_trips_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.employees(id);


--
-- Name: ambulance_trips ambulance_trips_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_trips
    ADD CONSTRAINT ambulance_trips_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: ambulance_trips ambulance_trips_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_trips
    ADD CONSTRAINT ambulance_trips_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: ambulance_trips ambulance_trips_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_trips
    ADD CONSTRAINT ambulance_trips_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ambulances ambulances_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulances
    ADD CONSTRAINT ambulances_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: ambulances ambulances_current_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulances
    ADD CONSTRAINT ambulances_current_driver_id_fkey FOREIGN KEY (current_driver_id) REFERENCES public.employees(id);


--
-- Name: ambulances ambulances_default_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulances
    ADD CONSTRAINT ambulances_default_driver_id_fkey FOREIGN KEY (default_driver_id) REFERENCES public.employees(id);


--
-- Name: ambulances ambulances_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulances
    ADD CONSTRAINT ambulances_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: anc_visits anc_visits_examined_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anc_visits
    ADD CONSTRAINT anc_visits_examined_by_fkey FOREIGN KEY (examined_by) REFERENCES public.users(id);


--
-- Name: anc_visits anc_visits_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anc_visits
    ADD CONSTRAINT anc_visits_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: antibiotic_consumption_records antibiotic_consumption_records_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.antibiotic_consumption_records
    ADD CONSTRAINT antibiotic_consumption_records_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: antibiotic_consumption_records antibiotic_consumption_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.antibiotic_consumption_records
    ADD CONSTRAINT antibiotic_consumption_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: antibiotic_stewardship_requests antibiotic_stewardship_requests_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.antibiotic_stewardship_requests
    ADD CONSTRAINT antibiotic_stewardship_requests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: antibiotic_stewardship_requests antibiotic_stewardship_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.antibiotic_stewardship_requests
    ADD CONSTRAINT antibiotic_stewardship_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: antibiotic_stewardship_requests antibiotic_stewardship_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.antibiotic_stewardship_requests
    ADD CONSTRAINT antibiotic_stewardship_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: antibiotic_stewardship_requests antibiotic_stewardship_requests_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.antibiotic_stewardship_requests
    ADD CONSTRAINT antibiotic_stewardship_requests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: appointments appointments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: appointments appointments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: appointments appointments_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: appointments appointments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: appointments appointments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: appraisals appraisals_appraiser_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisals
    ADD CONSTRAINT appraisals_appraiser_id_fkey FOREIGN KEY (appraiser_id) REFERENCES public.users(id);


--
-- Name: appraisals appraisals_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisals
    ADD CONSTRAINT appraisals_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: attendance_records attendance_records_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: attendance_records attendance_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: audiology_tests audiology_tests_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audiology_tests
    ADD CONSTRAINT audiology_tests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: audiology_tests audiology_tests_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audiology_tests
    ADD CONSTRAINT audiology_tests_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: audiology_tests audiology_tests_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audiology_tests
    ADD CONSTRAINT audiology_tests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: audit_chain_verifications audit_chain_verifications_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_chain_verifications
    ADD CONSTRAINT audit_chain_verifications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: audit_log audit_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: audit_log audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: bad_debt_write_offs bad_debt_write_offs_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bad_debt_write_offs
    ADD CONSTRAINT bad_debt_write_offs_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: bad_debt_write_offs bad_debt_write_offs_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bad_debt_write_offs
    ADD CONSTRAINT bad_debt_write_offs_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: bad_debt_write_offs bad_debt_write_offs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bad_debt_write_offs
    ADD CONSTRAINT bad_debt_write_offs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bank_transactions bank_transactions_matched_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_matched_by_fkey FOREIGN KEY (matched_by) REFERENCES public.users(id);


--
-- Name: bank_transactions bank_transactions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: batch_stock batch_stock_grn_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_stock
    ADD CONSTRAINT batch_stock_grn_id_fkey FOREIGN KEY (grn_id) REFERENCES public.goods_receipt_notes(id);


--
-- Name: batch_stock batch_stock_pharmacy_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_stock
    ADD CONSTRAINT batch_stock_pharmacy_batch_id_fkey FOREIGN KEY (pharmacy_batch_id) REFERENCES public.pharmacy_batches(id);


--
-- Name: batch_stock batch_stock_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_stock
    ADD CONSTRAINT batch_stock_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: batch_stock batch_stock_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_stock
    ADD CONSTRAINT batch_stock_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: bb_billing_items bb_billing_items_billed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_billing_items
    ADD CONSTRAINT bb_billing_items_billed_by_fkey FOREIGN KEY (billed_by) REFERENCES public.users(id);


--
-- Name: bb_billing_items bb_billing_items_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_billing_items
    ADD CONSTRAINT bb_billing_items_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: bb_billing_items bb_billing_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_billing_items
    ADD CONSTRAINT bb_billing_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bb_blood_returns bb_blood_returns_inspected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_blood_returns
    ADD CONSTRAINT bb_blood_returns_inspected_by_fkey FOREIGN KEY (inspected_by) REFERENCES public.users(id);


--
-- Name: bb_blood_returns bb_blood_returns_returned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_blood_returns
    ADD CONSTRAINT bb_blood_returns_returned_by_fkey FOREIGN KEY (returned_by) REFERENCES public.users(id);


--
-- Name: bb_blood_returns bb_blood_returns_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_blood_returns
    ADD CONSTRAINT bb_blood_returns_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bb_cold_chain_devices bb_cold_chain_devices_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_cold_chain_devices
    ADD CONSTRAINT bb_cold_chain_devices_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bb_cold_chain_readings bb_cold_chain_readings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_cold_chain_readings
    ADD CONSTRAINT bb_cold_chain_readings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bb_lookback_events bb_lookback_events_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_lookback_events
    ADD CONSTRAINT bb_lookback_events_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.users(id);


--
-- Name: bb_lookback_events bb_lookback_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_lookback_events
    ADD CONSTRAINT bb_lookback_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: bb_lookback_events bb_lookback_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_lookback_events
    ADD CONSTRAINT bb_lookback_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bb_msbos_guidelines bb_msbos_guidelines_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_msbos_guidelines
    ADD CONSTRAINT bb_msbos_guidelines_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bb_recruitment_campaigns bb_recruitment_campaigns_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_recruitment_campaigns
    ADD CONSTRAINT bb_recruitment_campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: bb_recruitment_campaigns bb_recruitment_campaigns_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_recruitment_campaigns
    ADD CONSTRAINT bb_recruitment_campaigns_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bed_reservations bed_reservations_bed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_reservations
    ADD CONSTRAINT bed_reservations_bed_id_fkey FOREIGN KEY (bed_id) REFERENCES public.locations(id);


--
-- Name: bed_reservations bed_reservations_cancelled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_reservations
    ADD CONSTRAINT bed_reservations_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.users(id);


--
-- Name: bed_reservations bed_reservations_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_reservations
    ADD CONSTRAINT bed_reservations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: bed_reservations bed_reservations_reserved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_reservations
    ADD CONSTRAINT bed_reservations_reserved_by_fkey FOREIGN KEY (reserved_by) REFERENCES public.users(id);


--
-- Name: bed_reservations bed_reservations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_reservations
    ADD CONSTRAINT bed_reservations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bed_states bed_states_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_states
    ADD CONSTRAINT bed_states_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: bed_states bed_states_ward_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_states
    ADD CONSTRAINT bed_states_ward_id_fkey FOREIGN KEY (ward_id) REFERENCES public.wards(id);


--
-- Name: bed_turnaround_log bed_turnaround_log_bed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_turnaround_log
    ADD CONSTRAINT bed_turnaround_log_bed_id_fkey FOREIGN KEY (bed_id) REFERENCES public.locations(id);


--
-- Name: bed_turnaround_log bed_turnaround_log_cleaned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_turnaround_log
    ADD CONSTRAINT bed_turnaround_log_cleaned_by_fkey FOREIGN KEY (cleaned_by) REFERENCES public.users(id);


--
-- Name: bed_turnaround_log bed_turnaround_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_turnaround_log
    ADD CONSTRAINT bed_turnaround_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bed_types bed_types_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_types
    ADD CONSTRAINT bed_types_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: beds beds_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beds
    ADD CONSTRAINT beds_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bedside_education_videos bedside_education_videos_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bedside_education_videos
    ADD CONSTRAINT bedside_education_videos_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: bedside_education_videos bedside_education_videos_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bedside_education_videos
    ADD CONSTRAINT bedside_education_videos_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bedside_education_views bedside_education_views_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bedside_education_views
    ADD CONSTRAINT bedside_education_views_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: bedside_education_views bedside_education_views_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bedside_education_views
    ADD CONSTRAINT bedside_education_views_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bedside_nurse_requests bedside_nurse_requests_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bedside_nurse_requests
    ADD CONSTRAINT bedside_nurse_requests_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);


--
-- Name: bedside_nurse_requests bedside_nurse_requests_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bedside_nurse_requests
    ADD CONSTRAINT bedside_nurse_requests_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id);


--
-- Name: bedside_nurse_requests bedside_nurse_requests_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bedside_nurse_requests
    ADD CONSTRAINT bedside_nurse_requests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: bedside_nurse_requests bedside_nurse_requests_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bedside_nurse_requests
    ADD CONSTRAINT bedside_nurse_requests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bedside_realtime_feedback bedside_realtime_feedback_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bedside_realtime_feedback
    ADD CONSTRAINT bedside_realtime_feedback_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: bedside_realtime_feedback bedside_realtime_feedback_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bedside_realtime_feedback
    ADD CONSTRAINT bedside_realtime_feedback_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bedside_sessions bedside_sessions_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bedside_sessions
    ADD CONSTRAINT bedside_sessions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: bedside_sessions bedside_sessions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bedside_sessions
    ADD CONSTRAINT bedside_sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: billing_audit_log billing_audit_log_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_audit_log
    ADD CONSTRAINT billing_audit_log_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: billing_audit_log billing_audit_log_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_audit_log
    ADD CONSTRAINT billing_audit_log_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: billing_audit_log billing_audit_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_audit_log
    ADD CONSTRAINT billing_audit_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: billing_concessions billing_concessions_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_concessions
    ADD CONSTRAINT billing_concessions_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: billing_concessions billing_concessions_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_concessions
    ADD CONSTRAINT billing_concessions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: billing_concessions billing_concessions_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_concessions
    ADD CONSTRAINT billing_concessions_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: billing_concessions billing_concessions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_concessions
    ADD CONSTRAINT billing_concessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: billing_package_items billing_package_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_package_items
    ADD CONSTRAINT billing_package_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: billing_packages billing_packages_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_packages
    ADD CONSTRAINT billing_packages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: biowaste_records biowaste_records_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.biowaste_records
    ADD CONSTRAINT biowaste_records_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: biowaste_records biowaste_records_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.biowaste_records
    ADD CONSTRAINT biowaste_records_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: biowaste_records biowaste_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.biowaste_records
    ADD CONSTRAINT biowaste_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: blood_components blood_components_issued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blood_components
    ADD CONSTRAINT blood_components_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.users(id);


--
-- Name: blood_components blood_components_issued_to_patient_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blood_components
    ADD CONSTRAINT blood_components_issued_to_patient_fkey FOREIGN KEY (issued_to_patient) REFERENCES public.patients(id);


--
-- Name: blood_components blood_components_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blood_components
    ADD CONSTRAINT blood_components_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: blood_donations blood_donations_collected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blood_donations
    ADD CONSTRAINT blood_donations_collected_by_fkey FOREIGN KEY (collected_by) REFERENCES public.users(id);


--
-- Name: blood_donations blood_donations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blood_donations
    ADD CONSTRAINT blood_donations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: blood_donors blood_donors_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blood_donors
    ADD CONSTRAINT blood_donors_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bme_breakdowns bme_breakdowns_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_breakdowns
    ADD CONSTRAINT bme_breakdowns_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);


--
-- Name: bme_breakdowns bme_breakdowns_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_breakdowns
    ADD CONSTRAINT bme_breakdowns_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: bme_breakdowns bme_breakdowns_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_breakdowns
    ADD CONSTRAINT bme_breakdowns_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id);


--
-- Name: bme_breakdowns bme_breakdowns_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_breakdowns
    ADD CONSTRAINT bme_breakdowns_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: bme_breakdowns bme_breakdowns_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_breakdowns
    ADD CONSTRAINT bme_breakdowns_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bme_breakdowns bme_breakdowns_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_breakdowns
    ADD CONSTRAINT bme_breakdowns_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: bme_calibrations bme_calibrations_calibration_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_calibrations
    ADD CONSTRAINT bme_calibrations_calibration_vendor_id_fkey FOREIGN KEY (calibration_vendor_id) REFERENCES public.vendors(id);


--
-- Name: bme_calibrations bme_calibrations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_calibrations
    ADD CONSTRAINT bme_calibrations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: bme_calibrations bme_calibrations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_calibrations
    ADD CONSTRAINT bme_calibrations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bme_contracts bme_contracts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_contracts
    ADD CONSTRAINT bme_contracts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: bme_contracts bme_contracts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_contracts
    ADD CONSTRAINT bme_contracts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bme_contracts bme_contracts_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_contracts
    ADD CONSTRAINT bme_contracts_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: bme_equipment bme_equipment_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_equipment
    ADD CONSTRAINT bme_equipment_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: bme_equipment bme_equipment_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_equipment
    ADD CONSTRAINT bme_equipment_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: bme_equipment bme_equipment_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_equipment
    ADD CONSTRAINT bme_equipment_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: bme_equipment bme_equipment_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_equipment
    ADD CONSTRAINT bme_equipment_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bme_equipment bme_equipment_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_equipment
    ADD CONSTRAINT bme_equipment_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: bme_pm_schedules bme_pm_schedules_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_pm_schedules
    ADD CONSTRAINT bme_pm_schedules_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: bme_pm_schedules bme_pm_schedules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_pm_schedules
    ADD CONSTRAINT bme_pm_schedules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bme_vendor_evaluations bme_vendor_evaluations_evaluated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_vendor_evaluations
    ADD CONSTRAINT bme_vendor_evaluations_evaluated_by_fkey FOREIGN KEY (evaluated_by) REFERENCES public.users(id);


--
-- Name: bme_vendor_evaluations bme_vendor_evaluations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_vendor_evaluations
    ADD CONSTRAINT bme_vendor_evaluations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bme_vendor_evaluations bme_vendor_evaluations_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_vendor_evaluations
    ADD CONSTRAINT bme_vendor_evaluations_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: bme_work_orders bme_work_orders_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_work_orders
    ADD CONSTRAINT bme_work_orders_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: bme_work_orders bme_work_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_work_orders
    ADD CONSTRAINT bme_work_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: bme_work_orders bme_work_orders_supervisor_sign_off_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_work_orders
    ADD CONSTRAINT bme_work_orders_supervisor_sign_off_by_fkey FOREIGN KEY (supervisor_sign_off_by) REFERENCES public.users(id);


--
-- Name: bme_work_orders bme_work_orders_technician_sign_off_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_work_orders
    ADD CONSTRAINT bme_work_orders_technician_sign_off_by_fkey FOREIGN KEY (technician_sign_off_by) REFERENCES public.users(id);


--
-- Name: bme_work_orders bme_work_orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_work_orders
    ADD CONSTRAINT bme_work_orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: brand_entities brand_entities_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_entities
    ADD CONSTRAINT brand_entities_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: break_glass_events break_glass_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.break_glass_events
    ADD CONSTRAINT break_glass_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bridge_agents bridge_agents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bridge_agents
    ADD CONSTRAINT bridge_agents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: calibrations calibrations_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calibrations
    ADD CONSTRAINT calibrations_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: calibrations calibrations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calibrations
    ADD CONSTRAINT calibrations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: camp_billing_records camp_billing_records_billed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_billing_records
    ADD CONSTRAINT camp_billing_records_billed_by_fkey FOREIGN KEY (billed_by) REFERENCES public.users(id);


--
-- Name: camp_billing_records camp_billing_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_billing_records
    ADD CONSTRAINT camp_billing_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: camp_followups camp_followups_converted_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_followups
    ADD CONSTRAINT camp_followups_converted_department_id_fkey FOREIGN KEY (converted_department_id) REFERENCES public.departments(id);


--
-- Name: camp_followups camp_followups_converted_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_followups
    ADD CONSTRAINT camp_followups_converted_patient_id_fkey FOREIGN KEY (converted_patient_id) REFERENCES public.patients(id);


--
-- Name: camp_followups camp_followups_followed_up_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_followups
    ADD CONSTRAINT camp_followups_followed_up_by_fkey FOREIGN KEY (followed_up_by) REFERENCES public.users(id);


--
-- Name: camp_followups camp_followups_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_followups
    ADD CONSTRAINT camp_followups_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: camp_lab_samples camp_lab_samples_collected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_lab_samples
    ADD CONSTRAINT camp_lab_samples_collected_by_fkey FOREIGN KEY (collected_by) REFERENCES public.users(id);


--
-- Name: camp_lab_samples camp_lab_samples_lab_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_lab_samples
    ADD CONSTRAINT camp_lab_samples_lab_order_id_fkey FOREIGN KEY (lab_order_id) REFERENCES public.lab_orders(id);


--
-- Name: camp_lab_samples camp_lab_samples_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_lab_samples
    ADD CONSTRAINT camp_lab_samples_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: camp_registrations camp_registrations_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_registrations
    ADD CONSTRAINT camp_registrations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: camp_registrations camp_registrations_registered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_registrations
    ADD CONSTRAINT camp_registrations_registered_by_fkey FOREIGN KEY (registered_by) REFERENCES public.users(id);


--
-- Name: camp_registrations camp_registrations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_registrations
    ADD CONSTRAINT camp_registrations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: camp_screenings camp_screenings_screened_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_screenings
    ADD CONSTRAINT camp_screenings_screened_by_fkey FOREIGN KEY (screened_by) REFERENCES public.users(id);


--
-- Name: camp_screenings camp_screenings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_screenings
    ADD CONSTRAINT camp_screenings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: camp_team_members camp_team_members_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_team_members
    ADD CONSTRAINT camp_team_members_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: camp_team_members camp_team_members_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_team_members
    ADD CONSTRAINT camp_team_members_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: camps camps_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camps
    ADD CONSTRAINT camps_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: camps camps_coordinator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camps
    ADD CONSTRAINT camps_coordinator_id_fkey FOREIGN KEY (coordinator_id) REFERENCES public.employees(id);


--
-- Name: camps camps_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camps
    ADD CONSTRAINT camps_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: camps camps_organizing_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camps
    ADD CONSTRAINT camps_organizing_department_id_fkey FOREIGN KEY (organizing_department_id) REFERENCES public.departments(id);


--
-- Name: camps camps_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camps
    ADD CONSTRAINT camps_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: case_assignments case_assignments_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignments
    ADD CONSTRAINT case_assignments_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: case_assignments case_assignments_case_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignments
    ADD CONSTRAINT case_assignments_case_manager_id_fkey FOREIGN KEY (case_manager_id) REFERENCES public.users(id);


--
-- Name: case_assignments case_assignments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignments
    ADD CONSTRAINT case_assignments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: case_assignments case_assignments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignments
    ADD CONSTRAINT case_assignments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: case_referrals case_referrals_referred_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_referrals
    ADD CONSTRAINT case_referrals_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES public.users(id);


--
-- Name: case_referrals case_referrals_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_referrals
    ADD CONSTRAINT case_referrals_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cath_devices cath_devices_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cath_devices
    ADD CONSTRAINT cath_devices_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cath_hemodynamics cath_hemodynamics_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cath_hemodynamics
    ADD CONSTRAINT cath_hemodynamics_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cath_post_monitoring cath_post_monitoring_monitored_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cath_post_monitoring
    ADD CONSTRAINT cath_post_monitoring_monitored_by_fkey FOREIGN KEY (monitored_by) REFERENCES public.users(id);


--
-- Name: cath_post_monitoring cath_post_monitoring_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cath_post_monitoring
    ADD CONSTRAINT cath_post_monitoring_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cath_procedures cath_procedures_operator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cath_procedures
    ADD CONSTRAINT cath_procedures_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES public.users(id);


--
-- Name: cath_procedures cath_procedures_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cath_procedures
    ADD CONSTRAINT cath_procedures_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: cath_procedures cath_procedures_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cath_procedures
    ADD CONSTRAINT cath_procedures_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cath_stemi_timeline cath_stemi_timeline_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cath_stemi_timeline
    ADD CONSTRAINT cath_stemi_timeline_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: cath_stemi_timeline cath_stemi_timeline_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cath_stemi_timeline
    ADD CONSTRAINT cath_stemi_timeline_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: charge_master charge_master_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.charge_master
    ADD CONSTRAINT charge_master_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: chemo_protocols chemo_protocols_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chemo_protocols
    ADD CONSTRAINT chemo_protocols_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: chemo_protocols chemo_protocols_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chemo_protocols
    ADD CONSTRAINT chemo_protocols_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: chemo_protocols chemo_protocols_treating_oncologist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chemo_protocols
    ADD CONSTRAINT chemo_protocols_treating_oncologist_id_fkey FOREIGN KEY (treating_oncologist_id) REFERENCES public.users(id);


--
-- Name: chief_complaint_masters chief_complaint_masters_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chief_complaint_masters
    ADD CONSTRAINT chief_complaint_masters_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: chronic_enrollments chronic_enrollments_diagnosis_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chronic_enrollments
    ADD CONSTRAINT chronic_enrollments_diagnosis_id_fkey FOREIGN KEY (diagnosis_id) REFERENCES public.diagnoses(id);


--
-- Name: chronic_enrollments chronic_enrollments_enrolled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chronic_enrollments
    ADD CONSTRAINT chronic_enrollments_enrolled_by_fkey FOREIGN KEY (enrolled_by) REFERENCES public.users(id);


--
-- Name: chronic_enrollments chronic_enrollments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chronic_enrollments
    ADD CONSTRAINT chronic_enrollments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: chronic_enrollments chronic_enrollments_primary_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chronic_enrollments
    ADD CONSTRAINT chronic_enrollments_primary_doctor_id_fkey FOREIGN KEY (primary_doctor_id) REFERENCES public.users(id);


--
-- Name: chronic_enrollments chronic_enrollments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chronic_enrollments
    ADD CONSTRAINT chronic_enrollments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: chronic_programs chronic_programs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chronic_programs
    ADD CONSTRAINT chronic_programs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: chronic_programs chronic_programs_protocol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chronic_programs
    ADD CONSTRAINT chronic_programs_protocol_id_fkey FOREIGN KEY (protocol_id) REFERENCES public.clinical_protocols(id);


--
-- Name: chronic_programs chronic_programs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chronic_programs
    ADD CONSTRAINT chronic_programs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cleaning_schedules cleaning_schedules_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_schedules
    ADD CONSTRAINT cleaning_schedules_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: cleaning_schedules cleaning_schedules_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_schedules
    ADD CONSTRAINT cleaning_schedules_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: cleaning_schedules cleaning_schedules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_schedules
    ADD CONSTRAINT cleaning_schedules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cleaning_tasks cleaning_tasks_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_tasks
    ADD CONSTRAINT cleaning_tasks_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: cleaning_tasks cleaning_tasks_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_tasks
    ADD CONSTRAINT cleaning_tasks_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: cleaning_tasks cleaning_tasks_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_tasks
    ADD CONSTRAINT cleaning_tasks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cleaning_tasks cleaning_tasks_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_tasks
    ADD CONSTRAINT cleaning_tasks_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: clinical_protocols clinical_protocols_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_protocols
    ADD CONSTRAINT clinical_protocols_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: clinical_protocols clinical_protocols_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_protocols
    ADD CONSTRAINT clinical_protocols_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: clinical_protocols clinical_protocols_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_protocols
    ADD CONSTRAINT clinical_protocols_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cms_authors cms_authors_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_authors
    ADD CONSTRAINT cms_authors_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cms_authors cms_authors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_authors
    ADD CONSTRAINT cms_authors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: cms_categories cms_categories_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_categories
    ADD CONSTRAINT cms_categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cms_media cms_media_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_media
    ADD CONSTRAINT cms_media_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cms_media cms_media_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_media
    ADD CONSTRAINT cms_media_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: cms_menus cms_menus_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_menus
    ADD CONSTRAINT cms_menus_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cms_pages cms_pages_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_pages
    ADD CONSTRAINT cms_pages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cms_post_revisions cms_post_revisions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_post_revisions
    ADD CONSTRAINT cms_post_revisions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: cms_posts cms_posts_medical_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_posts
    ADD CONSTRAINT cms_posts_medical_reviewed_by_fkey FOREIGN KEY (medical_reviewed_by) REFERENCES public.users(id);


--
-- Name: cms_posts cms_posts_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_posts
    ADD CONSTRAINT cms_posts_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: cms_posts cms_posts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_posts
    ADD CONSTRAINT cms_posts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cms_settings cms_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_settings
    ADD CONSTRAINT cms_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cms_subscribers cms_subscribers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_subscribers
    ADD CONSTRAINT cms_subscribers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cms_tags cms_tags_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_tags
    ADD CONSTRAINT cms_tags_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: co_signature_requests co_signature_requests_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.co_signature_requests
    ADD CONSTRAINT co_signature_requests_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id);


--
-- Name: co_signature_requests co_signature_requests_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.co_signature_requests
    ADD CONSTRAINT co_signature_requests_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: co_signature_requests co_signature_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.co_signature_requests
    ADD CONSTRAINT co_signature_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: co_signature_requests co_signature_requests_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.co_signature_requests
    ADD CONSTRAINT co_signature_requests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: code_blue_events code_blue_events_leader_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.code_blue_events
    ADD CONSTRAINT code_blue_events_leader_user_id_fkey FOREIGN KEY (leader_user_id) REFERENCES public.users(id);


--
-- Name: code_blue_events code_blue_events_recorder_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.code_blue_events
    ADD CONSTRAINT code_blue_events_recorder_user_id_fkey FOREIGN KEY (recorder_user_id) REFERENCES public.users(id);


--
-- Name: code_blue_events code_blue_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.code_blue_events
    ADD CONSTRAINT code_blue_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: comm_clinical_messages comm_clinical_messages_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_clinical_messages
    ADD CONSTRAINT comm_clinical_messages_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);


--
-- Name: comm_clinical_messages comm_clinical_messages_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_clinical_messages
    ADD CONSTRAINT comm_clinical_messages_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: comm_clinical_messages comm_clinical_messages_recipient_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_clinical_messages
    ADD CONSTRAINT comm_clinical_messages_recipient_department_id_fkey FOREIGN KEY (recipient_department_id) REFERENCES public.departments(id);


--
-- Name: comm_clinical_messages comm_clinical_messages_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_clinical_messages
    ADD CONSTRAINT comm_clinical_messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id);


--
-- Name: comm_clinical_messages comm_clinical_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_clinical_messages
    ADD CONSTRAINT comm_clinical_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id);


--
-- Name: comm_clinical_messages comm_clinical_messages_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_clinical_messages
    ADD CONSTRAINT comm_clinical_messages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: comm_complaints comm_complaints_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_complaints
    ADD CONSTRAINT comm_complaints_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: comm_complaints comm_complaints_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_complaints
    ADD CONSTRAINT comm_complaints_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.users(id);


--
-- Name: comm_complaints comm_complaints_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_complaints
    ADD CONSTRAINT comm_complaints_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: comm_complaints comm_complaints_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_complaints
    ADD CONSTRAINT comm_complaints_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: comm_complaints comm_complaints_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_complaints
    ADD CONSTRAINT comm_complaints_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: comm_complaints comm_complaints_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_complaints
    ADD CONSTRAINT comm_complaints_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: comm_complaints comm_complaints_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_complaints
    ADD CONSTRAINT comm_complaints_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: comm_critical_alerts comm_critical_alerts_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_critical_alerts
    ADD CONSTRAINT comm_critical_alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);


--
-- Name: comm_critical_alerts comm_critical_alerts_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_critical_alerts
    ADD CONSTRAINT comm_critical_alerts_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: comm_critical_alerts comm_critical_alerts_escalated_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_critical_alerts
    ADD CONSTRAINT comm_critical_alerts_escalated_to_fkey FOREIGN KEY (escalated_to) REFERENCES public.users(id);


--
-- Name: comm_critical_alerts comm_critical_alerts_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_critical_alerts
    ADD CONSTRAINT comm_critical_alerts_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: comm_critical_alerts comm_critical_alerts_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_critical_alerts
    ADD CONSTRAINT comm_critical_alerts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: comm_critical_alerts comm_critical_alerts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_critical_alerts
    ADD CONSTRAINT comm_critical_alerts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: comm_escalation_rules comm_escalation_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_escalation_rules
    ADD CONSTRAINT comm_escalation_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: comm_escalation_rules comm_escalation_rules_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_escalation_rules
    ADD CONSTRAINT comm_escalation_rules_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: comm_escalation_rules comm_escalation_rules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_escalation_rules
    ADD CONSTRAINT comm_escalation_rules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: comm_feedback_surveys comm_feedback_surveys_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_feedback_surveys
    ADD CONSTRAINT comm_feedback_surveys_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: comm_feedback_surveys comm_feedback_surveys_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_feedback_surveys
    ADD CONSTRAINT comm_feedback_surveys_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: comm_feedback_surveys comm_feedback_surveys_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_feedback_surveys
    ADD CONSTRAINT comm_feedback_surveys_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: comm_feedback_surveys comm_feedback_surveys_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_feedback_surveys
    ADD CONSTRAINT comm_feedback_surveys_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: comm_messages comm_messages_sent_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_messages
    ADD CONSTRAINT comm_messages_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES public.users(id);


--
-- Name: comm_messages comm_messages_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_messages
    ADD CONSTRAINT comm_messages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: comm_templates comm_templates_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_templates
    ADD CONSTRAINT comm_templates_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: comm_templates comm_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_templates
    ADD CONSTRAINT comm_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: comm_templates comm_templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_templates
    ADD CONSTRAINT comm_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: compliance_calendar compliance_calendar_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_calendar
    ADD CONSTRAINT compliance_calendar_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: compliance_calendar compliance_calendar_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_calendar
    ADD CONSTRAINT compliance_calendar_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id);


--
-- Name: compliance_calendar compliance_calendar_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_calendar
    ADD CONSTRAINT compliance_calendar_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: compliance_calendar compliance_calendar_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_calendar
    ADD CONSTRAINT compliance_calendar_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: compliance_calendar compliance_calendar_regulatory_body_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_calendar
    ADD CONSTRAINT compliance_calendar_regulatory_body_id_fkey FOREIGN KEY (regulatory_body_id) REFERENCES public.regulatory_bodies(id);


--
-- Name: compliance_calendar compliance_calendar_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_calendar
    ADD CONSTRAINT compliance_calendar_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: compliance_checklist_items compliance_checklist_items_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_checklist_items
    ADD CONSTRAINT compliance_checklist_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: compliance_checklist_items compliance_checklist_items_responsible_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_checklist_items
    ADD CONSTRAINT compliance_checklist_items_responsible_user_id_fkey FOREIGN KEY (responsible_user_id) REFERENCES public.users(id);


--
-- Name: compliance_checklist_items compliance_checklist_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_checklist_items
    ADD CONSTRAINT compliance_checklist_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: compliance_checklist_items compliance_checklist_items_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_checklist_items
    ADD CONSTRAINT compliance_checklist_items_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: compliance_checklists compliance_checklists_assessed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_checklists
    ADD CONSTRAINT compliance_checklists_assessed_by_fkey FOREIGN KEY (assessed_by) REFERENCES public.users(id);


--
-- Name: compliance_checklists compliance_checklists_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_checklists
    ADD CONSTRAINT compliance_checklists_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: compliance_checklists compliance_checklists_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_checklists
    ADD CONSTRAINT compliance_checklists_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: compliance_checklists compliance_checklists_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_checklists
    ADD CONSTRAINT compliance_checklists_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: compliance_checklists compliance_checklists_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_checklists
    ADD CONSTRAINT compliance_checklists_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: compliance_requirements compliance_requirements_assessed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_requirements
    ADD CONSTRAINT compliance_requirements_assessed_by_fkey FOREIGN KEY (assessed_by) REFERENCES public.users(id);


--
-- Name: compliance_requirements compliance_requirements_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_requirements
    ADD CONSTRAINT compliance_requirements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: component_issues component_issues_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_issues
    ADD CONSTRAINT component_issues_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: connectors connectors_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connectors
    ADD CONSTRAINT connectors_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: connectors connectors_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connectors
    ADD CONSTRAINT connectors_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: consent_audit_log consent_audit_log_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_audit_log
    ADD CONSTRAINT consent_audit_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: consent_audit_log consent_audit_log_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_audit_log
    ADD CONSTRAINT consent_audit_log_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: consent_audit_log consent_audit_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_audit_log
    ADD CONSTRAINT consent_audit_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: consent_records consent_records_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: consent_records consent_records_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.ot_bookings(id);


--
-- Name: consent_records consent_records_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: consent_records consent_records_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: consent_records consent_records_obtained_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_obtained_by_fkey FOREIGN KEY (obtained_by) REFERENCES public.users(id);


--
-- Name: consent_records consent_records_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: consent_records consent_records_revoked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES public.users(id);


--
-- Name: consent_records consent_records_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.document_templates(id);


--
-- Name: consent_records consent_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: consent_signature_metadata consent_signature_metadata_captured_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_signature_metadata
    ADD CONSTRAINT consent_signature_metadata_captured_by_fkey FOREIGN KEY (captured_by) REFERENCES public.users(id);


--
-- Name: consent_signature_metadata consent_signature_metadata_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_signature_metadata
    ADD CONSTRAINT consent_signature_metadata_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: consent_templates consent_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_templates
    ADD CONSTRAINT consent_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: consent_templates consent_templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_templates
    ADD CONSTRAINT consent_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: consultation_templates consultation_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultation_templates
    ADD CONSTRAINT consultation_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: consultation_templates consultation_templates_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultation_templates
    ADD CONSTRAINT consultation_templates_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: consultation_templates consultation_templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultation_templates
    ADD CONSTRAINT consultation_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: consultations consultations_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: consultations consultations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: corporate_clients corporate_clients_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.corporate_clients
    ADD CONSTRAINT corporate_clients_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: corporate_enrollments corporate_enrollments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.corporate_enrollments
    ADD CONSTRAINT corporate_enrollments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: corporate_enrollments corporate_enrollments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.corporate_enrollments
    ADD CONSTRAINT corporate_enrollments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: credit_notes credit_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: credit_notes credit_notes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: credit_patients credit_patients_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_patients
    ADD CONSTRAINT credit_patients_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: credit_patients credit_patients_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_patients
    ADD CONSTRAINT credit_patients_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: credit_patients credit_patients_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_patients
    ADD CONSTRAINT credit_patients_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: critical_value_rules critical_value_rules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.critical_value_rules
    ADD CONSTRAINT critical_value_rules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cross_hospital_appointments cross_hospital_appointments_booked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cross_hospital_appointments
    ADD CONSTRAINT cross_hospital_appointments_booked_by_fkey FOREIGN KEY (booked_by) REFERENCES public.users(id);


--
-- Name: cross_hospital_appointments cross_hospital_appointments_booking_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cross_hospital_appointments
    ADD CONSTRAINT cross_hospital_appointments_booking_tenant_id_fkey FOREIGN KEY (booking_tenant_id) REFERENCES public.tenants(id);


--
-- Name: cross_hospital_appointments cross_hospital_appointments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cross_hospital_appointments
    ADD CONSTRAINT cross_hospital_appointments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: cross_hospital_appointments cross_hospital_appointments_service_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cross_hospital_appointments
    ADD CONSTRAINT cross_hospital_appointments_service_tenant_id_fkey FOREIGN KEY (service_tenant_id) REFERENCES public.tenants(id);


--
-- Name: crossmatch_requests crossmatch_requests_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crossmatch_requests
    ADD CONSTRAINT crossmatch_requests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: crossmatch_requests crossmatch_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crossmatch_requests
    ADD CONSTRAINT crossmatch_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: crossmatch_requests crossmatch_requests_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crossmatch_requests
    ADD CONSTRAINT crossmatch_requests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: crossmatch_requests crossmatch_requests_tested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crossmatch_requests
    ADD CONSTRAINT crossmatch_requests_tested_by_fkey FOREIGN KEY (tested_by) REFERENCES public.users(id);


--
-- Name: cssd_indicator_results cssd_indicator_results_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_indicator_results
    ADD CONSTRAINT cssd_indicator_results_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cssd_instrument_sets cssd_instrument_sets_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_instrument_sets
    ADD CONSTRAINT cssd_instrument_sets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cssd_instruments cssd_instruments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_instruments
    ADD CONSTRAINT cssd_instruments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cssd_issuances cssd_issuances_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_issuances
    ADD CONSTRAINT cssd_issuances_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cssd_load_items cssd_load_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_load_items
    ADD CONSTRAINT cssd_load_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cssd_maintenance_logs cssd_maintenance_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_maintenance_logs
    ADD CONSTRAINT cssd_maintenance_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cssd_set_items cssd_set_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_set_items
    ADD CONSTRAINT cssd_set_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cssd_sterilization_loads cssd_sterilization_loads_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_sterilization_loads
    ADD CONSTRAINT cssd_sterilization_loads_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: cssd_sterilizers cssd_sterilizers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_sterilizers
    ADD CONSTRAINT cssd_sterilizers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: culture_surveillance culture_surveillance_collected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.culture_surveillance
    ADD CONSTRAINT culture_surveillance_collected_by_fkey FOREIGN KEY (collected_by) REFERENCES public.users(id);


--
-- Name: culture_surveillance culture_surveillance_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.culture_surveillance
    ADD CONSTRAINT culture_surveillance_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: culture_surveillance culture_surveillance_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.culture_surveillance
    ADD CONSTRAINT culture_surveillance_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: culture_surveillance culture_surveillance_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.culture_surveillance
    ADD CONSTRAINT culture_surveillance_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: custom_code_snippets custom_code_snippets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_code_snippets
    ADD CONSTRAINT custom_code_snippets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: custom_code_snippets custom_code_snippets_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_code_snippets
    ADD CONSTRAINT custom_code_snippets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: dashboards dashboards_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboards
    ADD CONSTRAINT dashboards_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: dashboards dashboards_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboards
    ADD CONSTRAINT dashboards_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: dashboards dashboards_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboards
    ADD CONSTRAINT dashboards_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: data_migrations data_migrations_initiated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_migrations
    ADD CONSTRAINT data_migrations_initiated_by_fkey FOREIGN KEY (initiated_by) REFERENCES public.users(id);


--
-- Name: data_quality_issues data_quality_issues_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_quality_issues
    ADD CONSTRAINT data_quality_issues_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: data_quality_issues data_quality_issues_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_quality_issues
    ADD CONSTRAINT data_quality_issues_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: data_quality_rules data_quality_rules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_quality_rules
    ADD CONSTRAINT data_quality_rules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: data_quality_scores data_quality_scores_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_quality_scores
    ADD CONSTRAINT data_quality_scores_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: day_end_closes day_end_closes_cashier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_end_closes
    ADD CONSTRAINT day_end_closes_cashier_id_fkey FOREIGN KEY (cashier_id) REFERENCES public.users(id);


--
-- Name: day_end_closes day_end_closes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_end_closes
    ADD CONSTRAINT day_end_closes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: day_end_closes day_end_closes_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_end_closes
    ADD CONSTRAINT day_end_closes_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: death_other_conditions death_other_conditions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.death_other_conditions
    ADD CONSTRAINT death_other_conditions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: death_records death_records_attending_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.death_records
    ADD CONSTRAINT death_records_attending_doctor_id_fkey FOREIGN KEY (attending_doctor_id) REFERENCES public.users(id);


--
-- Name: death_records death_records_certified_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.death_records
    ADD CONSTRAINT death_records_certified_by_id_fkey FOREIGN KEY (certified_by_id) REFERENCES public.users(id);


--
-- Name: death_records death_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.death_records
    ADD CONSTRAINT death_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: department_alert_thresholds department_alert_thresholds_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_alert_thresholds
    ADD CONSTRAINT department_alert_thresholds_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: department_alert_thresholds department_alert_thresholds_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_alert_thresholds
    ADD CONSTRAINT department_alert_thresholds_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: department_alerts department_alerts_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_alerts
    ADD CONSTRAINT department_alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);


--
-- Name: department_alerts department_alerts_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_alerts
    ADD CONSTRAINT department_alerts_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: department_alerts department_alerts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_alerts
    ADD CONSTRAINT department_alerts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: designations designations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT designations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: device_config_history device_config_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_config_history
    ADD CONSTRAINT device_config_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: device_config_history device_config_history_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_config_history
    ADD CONSTRAINT device_config_history_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: device_instances device_instances_bridge_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_instances
    ADD CONSTRAINT device_instances_bridge_agent_id_fkey FOREIGN KEY (bridge_agent_id) REFERENCES public.bridge_agents(id);


--
-- Name: device_instances device_instances_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_instances
    ADD CONSTRAINT device_instances_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: device_instances device_instances_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_instances
    ADD CONSTRAINT device_instances_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: device_instances device_instances_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_instances
    ADD CONSTRAINT device_instances_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: device_instances device_instances_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_instances
    ADD CONSTRAINT device_instances_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: device_instances device_instances_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_instances
    ADD CONSTRAINT device_instances_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: device_messages device_messages_bridge_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_messages
    ADD CONSTRAINT device_messages_bridge_agent_id_fkey FOREIGN KEY (bridge_agent_id) REFERENCES public.bridge_agents(id);


--
-- Name: device_messages device_messages_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_messages
    ADD CONSTRAINT device_messages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: device_routing_rules device_routing_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_routing_rules
    ADD CONSTRAINT device_routing_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: device_routing_rules device_routing_rules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_routing_rules
    ADD CONSTRAINT device_routing_rules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: diagnoses diagnoses_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnoses
    ADD CONSTRAINT diagnoses_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: diagnoses diagnoses_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnoses
    ADD CONSTRAINT diagnoses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: dialysis_sessions dialysis_sessions_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dialysis_sessions
    ADD CONSTRAINT dialysis_sessions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: dialysis_sessions dialysis_sessions_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dialysis_sessions
    ADD CONSTRAINT dialysis_sessions_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: dialysis_sessions dialysis_sessions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dialysis_sessions
    ADD CONSTRAINT dialysis_sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: diet_orders diet_orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diet_orders
    ADD CONSTRAINT diet_orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: diet_templates diet_templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diet_templates
    ADD CONSTRAINT diet_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: discharge_barriers discharge_barriers_case_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discharge_barriers
    ADD CONSTRAINT discharge_barriers_case_assignment_id_fkey FOREIGN KEY (case_assignment_id) REFERENCES public.case_assignments(id) ON DELETE CASCADE;


--
-- Name: discharge_barriers discharge_barriers_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discharge_barriers
    ADD CONSTRAINT discharge_barriers_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: discharge_barriers discharge_barriers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discharge_barriers
    ADD CONSTRAINT discharge_barriers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: discharge_summary_templates discharge_summary_templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discharge_summary_templates
    ADD CONSTRAINT discharge_summary_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: dnr_orders dnr_orders_authorized_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dnr_orders
    ADD CONSTRAINT dnr_orders_authorized_by_fkey FOREIGN KEY (authorized_by) REFERENCES public.users(id);


--
-- Name: dnr_orders dnr_orders_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dnr_orders
    ADD CONSTRAINT dnr_orders_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: dnr_orders dnr_orders_revoked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dnr_orders
    ADD CONSTRAINT dnr_orders_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES public.users(id);


--
-- Name: dnr_orders dnr_orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dnr_orders
    ADD CONSTRAINT dnr_orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: doctor_coverage_assignments doctor_coverage_assignments_absent_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_coverage_assignments
    ADD CONSTRAINT doctor_coverage_assignments_absent_doctor_id_fkey FOREIGN KEY (absent_doctor_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: doctor_coverage_assignments doctor_coverage_assignments_covering_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_coverage_assignments
    ADD CONSTRAINT doctor_coverage_assignments_covering_doctor_id_fkey FOREIGN KEY (covering_doctor_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: doctor_coverage_assignments doctor_coverage_assignments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_coverage_assignments
    ADD CONSTRAINT doctor_coverage_assignments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: doctor_coverage_assignments doctor_coverage_assignments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_coverage_assignments
    ADD CONSTRAINT doctor_coverage_assignments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: doctor_dockets doctor_dockets_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_dockets
    ADD CONSTRAINT doctor_dockets_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: doctor_dockets doctor_dockets_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_dockets
    ADD CONSTRAINT doctor_dockets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: doctor_incentive_assignments doctor_incentive_assignments_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_incentive_assignments
    ADD CONSTRAINT doctor_incentive_assignments_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: doctor_incentive_assignments doctor_incentive_assignments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_incentive_assignments
    ADD CONSTRAINT doctor_incentive_assignments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: doctor_package_inclusions doctor_package_inclusions_consultation_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_package_inclusions
    ADD CONSTRAINT doctor_package_inclusions_consultation_doctor_id_fkey FOREIGN KEY (consultation_doctor_id) REFERENCES public.users(id);


--
-- Name: doctor_package_inclusions doctor_package_inclusions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_package_inclusions
    ADD CONSTRAINT doctor_package_inclusions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: doctor_packages doctor_packages_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_packages
    ADD CONSTRAINT doctor_packages_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: doctor_packages doctor_packages_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_packages
    ADD CONSTRAINT doctor_packages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: doctor_profiles doctor_profiles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_profiles
    ADD CONSTRAINT doctor_profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: doctor_profiles doctor_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_profiles
    ADD CONSTRAINT doctor_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: doctor_rotation_schedules doctor_rotation_schedules_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_rotation_schedules
    ADD CONSTRAINT doctor_rotation_schedules_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: doctor_rotation_schedules doctor_rotation_schedules_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_rotation_schedules
    ADD CONSTRAINT doctor_rotation_schedules_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.hospital_groups(id);


--
-- Name: doctor_rotation_schedules doctor_rotation_schedules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_rotation_schedules
    ADD CONSTRAINT doctor_rotation_schedules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: doctor_schedule_exceptions doctor_schedule_exceptions_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedule_exceptions
    ADD CONSTRAINT doctor_schedule_exceptions_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: doctor_schedule_exceptions doctor_schedule_exceptions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedule_exceptions
    ADD CONSTRAINT doctor_schedule_exceptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: doctor_schedules doctor_schedules_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedules
    ADD CONSTRAINT doctor_schedules_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: doctor_schedules doctor_schedules_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedules
    ADD CONSTRAINT doctor_schedules_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: doctor_schedules doctor_schedules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedules
    ADD CONSTRAINT doctor_schedules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: doctor_signature_credentials doctor_signature_credentials_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_signature_credentials
    ADD CONSTRAINT doctor_signature_credentials_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: doctor_signature_credentials doctor_signature_credentials_doctor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_signature_credentials
    ADD CONSTRAINT doctor_signature_credentials_doctor_user_id_fkey FOREIGN KEY (doctor_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: doctor_signature_credentials doctor_signature_credentials_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_signature_credentials
    ADD CONSTRAINT doctor_signature_credentials_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: document_form_review_schedule document_form_review_schedule_last_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_form_review_schedule
    ADD CONSTRAINT document_form_review_schedule_last_reviewed_by_fkey FOREIGN KEY (last_reviewed_by) REFERENCES public.users(id);


--
-- Name: document_form_review_schedule document_form_review_schedule_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_form_review_schedule
    ADD CONSTRAINT document_form_review_schedule_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: document_output_signatures document_output_signatures_captured_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_output_signatures
    ADD CONSTRAINT document_output_signatures_captured_by_fkey FOREIGN KEY (captured_by) REFERENCES public.users(id);


--
-- Name: document_output_signatures document_output_signatures_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_output_signatures
    ADD CONSTRAINT document_output_signatures_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: document_outputs document_outputs_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_outputs
    ADD CONSTRAINT document_outputs_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.users(id);


--
-- Name: document_outputs document_outputs_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_outputs
    ADD CONSTRAINT document_outputs_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: document_outputs document_outputs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_outputs
    ADD CONSTRAINT document_outputs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: document_outputs document_outputs_voided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_outputs
    ADD CONSTRAINT document_outputs_voided_by_fkey FOREIGN KEY (voided_by) REFERENCES public.users(id);


--
-- Name: document_template_versions document_template_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_template_versions
    ADD CONSTRAINT document_template_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: document_template_versions document_template_versions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_template_versions
    ADD CONSTRAINT document_template_versions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: document_templates document_templates_brand_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_brand_entity_id_fkey FOREIGN KEY (brand_entity_id) REFERENCES public.brand_entities(id);


--
-- Name: document_templates document_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: document_templates document_templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: document_templates document_templates_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: dpdp_consents dpdp_consents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dpdp_consents
    ADD CONSTRAINT dpdp_consents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: drug_interactions drug_interactions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug_interactions
    ADD CONSTRAINT drug_interactions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: duty_rosters duty_rosters_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_rosters
    ADD CONSTRAINT duty_rosters_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: duty_rosters duty_rosters_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_rosters
    ADD CONSTRAINT duty_rosters_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: duty_rosters duty_rosters_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_rosters
    ADD CONSTRAINT duty_rosters_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: employee_credentials employee_credentials_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_credentials
    ADD CONSTRAINT employee_credentials_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: employee_credentials employee_credentials_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_credentials
    ADD CONSTRAINT employee_credentials_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: employees employees_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: employees employees_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: employees employees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: encounters encounters_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT encounters_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: encounters encounters_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT encounters_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: encounters encounters_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT encounters_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: encounters encounters_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT encounters_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: encounters encounters_retrospective_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT encounters_retrospective_entry_id_fkey FOREIGN KEY (retrospective_entry_id) REFERENCES public.retrospective_entries(id);


--
-- Name: encounters encounters_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT encounters_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: endoscopy_biopsy_specimens endoscopy_biopsy_specimens_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.endoscopy_biopsy_specimens
    ADD CONSTRAINT endoscopy_biopsy_specimens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: endoscopy_procedures endoscopy_procedures_operator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.endoscopy_procedures
    ADD CONSTRAINT endoscopy_procedures_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES public.users(id);


--
-- Name: endoscopy_procedures endoscopy_procedures_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.endoscopy_procedures
    ADD CONSTRAINT endoscopy_procedures_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: endoscopy_procedures endoscopy_procedures_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.endoscopy_procedures
    ADD CONSTRAINT endoscopy_procedures_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: endoscopy_reprocessing endoscopy_reprocessing_reprocessed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.endoscopy_reprocessing
    ADD CONSTRAINT endoscopy_reprocessing_reprocessed_by_fkey FOREIGN KEY (reprocessed_by) REFERENCES public.users(id);


--
-- Name: endoscopy_reprocessing endoscopy_reprocessing_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.endoscopy_reprocessing
    ADD CONSTRAINT endoscopy_reprocessing_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: endoscopy_scopes endoscopy_scopes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.endoscopy_scopes
    ADD CONSTRAINT endoscopy_scopes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: enquiry_logs enquiry_logs_handled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enquiry_logs
    ADD CONSTRAINT enquiry_logs_handled_by_fkey FOREIGN KEY (handled_by) REFERENCES public.users(id);


--
-- Name: enquiry_logs enquiry_logs_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enquiry_logs
    ADD CONSTRAINT enquiry_logs_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: enquiry_logs enquiry_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enquiry_logs
    ADD CONSTRAINT enquiry_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: eod_digest_history eod_digest_history_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eod_digest_history
    ADD CONSTRAINT eod_digest_history_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: eod_digest_history eod_digest_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eod_digest_history
    ADD CONSTRAINT eod_digest_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: eod_digest_subscriptions eod_digest_subscriptions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eod_digest_subscriptions
    ADD CONSTRAINT eod_digest_subscriptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: eod_digest_subscriptions eod_digest_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eod_digest_subscriptions
    ADD CONSTRAINT eod_digest_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: equipment_checks equipment_checks_checked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_checks
    ADD CONSTRAINT equipment_checks_checked_by_fkey FOREIGN KEY (checked_by) REFERENCES public.users(id);


--
-- Name: equipment_checks equipment_checks_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_checks
    ADD CONSTRAINT equipment_checks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: equipment_condemnations equipment_condemnations_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_condemnations
    ADD CONSTRAINT equipment_condemnations_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: equipment_condemnations equipment_condemnations_initiated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_condemnations
    ADD CONSTRAINT equipment_condemnations_initiated_by_fkey FOREIGN KEY (initiated_by) REFERENCES public.users(id);


--
-- Name: equipment_condemnations equipment_condemnations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_condemnations
    ADD CONSTRAINT equipment_condemnations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: equipment equipment_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: equipment equipment_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: equipment equipment_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: er_code_activations er_code_activations_activated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_code_activations
    ADD CONSTRAINT er_code_activations_activated_by_fkey FOREIGN KEY (activated_by) REFERENCES public.users(id);


--
-- Name: er_code_activations er_code_activations_deactivated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_code_activations
    ADD CONSTRAINT er_code_activations_deactivated_by_fkey FOREIGN KEY (deactivated_by) REFERENCES public.users(id);


--
-- Name: er_code_activations er_code_activations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_code_activations
    ADD CONSTRAINT er_code_activations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: er_resuscitation_logs er_resuscitation_logs_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_resuscitation_logs
    ADD CONSTRAINT er_resuscitation_logs_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: er_resuscitation_logs er_resuscitation_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_resuscitation_logs
    ADD CONSTRAINT er_resuscitation_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: er_triage_assessments er_triage_assessments_assessed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_triage_assessments
    ADD CONSTRAINT er_triage_assessments_assessed_by_fkey FOREIGN KEY (assessed_by) REFERENCES public.users(id);


--
-- Name: er_triage_assessments er_triage_assessments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_triage_assessments
    ADD CONSTRAINT er_triage_assessments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: er_visits er_visits_attending_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_visits
    ADD CONSTRAINT er_visits_attending_doctor_id_fkey FOREIGN KEY (attending_doctor_id) REFERENCES public.users(id);


--
-- Name: er_visits er_visits_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_visits
    ADD CONSTRAINT er_visits_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: er_visits er_visits_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_visits
    ADD CONSTRAINT er_visits_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: er_visits er_visits_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_visits
    ADD CONSTRAINT er_visits_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: erp_export_log erp_export_log_exported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_export_log
    ADD CONSTRAINT erp_export_log_exported_by_fkey FOREIGN KEY (exported_by) REFERENCES public.users(id);


--
-- Name: erp_export_log erp_export_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_export_log
    ADD CONSTRAINT erp_export_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: exchange_rates exchange_rates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: facilities facilities_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facilities
    ADD CONSTRAINT facilities_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.geo_countries(id);


--
-- Name: facilities facilities_district_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facilities
    ADD CONSTRAINT facilities_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.geo_districts(id);


--
-- Name: facilities facilities_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facilities
    ADD CONSTRAINT facilities_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.geo_states(id);


--
-- Name: facilities facilities_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facilities
    ADD CONSTRAINT facilities_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: facility_regulatory_compliance facility_regulatory_compliance_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_regulatory_compliance
    ADD CONSTRAINT facility_regulatory_compliance_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: facility_regulatory_compliance facility_regulatory_compliance_regulatory_body_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_regulatory_compliance
    ADD CONSTRAINT facility_regulatory_compliance_regulatory_body_id_fkey FOREIGN KEY (regulatory_body_id) REFERENCES public.regulatory_bodies(id);


--
-- Name: facility_regulatory_compliance facility_regulatory_compliance_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_regulatory_compliance
    ADD CONSTRAINT facility_regulatory_compliance_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: fall_risk_assessments fall_risk_assessments_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fall_risk_assessments
    ADD CONSTRAINT fall_risk_assessments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: fall_risk_assessments fall_risk_assessments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fall_risk_assessments
    ADD CONSTRAINT fall_risk_assessments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: fms_energy_readings fms_energy_readings_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_energy_readings
    ADD CONSTRAINT fms_energy_readings_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: fms_energy_readings fms_energy_readings_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_energy_readings
    ADD CONSTRAINT fms_energy_readings_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: fms_energy_readings fms_energy_readings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_energy_readings
    ADD CONSTRAINT fms_energy_readings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: fms_fire_drills fms_fire_drills_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_fire_drills
    ADD CONSTRAINT fms_fire_drills_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: fms_fire_drills fms_fire_drills_conducted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_fire_drills
    ADD CONSTRAINT fms_fire_drills_conducted_by_fkey FOREIGN KEY (conducted_by) REFERENCES public.users(id);


--
-- Name: fms_fire_drills fms_fire_drills_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_fire_drills
    ADD CONSTRAINT fms_fire_drills_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: fms_fire_equipment fms_fire_equipment_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_fire_equipment
    ADD CONSTRAINT fms_fire_equipment_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: fms_fire_equipment fms_fire_equipment_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_fire_equipment
    ADD CONSTRAINT fms_fire_equipment_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: fms_fire_equipment fms_fire_equipment_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_fire_equipment
    ADD CONSTRAINT fms_fire_equipment_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: fms_fire_inspections fms_fire_inspections_inspected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_fire_inspections
    ADD CONSTRAINT fms_fire_inspections_inspected_by_fkey FOREIGN KEY (inspected_by) REFERENCES public.users(id);


--
-- Name: fms_fire_inspections fms_fire_inspections_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_fire_inspections
    ADD CONSTRAINT fms_fire_inspections_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: fms_fire_noc fms_fire_noc_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_fire_noc
    ADD CONSTRAINT fms_fire_noc_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: fms_gas_compliance fms_gas_compliance_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_gas_compliance
    ADD CONSTRAINT fms_gas_compliance_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: fms_gas_readings fms_gas_readings_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_gas_readings
    ADD CONSTRAINT fms_gas_readings_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: fms_gas_readings fms_gas_readings_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_gas_readings
    ADD CONSTRAINT fms_gas_readings_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: fms_gas_readings fms_gas_readings_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_gas_readings
    ADD CONSTRAINT fms_gas_readings_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: fms_gas_readings fms_gas_readings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_gas_readings
    ADD CONSTRAINT fms_gas_readings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: fms_water_schedules fms_water_schedules_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_water_schedules
    ADD CONSTRAINT fms_water_schedules_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: fms_water_schedules fms_water_schedules_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_water_schedules
    ADD CONSTRAINT fms_water_schedules_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: fms_water_schedules fms_water_schedules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_water_schedules
    ADD CONSTRAINT fms_water_schedules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: fms_water_tests fms_water_tests_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_water_tests
    ADD CONSTRAINT fms_water_tests_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: fms_water_tests fms_water_tests_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_water_tests
    ADD CONSTRAINT fms_water_tests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: fms_work_orders fms_work_orders_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_work_orders
    ADD CONSTRAINT fms_work_orders_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: fms_work_orders fms_work_orders_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_work_orders
    ADD CONSTRAINT fms_work_orders_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id);


--
-- Name: fms_work_orders fms_work_orders_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_work_orders
    ADD CONSTRAINT fms_work_orders_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: fms_work_orders fms_work_orders_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_work_orders
    ADD CONSTRAINT fms_work_orders_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: fms_work_orders fms_work_orders_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_work_orders
    ADD CONSTRAINT fms_work_orders_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: fms_work_orders fms_work_orders_sign_off_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_work_orders
    ADD CONSTRAINT fms_work_orders_sign_off_by_fkey FOREIGN KEY (sign_off_by) REFERENCES public.users(id);


--
-- Name: fms_work_orders fms_work_orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_work_orders
    ADD CONSTRAINT fms_work_orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: fms_work_orders fms_work_orders_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_work_orders
    ADD CONSTRAINT fms_work_orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: gl_accounts gl_accounts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gl_accounts
    ADD CONSTRAINT gl_accounts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: goods_receipt_notes goods_receipt_notes_inspected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT goods_receipt_notes_inspected_by_fkey FOREIGN KEY (inspected_by) REFERENCES public.users(id);


--
-- Name: goods_receipt_notes goods_receipt_notes_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT goods_receipt_notes_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id);


--
-- Name: goods_receipt_notes goods_receipt_notes_store_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT goods_receipt_notes_store_location_id_fkey FOREIGN KEY (store_location_id) REFERENCES public.store_locations(id);


--
-- Name: goods_receipt_notes goods_receipt_notes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT goods_receipt_notes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: goods_receipts goods_receipts_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id);


--
-- Name: goods_receipts goods_receipts_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: goods_receipts goods_receipts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: goods_receipts goods_receipts_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: grn_items grn_items_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn_items
    ADD CONSTRAINT grn_items_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.store_catalog(id);


--
-- Name: grn_items grn_items_pharmacy_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn_items
    ADD CONSTRAINT grn_items_pharmacy_batch_id_fkey FOREIGN KEY (pharmacy_batch_id) REFERENCES public.pharmacy_batches(id);


--
-- Name: grn_items grn_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn_items
    ADD CONSTRAINT grn_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: group_kpi_snapshots group_kpi_snapshots_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_kpi_snapshots
    ADD CONSTRAINT group_kpi_snapshots_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: gst_return_summaries gst_return_summaries_filed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_return_summaries
    ADD CONSTRAINT gst_return_summaries_filed_by_fkey FOREIGN KEY (filed_by) REFERENCES public.users(id);


--
-- Name: gst_return_summaries gst_return_summaries_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_return_summaries
    ADD CONSTRAINT gst_return_summaries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: hand_hygiene_audits hand_hygiene_audits_auditor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hand_hygiene_audits
    ADD CONSTRAINT hand_hygiene_audits_auditor_id_fkey FOREIGN KEY (auditor_id) REFERENCES public.users(id);


--
-- Name: hand_hygiene_audits hand_hygiene_audits_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hand_hygiene_audits
    ADD CONSTRAINT hand_hygiene_audits_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: hand_hygiene_audits hand_hygiene_audits_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hand_hygiene_audits
    ADD CONSTRAINT hand_hygiene_audits_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: hand_hygiene_audits hand_hygiene_audits_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hand_hygiene_audits
    ADD CONSTRAINT hand_hygiene_audits_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: histopath_results histopath_results_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.histopath_results
    ADD CONSTRAINT histopath_results_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: hospital_price_overrides hospital_price_overrides_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_price_overrides
    ADD CONSTRAINT hospital_price_overrides_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: hospital_price_overrides hospital_price_overrides_group_tariff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_price_overrides
    ADD CONSTRAINT hospital_price_overrides_group_tariff_id_fkey FOREIGN KEY (group_tariff_id) REFERENCES public.group_tariff_master(id);


--
-- Name: hospital_price_overrides hospital_price_overrides_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_price_overrides
    ADD CONSTRAINT hospital_price_overrides_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: icu_bundle_checks icu_bundle_checks_checked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_bundle_checks
    ADD CONSTRAINT icu_bundle_checks_checked_by_fkey FOREIGN KEY (checked_by) REFERENCES public.users(id);


--
-- Name: icu_bundle_checks icu_bundle_checks_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_bundle_checks
    ADD CONSTRAINT icu_bundle_checks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: icu_devices icu_devices_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_devices
    ADD CONSTRAINT icu_devices_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: icu_devices icu_devices_inserted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_devices
    ADD CONSTRAINT icu_devices_inserted_by_fkey FOREIGN KEY (inserted_by) REFERENCES public.users(id);


--
-- Name: icu_devices icu_devices_removed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_devices
    ADD CONSTRAINT icu_devices_removed_by_fkey FOREIGN KEY (removed_by) REFERENCES public.users(id);


--
-- Name: icu_devices icu_devices_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_devices
    ADD CONSTRAINT icu_devices_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: icu_flowsheets icu_flowsheets_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_flowsheets
    ADD CONSTRAINT icu_flowsheets_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: icu_flowsheets icu_flowsheets_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_flowsheets
    ADD CONSTRAINT icu_flowsheets_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: icu_flowsheets icu_flowsheets_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_flowsheets
    ADD CONSTRAINT icu_flowsheets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: icu_neonatal_records icu_neonatal_records_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_neonatal_records
    ADD CONSTRAINT icu_neonatal_records_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: icu_neonatal_records icu_neonatal_records_mother_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_neonatal_records
    ADD CONSTRAINT icu_neonatal_records_mother_patient_id_fkey FOREIGN KEY (mother_patient_id) REFERENCES public.patients(id);


--
-- Name: icu_neonatal_records icu_neonatal_records_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_neonatal_records
    ADD CONSTRAINT icu_neonatal_records_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: icu_neonatal_records icu_neonatal_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_neonatal_records
    ADD CONSTRAINT icu_neonatal_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: icu_nutrition icu_nutrition_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_nutrition
    ADD CONSTRAINT icu_nutrition_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: icu_nutrition icu_nutrition_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_nutrition
    ADD CONSTRAINT icu_nutrition_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: icu_nutrition icu_nutrition_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_nutrition
    ADD CONSTRAINT icu_nutrition_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: icu_scores icu_scores_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_scores
    ADD CONSTRAINT icu_scores_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: icu_scores icu_scores_scored_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_scores
    ADD CONSTRAINT icu_scores_scored_by_fkey FOREIGN KEY (scored_by) REFERENCES public.users(id);


--
-- Name: icu_scores icu_scores_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_scores
    ADD CONSTRAINT icu_scores_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: icu_ventilator_records icu_ventilator_records_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_ventilator_records
    ADD CONSTRAINT icu_ventilator_records_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: icu_ventilator_records icu_ventilator_records_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_ventilator_records
    ADD CONSTRAINT icu_ventilator_records_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: icu_ventilator_records icu_ventilator_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_ventilator_records
    ADD CONSTRAINT icu_ventilator_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: implant_registry implant_registry_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.implant_registry
    ADD CONSTRAINT implant_registry_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: implant_registry implant_registry_surgeon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.implant_registry
    ADD CONSTRAINT implant_registry_surgeon_id_fkey FOREIGN KEY (surgeon_id) REFERENCES public.users(id);


--
-- Name: implant_registry implant_registry_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.implant_registry
    ADD CONSTRAINT implant_registry_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: incentive_calculations incentive_calculations_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incentive_calculations
    ADD CONSTRAINT incentive_calculations_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: incentive_calculations incentive_calculations_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incentive_calculations
    ADD CONSTRAINT incentive_calculations_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: incentive_calculations incentive_calculations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incentive_calculations
    ADD CONSTRAINT incentive_calculations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: incentive_plan_rules incentive_plan_rules_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incentive_plan_rules
    ADD CONSTRAINT incentive_plan_rules_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: incentive_plans incentive_plans_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incentive_plans
    ADD CONSTRAINT incentive_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: incentive_plans incentive_plans_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incentive_plans
    ADD CONSTRAINT incentive_plans_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: indent_items indent_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_items
    ADD CONSTRAINT indent_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: indent_requisitions indent_requisitions_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_requisitions
    ADD CONSTRAINT indent_requisitions_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: indent_requisitions indent_requisitions_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_requisitions
    ADD CONSTRAINT indent_requisitions_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: indent_requisitions indent_requisitions_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_requisitions
    ADD CONSTRAINT indent_requisitions_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: indent_requisitions indent_requisitions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_requisitions
    ADD CONSTRAINT indent_requisitions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: indents indents_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indents
    ADD CONSTRAINT indents_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: indents indents_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indents
    ADD CONSTRAINT indents_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: indents indents_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indents
    ADD CONSTRAINT indents_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: indents indents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indents
    ADD CONSTRAINT indents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: infection_device_days infection_device_days_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infection_device_days
    ADD CONSTRAINT infection_device_days_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: infection_device_days infection_device_days_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infection_device_days
    ADD CONSTRAINT infection_device_days_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: infection_device_days infection_device_days_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infection_device_days
    ADD CONSTRAINT infection_device_days_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: infection_device_days infection_device_days_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infection_device_days
    ADD CONSTRAINT infection_device_days_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: infection_surveillance_events infection_surveillance_events_confirmed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infection_surveillance_events
    ADD CONSTRAINT infection_surveillance_events_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES public.users(id);


--
-- Name: infection_surveillance_events infection_surveillance_events_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infection_surveillance_events
    ADD CONSTRAINT infection_surveillance_events_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: infection_surveillance_events infection_surveillance_events_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infection_surveillance_events
    ADD CONSTRAINT infection_surveillance_events_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: infection_surveillance_events infection_surveillance_events_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infection_surveillance_events
    ADD CONSTRAINT infection_surveillance_events_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: infection_surveillance_events infection_surveillance_events_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infection_surveillance_events
    ADD CONSTRAINT infection_surveillance_events_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id);


--
-- Name: infection_surveillance_events infection_surveillance_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infection_surveillance_events
    ADD CONSTRAINT infection_surveillance_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: insurance_claims insurance_claims_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_claims
    ADD CONSTRAINT insurance_claims_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: insurance_claims insurance_claims_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_claims
    ADD CONSTRAINT insurance_claims_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: insurance_claims insurance_claims_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_claims
    ADD CONSTRAINT insurance_claims_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: insurance_claims insurance_claims_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_claims
    ADD CONSTRAINT insurance_claims_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: insurance_claims insurance_claims_tpa_rate_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_claims
    ADD CONSTRAINT insurance_claims_tpa_rate_plan_id_fkey FOREIGN KEY (tpa_rate_plan_id) REFERENCES public.rate_plans(id);


--
-- Name: insurance_verifications insurance_verifications_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_verifications
    ADD CONSTRAINT insurance_verifications_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: insurance_verifications insurance_verifications_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_verifications
    ADD CONSTRAINT insurance_verifications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: insurance_verifications insurance_verifications_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_verifications
    ADD CONSTRAINT insurance_verifications_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: intake_output_entries intake_output_entries_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_output_entries
    ADD CONSTRAINT intake_output_entries_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: intake_output_entries intake_output_entries_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_output_entries
    ADD CONSTRAINT intake_output_entries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: integration_executions integration_executions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_executions
    ADD CONSTRAINT integration_executions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: integration_executions integration_executions_triggered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_executions
    ADD CONSTRAINT integration_executions_triggered_by_fkey FOREIGN KEY (triggered_by) REFERENCES public.users(id);


--
-- Name: integration_node_templates integration_node_templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_node_templates
    ADD CONSTRAINT integration_node_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: integration_pipelines integration_pipelines_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_pipelines
    ADD CONSTRAINT integration_pipelines_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: integration_pipelines integration_pipelines_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_pipelines
    ADD CONSTRAINT integration_pipelines_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: integration_pipelines integration_pipelines_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_pipelines
    ADD CONSTRAINT integration_pipelines_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: inter_hospital_stock_transfers inter_hospital_stock_transfers_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inter_hospital_stock_transfers
    ADD CONSTRAINT inter_hospital_stock_transfers_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: inter_hospital_stock_transfers inter_hospital_stock_transfers_dest_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inter_hospital_stock_transfers
    ADD CONSTRAINT inter_hospital_stock_transfers_dest_tenant_id_fkey FOREIGN KEY (dest_tenant_id) REFERENCES public.tenants(id);


--
-- Name: inter_hospital_stock_transfers inter_hospital_stock_transfers_dispatched_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inter_hospital_stock_transfers
    ADD CONSTRAINT inter_hospital_stock_transfers_dispatched_by_fkey FOREIGN KEY (dispatched_by) REFERENCES public.users(id);


--
-- Name: inter_hospital_stock_transfers inter_hospital_stock_transfers_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inter_hospital_stock_transfers
    ADD CONSTRAINT inter_hospital_stock_transfers_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id);


--
-- Name: inter_hospital_stock_transfers inter_hospital_stock_transfers_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inter_hospital_stock_transfers
    ADD CONSTRAINT inter_hospital_stock_transfers_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: inter_hospital_stock_transfers inter_hospital_stock_transfers_source_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inter_hospital_stock_transfers
    ADD CONSTRAINT inter_hospital_stock_transfers_source_tenant_id_fkey FOREIGN KEY (source_tenant_id) REFERENCES public.tenants(id);


--
-- Name: invoice_discounts invoice_discounts_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_discounts
    ADD CONSTRAINT invoice_discounts_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: invoice_discounts invoice_discounts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_discounts
    ADD CONSTRAINT invoice_discounts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: invoice_items invoice_items_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: invoice_items invoice_items_ordering_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_ordering_doctor_id_fkey FOREIGN KEY (ordering_doctor_id) REFERENCES public.users(id);


--
-- Name: invoice_items invoice_items_pharmacy_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pharmacy_batch_id_fkey FOREIGN KEY (pharmacy_batch_id) REFERENCES public.pharmacy_batches(id);


--
-- Name: invoice_items invoice_items_pharmacy_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pharmacy_order_id_fkey FOREIGN KEY (pharmacy_order_id) REFERENCES public.pharmacy_orders(id);


--
-- Name: invoice_items invoice_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: invoices invoices_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: invoices invoices_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: invoices invoices_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: invoices invoices_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ip_type_configurations ip_type_configurations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_type_configurations
    ADD CONSTRAINT ip_type_configurations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ipd_birth_records ipd_birth_records_baby_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_birth_records
    ADD CONSTRAINT ipd_birth_records_baby_patient_id_fkey FOREIGN KEY (baby_patient_id) REFERENCES public.patients(id);


--
-- Name: ipd_birth_records ipd_birth_records_mother_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_birth_records
    ADD CONSTRAINT ipd_birth_records_mother_patient_id_fkey FOREIGN KEY (mother_patient_id) REFERENCES public.patients(id);


--
-- Name: ipd_birth_records ipd_birth_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_birth_records
    ADD CONSTRAINT ipd_birth_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ipd_care_plans ipd_care_plans_initiated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_care_plans
    ADD CONSTRAINT ipd_care_plans_initiated_by_fkey FOREIGN KEY (initiated_by) REFERENCES public.users(id);


--
-- Name: ipd_care_plans ipd_care_plans_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_care_plans
    ADD CONSTRAINT ipd_care_plans_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: ipd_care_plans ipd_care_plans_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_care_plans
    ADD CONSTRAINT ipd_care_plans_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ipd_clinical_assessments ipd_clinical_assessments_assessed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_clinical_assessments
    ADD CONSTRAINT ipd_clinical_assessments_assessed_by_fkey FOREIGN KEY (assessed_by) REFERENCES public.users(id);


--
-- Name: ipd_clinical_assessments ipd_clinical_assessments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_clinical_assessments
    ADD CONSTRAINT ipd_clinical_assessments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ipd_clinical_documentations ipd_clinical_documentations_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_clinical_documentations
    ADD CONSTRAINT ipd_clinical_documentations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: ipd_clinical_documentations ipd_clinical_documentations_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_clinical_documentations
    ADD CONSTRAINT ipd_clinical_documentations_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: ipd_clinical_documentations ipd_clinical_documentations_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_clinical_documentations
    ADD CONSTRAINT ipd_clinical_documentations_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: ipd_clinical_documentations ipd_clinical_documentations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_clinical_documentations
    ADD CONSTRAINT ipd_clinical_documentations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ipd_death_summaries ipd_death_summaries_certifying_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_death_summaries
    ADD CONSTRAINT ipd_death_summaries_certifying_doctor_id_fkey FOREIGN KEY (certifying_doctor_id) REFERENCES public.users(id);


--
-- Name: ipd_death_summaries ipd_death_summaries_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_death_summaries
    ADD CONSTRAINT ipd_death_summaries_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: ipd_death_summaries ipd_death_summaries_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_death_summaries
    ADD CONSTRAINT ipd_death_summaries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ipd_discharge_checklists ipd_discharge_checklists_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_checklists
    ADD CONSTRAINT ipd_discharge_checklists_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id);


--
-- Name: ipd_discharge_checklists ipd_discharge_checklists_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_checklists
    ADD CONSTRAINT ipd_discharge_checklists_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ipd_discharge_summaries ipd_discharge_summaries_prepared_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_summaries
    ADD CONSTRAINT ipd_discharge_summaries_prepared_by_fkey FOREIGN KEY (prepared_by) REFERENCES public.users(id);


--
-- Name: ipd_discharge_summaries ipd_discharge_summaries_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_summaries
    ADD CONSTRAINT ipd_discharge_summaries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ipd_discharge_summaries ipd_discharge_summaries_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_summaries
    ADD CONSTRAINT ipd_discharge_summaries_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: ipd_discharge_tat_log ipd_discharge_tat_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_tat_log
    ADD CONSTRAINT ipd_discharge_tat_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ipd_handover_reports ipd_handover_reports_incoming_nurse_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_handover_reports
    ADD CONSTRAINT ipd_handover_reports_incoming_nurse_fkey FOREIGN KEY (incoming_nurse) REFERENCES public.users(id);


--
-- Name: ipd_handover_reports ipd_handover_reports_outgoing_nurse_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_handover_reports
    ADD CONSTRAINT ipd_handover_reports_outgoing_nurse_fkey FOREIGN KEY (outgoing_nurse) REFERENCES public.users(id);


--
-- Name: ipd_handover_reports ipd_handover_reports_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_handover_reports
    ADD CONSTRAINT ipd_handover_reports_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ipd_intake_output ipd_intake_output_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_intake_output
    ADD CONSTRAINT ipd_intake_output_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: ipd_intake_output ipd_intake_output_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_intake_output
    ADD CONSTRAINT ipd_intake_output_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ipd_medication_administration ipd_medication_administration_administered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_medication_administration
    ADD CONSTRAINT ipd_medication_administration_administered_by_fkey FOREIGN KEY (administered_by) REFERENCES public.users(id);


--
-- Name: ipd_medication_administration ipd_medication_administration_double_checked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_medication_administration
    ADD CONSTRAINT ipd_medication_administration_double_checked_by_fkey FOREIGN KEY (double_checked_by) REFERENCES public.users(id);


--
-- Name: ipd_medication_administration ipd_medication_administration_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_medication_administration
    ADD CONSTRAINT ipd_medication_administration_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ipd_medication_administration ipd_medication_administration_witnessed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_medication_administration
    ADD CONSTRAINT ipd_medication_administration_witnessed_by_fkey FOREIGN KEY (witnessed_by) REFERENCES public.users(id);


--
-- Name: ipd_nursing_assessments ipd_nursing_assessments_assessed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_nursing_assessments
    ADD CONSTRAINT ipd_nursing_assessments_assessed_by_fkey FOREIGN KEY (assessed_by) REFERENCES public.users(id);


--
-- Name: ipd_nursing_assessments ipd_nursing_assessments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_nursing_assessments
    ADD CONSTRAINT ipd_nursing_assessments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ipd_progress_notes ipd_progress_notes_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_progress_notes
    ADD CONSTRAINT ipd_progress_notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: ipd_progress_notes ipd_progress_notes_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_progress_notes
    ADD CONSTRAINT ipd_progress_notes_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: ipd_progress_notes ipd_progress_notes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_progress_notes
    ADD CONSTRAINT ipd_progress_notes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ipd_transfer_logs ipd_transfer_logs_from_bed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_transfer_logs
    ADD CONSTRAINT ipd_transfer_logs_from_bed_id_fkey FOREIGN KEY (from_bed_id) REFERENCES public.locations(id);


--
-- Name: ipd_transfer_logs ipd_transfer_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_transfer_logs
    ADD CONSTRAINT ipd_transfer_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ipd_transfer_logs ipd_transfer_logs_to_bed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_transfer_logs
    ADD CONSTRAINT ipd_transfer_logs_to_bed_id_fkey FOREIGN KEY (to_bed_id) REFERENCES public.locations(id);


--
-- Name: ipd_transfer_logs ipd_transfer_logs_transferred_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_transfer_logs
    ADD CONSTRAINT ipd_transfer_logs_transferred_by_fkey FOREIGN KEY (transferred_by) REFERENCES public.users(id);


--
-- Name: job_queue job_queue_connector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_queue
    ADD CONSTRAINT job_queue_connector_id_fkey FOREIGN KEY (connector_id) REFERENCES public.connectors(id);


--
-- Name: job_queue job_queue_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_queue
    ADD CONSTRAINT job_queue_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.integration_executions(id);


--
-- Name: job_queue job_queue_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_queue
    ADD CONSTRAINT job_queue_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.integration_pipelines(id);


--
-- Name: journal_entries journal_entries_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: journal_entries journal_entries_posted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES public.users(id);


--
-- Name: journal_entries journal_entries_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: journal_entry_lines journal_entry_lines_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: journal_entry_lines journal_entry_lines_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: kitchen_audits kitchen_audits_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_audits
    ADD CONSTRAINT kitchen_audits_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: kitchen_inventory kitchen_inventory_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_inventory
    ADD CONSTRAINT kitchen_inventory_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: kitchen_menu_items kitchen_menu_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_menu_items
    ADD CONSTRAINT kitchen_menu_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: kitchen_menus kitchen_menus_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_menus
    ADD CONSTRAINT kitchen_menus_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_b2b_clients lab_b2b_clients_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_b2b_clients
    ADD CONSTRAINT lab_b2b_clients_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_b2b_rates lab_b2b_rates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_b2b_rates
    ADD CONSTRAINT lab_b2b_rates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_calibrations lab_calibrations_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_calibrations
    ADD CONSTRAINT lab_calibrations_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: lab_calibrations lab_calibrations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_calibrations
    ADD CONSTRAINT lab_calibrations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_collection_centers lab_collection_centers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_collection_centers
    ADD CONSTRAINT lab_collection_centers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_critical_alerts lab_critical_alerts_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_critical_alerts
    ADD CONSTRAINT lab_critical_alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);


--
-- Name: lab_critical_alerts lab_critical_alerts_notified_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_critical_alerts
    ADD CONSTRAINT lab_critical_alerts_notified_to_fkey FOREIGN KEY (notified_to) REFERENCES public.users(id);


--
-- Name: lab_critical_alerts lab_critical_alerts_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_critical_alerts
    ADD CONSTRAINT lab_critical_alerts_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: lab_critical_alerts lab_critical_alerts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_critical_alerts
    ADD CONSTRAINT lab_critical_alerts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_cytology_reports lab_cytology_reports_cytopathologist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_cytology_reports
    ADD CONSTRAINT lab_cytology_reports_cytopathologist_id_fkey FOREIGN KEY (cytopathologist_id) REFERENCES public.users(id);


--
-- Name: lab_cytology_reports lab_cytology_reports_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_cytology_reports
    ADD CONSTRAINT lab_cytology_reports_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: lab_cytology_reports lab_cytology_reports_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_cytology_reports
    ADD CONSTRAINT lab_cytology_reports_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_eqas_results lab_eqas_results_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_eqas_results
    ADD CONSTRAINT lab_eqas_results_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_histopath_reports lab_histopath_reports_pathologist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_histopath_reports
    ADD CONSTRAINT lab_histopath_reports_pathologist_id_fkey FOREIGN KEY (pathologist_id) REFERENCES public.users(id);


--
-- Name: lab_histopath_reports lab_histopath_reports_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_histopath_reports
    ADD CONSTRAINT lab_histopath_reports_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: lab_histopath_reports lab_histopath_reports_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_histopath_reports
    ADD CONSTRAINT lab_histopath_reports_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_home_collections lab_home_collections_assigned_phlebotomist_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_home_collections
    ADD CONSTRAINT lab_home_collections_assigned_phlebotomist_fkey FOREIGN KEY (assigned_phlebotomist) REFERENCES public.users(id);


--
-- Name: lab_home_collections lab_home_collections_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_home_collections
    ADD CONSTRAINT lab_home_collections_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: lab_home_collections lab_home_collections_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_home_collections
    ADD CONSTRAINT lab_home_collections_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_molecular_reports lab_molecular_reports_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_molecular_reports
    ADD CONSTRAINT lab_molecular_reports_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: lab_molecular_reports lab_molecular_reports_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_molecular_reports
    ADD CONSTRAINT lab_molecular_reports_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: lab_molecular_reports lab_molecular_reports_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_molecular_reports
    ADD CONSTRAINT lab_molecular_reports_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_nabl_documents lab_nabl_documents_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_nabl_documents
    ADD CONSTRAINT lab_nabl_documents_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: lab_nabl_documents lab_nabl_documents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_nabl_documents
    ADD CONSTRAINT lab_nabl_documents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_orders lab_orders_collected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_collected_by_fkey FOREIGN KEY (collected_by) REFERENCES public.users(id);


--
-- Name: lab_orders lab_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: lab_orders lab_orders_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: lab_orders lab_orders_ordered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_ordered_by_fkey FOREIGN KEY (ordered_by) REFERENCES public.users(id);


--
-- Name: lab_orders lab_orders_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: lab_orders lab_orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_orders lab_orders_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: lab_outsourced_orders lab_outsourced_orders_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_outsourced_orders
    ADD CONSTRAINT lab_outsourced_orders_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id);


--
-- Name: lab_outsourced_orders lab_outsourced_orders_sent_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_outsourced_orders
    ADD CONSTRAINT lab_outsourced_orders_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES public.users(id);


--
-- Name: lab_outsourced_orders lab_outsourced_orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_outsourced_orders
    ADD CONSTRAINT lab_outsourced_orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_panel_tests lab_panel_tests_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_panel_tests
    ADD CONSTRAINT lab_panel_tests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_phlebotomy_queue lab_phlebotomy_queue_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_phlebotomy_queue
    ADD CONSTRAINT lab_phlebotomy_queue_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: lab_phlebotomy_queue lab_phlebotomy_queue_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_phlebotomy_queue
    ADD CONSTRAINT lab_phlebotomy_queue_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: lab_phlebotomy_queue lab_phlebotomy_queue_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_phlebotomy_queue
    ADD CONSTRAINT lab_phlebotomy_queue_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: lab_phlebotomy_queue lab_phlebotomy_queue_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_phlebotomy_queue
    ADD CONSTRAINT lab_phlebotomy_queue_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_proficiency_tests lab_proficiency_tests_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_proficiency_tests
    ADD CONSTRAINT lab_proficiency_tests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_qc_metrics lab_qc_metrics_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_qc_metrics
    ADD CONSTRAINT lab_qc_metrics_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_qc_results lab_qc_results_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_qc_results
    ADD CONSTRAINT lab_qc_results_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: lab_qc_results lab_qc_results_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_qc_results
    ADD CONSTRAINT lab_qc_results_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: lab_qc_results lab_qc_results_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_qc_results
    ADD CONSTRAINT lab_qc_results_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_reagent_lots lab_reagent_lots_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_reagent_lots
    ADD CONSTRAINT lab_reagent_lots_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_referral_doctors lab_referral_doctors_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_referral_doctors
    ADD CONSTRAINT lab_referral_doctors_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_referral_payouts lab_referral_payouts_paid_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_referral_payouts
    ADD CONSTRAINT lab_referral_payouts_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES public.users(id);


--
-- Name: lab_referral_payouts lab_referral_payouts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_referral_payouts
    ADD CONSTRAINT lab_referral_payouts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_report_dispatches lab_report_dispatches_dispatched_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_report_dispatches
    ADD CONSTRAINT lab_report_dispatches_dispatched_by_fkey FOREIGN KEY (dispatched_by) REFERENCES public.users(id);


--
-- Name: lab_report_dispatches lab_report_dispatches_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_report_dispatches
    ADD CONSTRAINT lab_report_dispatches_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: lab_report_dispatches lab_report_dispatches_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_report_dispatches
    ADD CONSTRAINT lab_report_dispatches_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_report_templates lab_report_templates_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_report_templates
    ADD CONSTRAINT lab_report_templates_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: lab_report_templates lab_report_templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_report_templates
    ADD CONSTRAINT lab_report_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_result_amendments lab_result_amendments_amended_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_amendments
    ADD CONSTRAINT lab_result_amendments_amended_by_fkey FOREIGN KEY (amended_by) REFERENCES public.users(id);


--
-- Name: lab_result_amendments lab_result_amendments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_amendments
    ADD CONSTRAINT lab_result_amendments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_results lab_results_entered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_entered_by_fkey FOREIGN KEY (entered_by) REFERENCES public.users(id);


--
-- Name: lab_results lab_results_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_sample_archive lab_sample_archive_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_sample_archive
    ADD CONSTRAINT lab_sample_archive_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES public.users(id);


--
-- Name: lab_sample_archive lab_sample_archive_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_sample_archive
    ADD CONSTRAINT lab_sample_archive_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: lab_sample_archive lab_sample_archive_retrieved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_sample_archive
    ADD CONSTRAINT lab_sample_archive_retrieved_by_fkey FOREIGN KEY (retrieved_by) REFERENCES public.users(id);


--
-- Name: lab_sample_archive lab_sample_archive_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_sample_archive
    ADD CONSTRAINT lab_sample_archive_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_sample_rejections lab_sample_rejections_rejected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_sample_rejections
    ADD CONSTRAINT lab_sample_rejections_rejected_by_fkey FOREIGN KEY (rejected_by) REFERENCES public.users(id);


--
-- Name: lab_sample_rejections lab_sample_rejections_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_sample_rejections
    ADD CONSTRAINT lab_sample_rejections_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_sample_routes lab_sample_routes_dest_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_sample_routes
    ADD CONSTRAINT lab_sample_routes_dest_tenant_id_fkey FOREIGN KEY (dest_tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_sample_routes lab_sample_routes_source_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_sample_routes
    ADD CONSTRAINT lab_sample_routes_source_tenant_id_fkey FOREIGN KEY (source_tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_test_catalog lab_test_catalog_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_test_catalog
    ADD CONSTRAINT lab_test_catalog_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: lab_test_catalog lab_test_catalog_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_test_catalog
    ADD CONSTRAINT lab_test_catalog_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lab_test_panels lab_test_panels_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_test_panels
    ADD CONSTRAINT lab_test_panels_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: labor_records labor_records_attending_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labor_records
    ADD CONSTRAINT labor_records_attending_doctor_id_fkey FOREIGN KEY (attending_doctor_id) REFERENCES public.users(id);


--
-- Name: labor_records labor_records_midwife_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labor_records
    ADD CONSTRAINT labor_records_midwife_id_fkey FOREIGN KEY (midwife_id) REFERENCES public.users(id);


--
-- Name: labor_records labor_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labor_records
    ADD CONSTRAINT labor_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: laundry_batches laundry_batches_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.laundry_batches
    ADD CONSTRAINT laundry_batches_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: leave_applications leave_applications_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_applications
    ADD CONSTRAINT leave_applications_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: leave_applications leave_applications_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_applications
    ADD CONSTRAINT leave_applications_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id);


--
-- Name: leave_applications leave_applications_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_applications
    ADD CONSTRAINT leave_applications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: leave_balances leave_balances_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: leave_requests leave_requests_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id);


--
-- Name: leave_requests leave_requests_cancelled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.users(id);


--
-- Name: leave_requests leave_requests_hod_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_hod_id_fkey FOREIGN KEY (hod_id) REFERENCES public.users(id);


--
-- Name: leave_requests leave_requests_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: linen_condemnations linen_condemnations_condemned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linen_condemnations
    ADD CONSTRAINT linen_condemnations_condemned_by_fkey FOREIGN KEY (condemned_by) REFERENCES public.users(id);


--
-- Name: linen_condemnations linen_condemnations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linen_condemnations
    ADD CONSTRAINT linen_condemnations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: linen_items linen_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linen_items
    ADD CONSTRAINT linen_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: linen_items linen_items_ward_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linen_items
    ADD CONSTRAINT linen_items_ward_id_fkey FOREIGN KEY (ward_id) REFERENCES public.locations(id);


--
-- Name: linen_movements linen_movements_from_ward_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linen_movements
    ADD CONSTRAINT linen_movements_from_ward_fkey FOREIGN KEY (from_ward) REFERENCES public.locations(id);


--
-- Name: linen_movements linen_movements_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linen_movements
    ADD CONSTRAINT linen_movements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: linen_movements linen_movements_to_ward_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linen_movements
    ADD CONSTRAINT linen_movements_to_ward_fkey FOREIGN KEY (to_ward) REFERENCES public.locations(id);


--
-- Name: linen_par_levels linen_par_levels_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linen_par_levels
    ADD CONSTRAINT linen_par_levels_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: linen_par_levels linen_par_levels_ward_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linen_par_levels
    ADD CONSTRAINT linen_par_levels_ward_id_fkey FOREIGN KEY (ward_id) REFERENCES public.locations(id);


--
-- Name: lms_certificates lms_certificates_issued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_certificates
    ADD CONSTRAINT lms_certificates_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.users(id);


--
-- Name: lms_certificates lms_certificates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_certificates
    ADD CONSTRAINT lms_certificates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lms_certificates lms_certificates_training_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_certificates
    ADD CONSTRAINT lms_certificates_training_record_id_fkey FOREIGN KEY (training_record_id) REFERENCES public.training_records(id);


--
-- Name: lms_certificates lms_certificates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_certificates
    ADD CONSTRAINT lms_certificates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: lms_courses lms_courses_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_courses
    ADD CONSTRAINT lms_courses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: lms_courses lms_courses_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_courses
    ADD CONSTRAINT lms_courses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lms_courses lms_courses_training_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_courses
    ADD CONSTRAINT lms_courses_training_program_id_fkey FOREIGN KEY (training_program_id) REFERENCES public.training_programs(id);


--
-- Name: lms_enrollments lms_enrollments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_enrollments
    ADD CONSTRAINT lms_enrollments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: lms_enrollments lms_enrollments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_enrollments
    ADD CONSTRAINT lms_enrollments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lms_enrollments lms_enrollments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_enrollments
    ADD CONSTRAINT lms_enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: lms_learning_paths lms_learning_paths_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_learning_paths
    ADD CONSTRAINT lms_learning_paths_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: lms_learning_paths lms_learning_paths_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_learning_paths
    ADD CONSTRAINT lms_learning_paths_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: mass_casualty_events mass_casualty_events_activated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mass_casualty_events
    ADD CONSTRAINT mass_casualty_events_activated_by_fkey FOREIGN KEY (activated_by) REFERENCES public.users(id);


--
-- Name: mass_casualty_events mass_casualty_events_deactivated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mass_casualty_events
    ADD CONSTRAINT mass_casualty_events_deactivated_by_fkey FOREIGN KEY (deactivated_by) REFERENCES public.users(id);


--
-- Name: mass_casualty_events mass_casualty_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mass_casualty_events
    ADD CONSTRAINT mass_casualty_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: master_insurance_providers master_insurance_providers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_insurance_providers
    ADD CONSTRAINT master_insurance_providers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: master_occupations master_occupations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_occupations
    ADD CONSTRAINT master_occupations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: master_relations master_relations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_relations
    ADD CONSTRAINT master_relations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: master_religions master_religions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_religions
    ADD CONSTRAINT master_religions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: materiovigilance_reports materiovigilance_reports_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materiovigilance_reports
    ADD CONSTRAINT materiovigilance_reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: materiovigilance_reports materiovigilance_reports_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materiovigilance_reports
    ADD CONSTRAINT materiovigilance_reports_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: materiovigilance_reports materiovigilance_reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materiovigilance_reports
    ADD CONSTRAINT materiovigilance_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users(id);


--
-- Name: materiovigilance_reports materiovigilance_reports_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materiovigilance_reports
    ADD CONSTRAINT materiovigilance_reports_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: materiovigilance_reports materiovigilance_reports_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materiovigilance_reports
    ADD CONSTRAINT materiovigilance_reports_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: maternity_registrations maternity_registrations_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maternity_registrations
    ADD CONSTRAINT maternity_registrations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: maternity_registrations maternity_registrations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maternity_registrations
    ADD CONSTRAINT maternity_registrations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: meal_counts meal_counts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_counts
    ADD CONSTRAINT meal_counts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: meal_preparations meal_preparations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_preparations
    ADD CONSTRAINT meal_preparations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: medical_certificates medical_certificates_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_certificates
    ADD CONSTRAINT medical_certificates_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: medical_certificates medical_certificates_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_certificates
    ADD CONSTRAINT medical_certificates_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: medical_certificates medical_certificates_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_certificates
    ADD CONSTRAINT medical_certificates_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: medical_certificates medical_certificates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_certificates
    ADD CONSTRAINT medical_certificates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: medical_certificates medical_certificates_voided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_certificates
    ADD CONSTRAINT medical_certificates_voided_by_fkey FOREIGN KEY (voided_by) REFERENCES public.users(id);


--
-- Name: medication_administration_records medication_administration_records_administered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_administration_records
    ADD CONSTRAINT medication_administration_records_administered_by_fkey FOREIGN KEY (administered_by) REFERENCES public.users(id);


--
-- Name: medication_administration_records medication_administration_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_administration_records
    ADD CONSTRAINT medication_administration_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: medication_administration_records medication_administration_records_witness_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_administration_records
    ADD CONSTRAINT medication_administration_records_witness_user_id_fkey FOREIGN KEY (witness_user_id) REFERENCES public.users(id);


--
-- Name: medication_timeline_events medication_timeline_events_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_timeline_events
    ADD CONSTRAINT medication_timeline_events_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.pharmacy_catalog(id);


--
-- Name: medication_timeline_events medication_timeline_events_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_timeline_events
    ADD CONSTRAINT medication_timeline_events_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: medication_timeline_events medication_timeline_events_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_timeline_events
    ADD CONSTRAINT medication_timeline_events_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.chronic_enrollments(id);


--
-- Name: medication_timeline_events medication_timeline_events_ordered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_timeline_events
    ADD CONSTRAINT medication_timeline_events_ordered_by_fkey FOREIGN KEY (ordered_by) REFERENCES public.users(id);


--
-- Name: medication_timeline_events medication_timeline_events_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_timeline_events
    ADD CONSTRAINT medication_timeline_events_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: medication_timeline_events medication_timeline_events_prescription_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_timeline_events
    ADD CONSTRAINT medication_timeline_events_prescription_item_id_fkey FOREIGN KEY (prescription_item_id) REFERENCES public.prescription_items(id);


--
-- Name: medication_timeline_events medication_timeline_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_timeline_events
    ADD CONSTRAINT medication_timeline_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: mlc_cases mlc_cases_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mlc_cases
    ADD CONSTRAINT mlc_cases_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: mlc_cases mlc_cases_registered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mlc_cases
    ADD CONSTRAINT mlc_cases_registered_by_fkey FOREIGN KEY (registered_by) REFERENCES public.users(id);


--
-- Name: mlc_cases mlc_cases_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mlc_cases
    ADD CONSTRAINT mlc_cases_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: mlc_documents mlc_documents_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mlc_documents
    ADD CONSTRAINT mlc_documents_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.users(id);


--
-- Name: mlc_documents mlc_documents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mlc_documents
    ADD CONSTRAINT mlc_documents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: mlc_documents mlc_documents_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mlc_documents
    ADD CONSTRAINT mlc_documents_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: mlc_police_intimations mlc_police_intimations_sent_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mlc_police_intimations
    ADD CONSTRAINT mlc_police_intimations_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES public.users(id);


--
-- Name: mlc_police_intimations mlc_police_intimations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mlc_police_intimations
    ADD CONSTRAINT mlc_police_intimations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: module_config module_config_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_config
    ADD CONSTRAINT module_config_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: module_sidecars module_sidecars_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_sidecars
    ADD CONSTRAINT module_sidecars_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: module_sidecars module_sidecars_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_sidecars
    ADD CONSTRAINT module_sidecars_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: mortuary_records mortuary_records_released_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mortuary_records
    ADD CONSTRAINT mortuary_records_released_by_fkey FOREIGN KEY (released_by) REFERENCES public.users(id);


--
-- Name: mortuary_records mortuary_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mortuary_records
    ADD CONSTRAINT mortuary_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: mrd_birth_register mrd_birth_register_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_birth_register
    ADD CONSTRAINT mrd_birth_register_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: mrd_birth_register mrd_birth_register_attending_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_birth_register
    ADD CONSTRAINT mrd_birth_register_attending_doctor_id_fkey FOREIGN KEY (attending_doctor_id) REFERENCES public.users(id);


--
-- Name: mrd_birth_register mrd_birth_register_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_birth_register
    ADD CONSTRAINT mrd_birth_register_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: mrd_birth_register mrd_birth_register_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_birth_register
    ADD CONSTRAINT mrd_birth_register_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: mrd_birth_register mrd_birth_register_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_birth_register
    ADD CONSTRAINT mrd_birth_register_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: mrd_death_register mrd_death_register_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_death_register
    ADD CONSTRAINT mrd_death_register_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: mrd_death_register mrd_death_register_certifying_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_death_register
    ADD CONSTRAINT mrd_death_register_certifying_doctor_id_fkey FOREIGN KEY (certifying_doctor_id) REFERENCES public.users(id);


--
-- Name: mrd_death_register mrd_death_register_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_death_register
    ADD CONSTRAINT mrd_death_register_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: mrd_death_register mrd_death_register_er_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_death_register
    ADD CONSTRAINT mrd_death_register_er_visit_id_fkey FOREIGN KEY (er_visit_id) REFERENCES public.er_visits(id);


--
-- Name: mrd_death_register mrd_death_register_mlc_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_death_register
    ADD CONSTRAINT mrd_death_register_mlc_case_id_fkey FOREIGN KEY (mlc_case_id) REFERENCES public.mlc_cases(id);


--
-- Name: mrd_death_register mrd_death_register_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_death_register
    ADD CONSTRAINT mrd_death_register_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: mrd_death_register mrd_death_register_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_death_register
    ADD CONSTRAINT mrd_death_register_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: mrd_form_records mrd_form_records_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_form_records
    ADD CONSTRAINT mrd_form_records_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: mrd_form_records mrd_form_records_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_form_records
    ADD CONSTRAINT mrd_form_records_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id);


--
-- Name: mrd_form_records mrd_form_records_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_form_records
    ADD CONSTRAINT mrd_form_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: mrd_form_records mrd_form_records_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_form_records
    ADD CONSTRAINT mrd_form_records_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.document_templates(id);


--
-- Name: mrd_form_records mrd_form_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_form_records
    ADD CONSTRAINT mrd_form_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: mrd_form_records mrd_form_records_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_form_records
    ADD CONSTRAINT mrd_form_records_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: mrd_medical_records mrd_medical_records_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_medical_records
    ADD CONSTRAINT mrd_medical_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: mrd_medical_records mrd_medical_records_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_medical_records
    ADD CONSTRAINT mrd_medical_records_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: mrd_medical_records mrd_medical_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_medical_records
    ADD CONSTRAINT mrd_medical_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: mrd_record_movements mrd_record_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_record_movements
    ADD CONSTRAINT mrd_record_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: mrd_record_movements mrd_record_movements_issued_to_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_record_movements
    ADD CONSTRAINT mrd_record_movements_issued_to_department_id_fkey FOREIGN KEY (issued_to_department_id) REFERENCES public.departments(id);


--
-- Name: mrd_record_movements mrd_record_movements_issued_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_record_movements
    ADD CONSTRAINT mrd_record_movements_issued_to_user_id_fkey FOREIGN KEY (issued_to_user_id) REFERENCES public.users(id);


--
-- Name: mrd_record_movements mrd_record_movements_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_record_movements
    ADD CONSTRAINT mrd_record_movements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: mrd_retention_policies mrd_retention_policies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_retention_policies
    ADD CONSTRAINT mrd_retention_policies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: mrd_retention_policies mrd_retention_policies_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_retention_policies
    ADD CONSTRAINT mrd_retention_policies_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: multi_doctor_appointments multi_doctor_appointments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.multi_doctor_appointments
    ADD CONSTRAINT multi_doctor_appointments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: multi_doctor_appointments multi_doctor_appointments_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.multi_doctor_appointments
    ADD CONSTRAINT multi_doctor_appointments_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: multi_doctor_appointments multi_doctor_appointments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.multi_doctor_appointments
    ADD CONSTRAINT multi_doctor_appointments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: needle_stick_incidents needle_stick_incidents_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.needle_stick_incidents
    ADD CONSTRAINT needle_stick_incidents_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: needle_stick_incidents needle_stick_incidents_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.needle_stick_incidents
    ADD CONSTRAINT needle_stick_incidents_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: needle_stick_incidents needle_stick_incidents_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.needle_stick_incidents
    ADD CONSTRAINT needle_stick_incidents_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id);


--
-- Name: needle_stick_incidents needle_stick_incidents_source_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.needle_stick_incidents
    ADD CONSTRAINT needle_stick_incidents_source_patient_id_fkey FOREIGN KEY (source_patient_id) REFERENCES public.patients(id);


--
-- Name: needle_stick_incidents needle_stick_incidents_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.needle_stick_incidents
    ADD CONSTRAINT needle_stick_incidents_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.users(id);


--
-- Name: needle_stick_incidents needle_stick_incidents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.needle_stick_incidents
    ADD CONSTRAINT needle_stick_incidents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: newborn_records newborn_records_labor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newborn_records
    ADD CONSTRAINT newborn_records_labor_id_fkey FOREIGN KEY (labor_id) REFERENCES public.labor_records(id);


--
-- Name: newborn_records newborn_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newborn_records
    ADD CONSTRAINT newborn_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: noshow_prediction_scores noshow_prediction_scores_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.noshow_prediction_scores
    ADD CONSTRAINT noshow_prediction_scores_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: noshow_prediction_scores noshow_prediction_scores_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.noshow_prediction_scores
    ADD CONSTRAINT noshow_prediction_scores_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: nuclear_med_administrations nuclear_med_administrations_administered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nuclear_med_administrations
    ADD CONSTRAINT nuclear_med_administrations_administered_by_fkey FOREIGN KEY (administered_by) REFERENCES public.users(id);


--
-- Name: nuclear_med_administrations nuclear_med_administrations_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nuclear_med_administrations
    ADD CONSTRAINT nuclear_med_administrations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: nuclear_med_administrations nuclear_med_administrations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nuclear_med_administrations
    ADD CONSTRAINT nuclear_med_administrations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: nuclear_med_sources nuclear_med_sources_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nuclear_med_sources
    ADD CONSTRAINT nuclear_med_sources_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: nurse_profiles nurse_profiles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nurse_profiles
    ADD CONSTRAINT nurse_profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: nurse_profiles nurse_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nurse_profiles
    ADD CONSTRAINT nurse_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: nurse_shift_assignments nurse_shift_assignments_charge_nurse_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nurse_shift_assignments
    ADD CONSTRAINT nurse_shift_assignments_charge_nurse_user_id_fkey FOREIGN KEY (charge_nurse_user_id) REFERENCES public.users(id);


--
-- Name: nurse_shift_assignments nurse_shift_assignments_nurse_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nurse_shift_assignments
    ADD CONSTRAINT nurse_shift_assignments_nurse_user_id_fkey FOREIGN KEY (nurse_user_id) REFERENCES public.users(id);


--
-- Name: nurse_shift_assignments nurse_shift_assignments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nurse_shift_assignments
    ADD CONSTRAINT nurse_shift_assignments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: nursing_tasks nursing_tasks_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nursing_tasks
    ADD CONSTRAINT nursing_tasks_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: nursing_tasks nursing_tasks_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nursing_tasks
    ADD CONSTRAINT nursing_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: nursing_tasks nursing_tasks_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nursing_tasks
    ADD CONSTRAINT nursing_tasks_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id);


--
-- Name: nursing_tasks nursing_tasks_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nursing_tasks
    ADD CONSTRAINT nursing_tasks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: occ_health_drug_screens occ_health_drug_screens_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occ_health_drug_screens
    ADD CONSTRAINT occ_health_drug_screens_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: occ_health_drug_screens occ_health_drug_screens_mro_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occ_health_drug_screens
    ADD CONSTRAINT occ_health_drug_screens_mro_reviewer_id_fkey FOREIGN KEY (mro_reviewer_id) REFERENCES public.users(id);


--
-- Name: occ_health_drug_screens occ_health_drug_screens_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occ_health_drug_screens
    ADD CONSTRAINT occ_health_drug_screens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: occ_health_injury_reports occ_health_injury_reports_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occ_health_injury_reports
    ADD CONSTRAINT occ_health_injury_reports_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: occ_health_injury_reports occ_health_injury_reports_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occ_health_injury_reports
    ADD CONSTRAINT occ_health_injury_reports_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id);


--
-- Name: occ_health_injury_reports occ_health_injury_reports_rtw_cleared_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occ_health_injury_reports
    ADD CONSTRAINT occ_health_injury_reports_rtw_cleared_by_fkey FOREIGN KEY (rtw_cleared_by) REFERENCES public.users(id);


--
-- Name: occ_health_injury_reports occ_health_injury_reports_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occ_health_injury_reports
    ADD CONSTRAINT occ_health_injury_reports_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: occ_health_screenings occ_health_screenings_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occ_health_screenings
    ADD CONSTRAINT occ_health_screenings_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: occ_health_screenings occ_health_screenings_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occ_health_screenings
    ADD CONSTRAINT occ_health_screenings_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: occ_health_screenings occ_health_screenings_examiner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occ_health_screenings
    ADD CONSTRAINT occ_health_screenings_examiner_id_fkey FOREIGN KEY (examiner_id) REFERENCES public.users(id);


--
-- Name: occ_health_screenings occ_health_screenings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occ_health_screenings
    ADD CONSTRAINT occ_health_screenings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: occ_health_vaccinations occ_health_vaccinations_administered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occ_health_vaccinations
    ADD CONSTRAINT occ_health_vaccinations_administered_by_fkey FOREIGN KEY (administered_by) REFERENCES public.users(id);


--
-- Name: occ_health_vaccinations occ_health_vaccinations_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occ_health_vaccinations
    ADD CONSTRAINT occ_health_vaccinations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: occ_health_vaccinations occ_health_vaccinations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occ_health_vaccinations
    ADD CONSTRAINT occ_health_vaccinations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: on_call_schedules on_call_schedules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.on_call_schedules
    ADD CONSTRAINT on_call_schedules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: on_call_schedules on_call_schedules_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.on_call_schedules
    ADD CONSTRAINT on_call_schedules_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: on_call_schedules on_call_schedules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.on_call_schedules
    ADD CONSTRAINT on_call_schedules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: onboarding_progress onboarding_progress_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_progress
    ADD CONSTRAINT onboarding_progress_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: opd_queues opd_queues_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opd_queues
    ADD CONSTRAINT opd_queues_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: opd_queues opd_queues_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opd_queues
    ADD CONSTRAINT opd_queues_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: opd_queues opd_queues_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opd_queues
    ADD CONSTRAINT opd_queues_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: opd_queues opd_queues_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opd_queues
    ADD CONSTRAINT opd_queues_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: order_basket_drafts order_basket_drafts_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_basket_drafts
    ADD CONSTRAINT order_basket_drafts_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: order_basket_drafts order_basket_drafts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_basket_drafts
    ADD CONSTRAINT order_basket_drafts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: order_basket_signatures order_basket_signatures_signed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_basket_signatures
    ADD CONSTRAINT order_basket_signatures_signed_by_fkey FOREIGN KEY (signed_by) REFERENCES public.users(id);


--
-- Name: order_basket_signatures order_basket_signatures_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_basket_signatures
    ADD CONSTRAINT order_basket_signatures_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: order_set_activation_items order_set_activation_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_activation_items
    ADD CONSTRAINT order_set_activation_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: order_set_activations order_set_activations_activated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_activations
    ADD CONSTRAINT order_set_activations_activated_by_fkey FOREIGN KEY (activated_by) REFERENCES public.users(id);


--
-- Name: order_set_activations order_set_activations_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_activations
    ADD CONSTRAINT order_set_activations_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: order_set_activations order_set_activations_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_activations
    ADD CONSTRAINT order_set_activations_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: order_set_activations order_set_activations_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_activations
    ADD CONSTRAINT order_set_activations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: order_set_activations order_set_activations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_activations
    ADD CONSTRAINT order_set_activations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: order_set_template_items order_set_template_items_diet_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_template_items
    ADD CONSTRAINT order_set_template_items_diet_template_id_fkey FOREIGN KEY (diet_template_id) REFERENCES public.diet_templates(id);


--
-- Name: order_set_template_items order_set_template_items_drug_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_template_items
    ADD CONSTRAINT order_set_template_items_drug_catalog_id_fkey FOREIGN KEY (drug_catalog_id) REFERENCES public.pharmacy_catalog(id);


--
-- Name: order_set_template_items order_set_template_items_lab_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_template_items
    ADD CONSTRAINT order_set_template_items_lab_test_id_fkey FOREIGN KEY (lab_test_id) REFERENCES public.lab_test_catalog(id);


--
-- Name: order_set_template_items order_set_template_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_template_items
    ADD CONSTRAINT order_set_template_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: order_set_templates order_set_templates_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_templates
    ADD CONSTRAINT order_set_templates_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: order_set_templates order_set_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_templates
    ADD CONSTRAINT order_set_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: order_set_templates order_set_templates_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_templates
    ADD CONSTRAINT order_set_templates_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: order_set_templates order_set_templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_templates
    ADD CONSTRAINT order_set_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: order_set_usage_stats order_set_usage_stats_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_usage_stats
    ADD CONSTRAINT order_set_usage_stats_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ot_anesthesia_records ot_anesthesia_records_anesthetist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_anesthesia_records
    ADD CONSTRAINT ot_anesthesia_records_anesthetist_id_fkey FOREIGN KEY (anesthetist_id) REFERENCES public.users(id);


--
-- Name: ot_anesthesia_records ot_anesthesia_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_anesthesia_records
    ADD CONSTRAINT ot_anesthesia_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ot_bookings ot_bookings_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_bookings
    ADD CONSTRAINT ot_bookings_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: ot_bookings ot_bookings_anesthetist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_bookings
    ADD CONSTRAINT ot_bookings_anesthetist_id_fkey FOREIGN KEY (anesthetist_id) REFERENCES public.users(id);


--
-- Name: ot_bookings ot_bookings_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_bookings
    ADD CONSTRAINT ot_bookings_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: ot_bookings ot_bookings_primary_surgeon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_bookings
    ADD CONSTRAINT ot_bookings_primary_surgeon_id_fkey FOREIGN KEY (primary_surgeon_id) REFERENCES public.users(id);


--
-- Name: ot_bookings ot_bookings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_bookings
    ADD CONSTRAINT ot_bookings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ot_case_records ot_case_records_surgeon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_case_records
    ADD CONSTRAINT ot_case_records_surgeon_id_fkey FOREIGN KEY (surgeon_id) REFERENCES public.users(id);


--
-- Name: ot_case_records ot_case_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_case_records
    ADD CONSTRAINT ot_case_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ot_consumable_usage ot_consumable_usage_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_consumable_usage
    ADD CONSTRAINT ot_consumable_usage_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: ot_consumable_usage ot_consumable_usage_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_consumable_usage
    ADD CONSTRAINT ot_consumable_usage_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ot_postop_records ot_postop_records_destination_bed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_postop_records
    ADD CONSTRAINT ot_postop_records_destination_bed_id_fkey FOREIGN KEY (destination_bed_id) REFERENCES public.locations(id);


--
-- Name: ot_postop_records ot_postop_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_postop_records
    ADD CONSTRAINT ot_postop_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ot_preop_assessments ot_preop_assessments_assessed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_preop_assessments
    ADD CONSTRAINT ot_preop_assessments_assessed_by_fkey FOREIGN KEY (assessed_by) REFERENCES public.users(id);


--
-- Name: ot_preop_assessments ot_preop_assessments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_preop_assessments
    ADD CONSTRAINT ot_preop_assessments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ot_rooms ot_rooms_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_rooms
    ADD CONSTRAINT ot_rooms_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: ot_rooms ot_rooms_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_rooms
    ADD CONSTRAINT ot_rooms_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ot_surgeon_preferences ot_surgeon_preferences_surgeon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_surgeon_preferences
    ADD CONSTRAINT ot_surgeon_preferences_surgeon_id_fkey FOREIGN KEY (surgeon_id) REFERENCES public.users(id);


--
-- Name: ot_surgeon_preferences ot_surgeon_preferences_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_surgeon_preferences
    ADD CONSTRAINT ot_surgeon_preferences_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ot_surgical_safety_checklists ot_surgical_safety_checklists_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_surgical_safety_checklists
    ADD CONSTRAINT ot_surgical_safety_checklists_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id);


--
-- Name: ot_surgical_safety_checklists ot_surgical_safety_checklists_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_surgical_safety_checklists
    ADD CONSTRAINT ot_surgical_safety_checklists_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ot_surgical_safety_checklists ot_surgical_safety_checklists_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_surgical_safety_checklists
    ADD CONSTRAINT ot_surgical_safety_checklists_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: outbox_dlq outbox_dlq_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_dlq
    ADD CONSTRAINT outbox_dlq_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: outbox_events outbox_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_events
    ADD CONSTRAINT outbox_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: outbreak_contacts outbreak_contacts_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbreak_contacts
    ADD CONSTRAINT outbreak_contacts_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: outbreak_contacts outbreak_contacts_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbreak_contacts
    ADD CONSTRAINT outbreak_contacts_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.users(id);


--
-- Name: outbreak_contacts outbreak_contacts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbreak_contacts
    ADD CONSTRAINT outbreak_contacts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: outbreak_events outbreak_events_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbreak_events
    ADD CONSTRAINT outbreak_events_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: outbreak_events outbreak_events_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbreak_events
    ADD CONSTRAINT outbreak_events_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: outbreak_events outbreak_events_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbreak_events
    ADD CONSTRAINT outbreak_events_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id);


--
-- Name: outbreak_events outbreak_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbreak_events
    ADD CONSTRAINT outbreak_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pa_requirement_rules pa_requirement_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pa_requirement_rules
    ADD CONSTRAINT pa_requirement_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: pa_requirement_rules pa_requirement_rules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pa_requirement_rules
    ADD CONSTRAINT pa_requirement_rules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pain_assessments pain_assessments_assessed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pain_assessments
    ADD CONSTRAINT pain_assessments_assessed_by_fkey FOREIGN KEY (assessed_by) REFERENCES public.users(id);


--
-- Name: pain_assessments pain_assessments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pain_assessments
    ADD CONSTRAINT pain_assessments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: pain_assessments pain_assessments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pain_assessments
    ADD CONSTRAINT pain_assessments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pain_score_entries pain_score_entries_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pain_score_entries
    ADD CONSTRAINT pain_score_entries_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: pain_score_entries pain_score_entries_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pain_score_entries
    ADD CONSTRAINT pain_score_entries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: patient_abha_links patient_abha_links_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_abha_links
    ADD CONSTRAINT patient_abha_links_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: patient_addresses patient_addresses_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_addresses
    ADD CONSTRAINT patient_addresses_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.geo_countries(id);


--
-- Name: patient_addresses patient_addresses_district_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_addresses
    ADD CONSTRAINT patient_addresses_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.geo_districts(id);


--
-- Name: patient_addresses patient_addresses_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_addresses
    ADD CONSTRAINT patient_addresses_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.geo_states(id);


--
-- Name: patient_addresses patient_addresses_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_addresses
    ADD CONSTRAINT patient_addresses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: patient_advances patient_advances_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_advances
    ADD CONSTRAINT patient_advances_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: patient_advances patient_advances_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_advances
    ADD CONSTRAINT patient_advances_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: patient_allergies patient_allergies_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_allergies
    ADD CONSTRAINT patient_allergies_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: patient_consents patient_consents_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_consents
    ADD CONSTRAINT patient_consents_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: patient_consents patient_consents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_consents
    ADD CONSTRAINT patient_consents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: patient_consumable_issues patient_consumable_issues_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_consumable_issues
    ADD CONSTRAINT patient_consumable_issues_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: patient_consumable_issues patient_consumable_issues_issued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_consumable_issues
    ADD CONSTRAINT patient_consumable_issues_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.users(id);


--
-- Name: patient_consumable_issues patient_consumable_issues_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_consumable_issues
    ADD CONSTRAINT patient_consumable_issues_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: patient_consumable_issues patient_consumable_issues_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_consumable_issues
    ADD CONSTRAINT patient_consumable_issues_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: patient_contacts patient_contacts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_contacts
    ADD CONSTRAINT patient_contacts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: patient_documents patient_documents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_documents
    ADD CONSTRAINT patient_documents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: patient_documents patient_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_documents
    ADD CONSTRAINT patient_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: patient_education patient_education_provided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_education
    ADD CONSTRAINT patient_education_provided_by_fkey FOREIGN KEY (provided_by) REFERENCES public.users(id);


--
-- Name: patient_education patient_education_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_education
    ADD CONSTRAINT patient_education_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: patient_family_links patient_family_links_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_family_links
    ADD CONSTRAINT patient_family_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: patient_family_links patient_family_links_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_family_links
    ADD CONSTRAINT patient_family_links_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: patient_feedback patient_feedback_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_feedback
    ADD CONSTRAINT patient_feedback_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: patient_feedback patient_feedback_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_feedback
    ADD CONSTRAINT patient_feedback_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: patient_feedback patient_feedback_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_feedback
    ADD CONSTRAINT patient_feedback_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: patient_feedback patient_feedback_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_feedback
    ADD CONSTRAINT patient_feedback_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: patient_identifiers patient_identifiers_issuing_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_identifiers
    ADD CONSTRAINT patient_identifiers_issuing_country_id_fkey FOREIGN KEY (issuing_country_id) REFERENCES public.geo_countries(id);


--
-- Name: patient_identifiers patient_identifiers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_identifiers
    ADD CONSTRAINT patient_identifiers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: patient_insurance patient_insurance_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_insurance
    ADD CONSTRAINT patient_insurance_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: patient_insurance patient_insurance_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_insurance
    ADD CONSTRAINT patient_insurance_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: patient_merge_history patient_merge_history_merged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_merge_history
    ADD CONSTRAINT patient_merge_history_merged_by_fkey FOREIGN KEY (merged_by) REFERENCES public.users(id);


--
-- Name: patient_merge_history patient_merge_history_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_merge_history
    ADD CONSTRAINT patient_merge_history_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: patient_merge_history patient_merge_history_unmerged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_merge_history
    ADD CONSTRAINT patient_merge_history_unmerged_by_fkey FOREIGN KEY (unmerged_by) REFERENCES public.users(id);


--
-- Name: patient_outcome_targets patient_outcome_targets_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_outcome_targets
    ADD CONSTRAINT patient_outcome_targets_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.chronic_enrollments(id);


--
-- Name: patient_outcome_targets patient_outcome_targets_set_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_outcome_targets
    ADD CONSTRAINT patient_outcome_targets_set_by_fkey FOREIGN KEY (set_by) REFERENCES public.users(id);


--
-- Name: patient_outcome_targets patient_outcome_targets_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_outcome_targets
    ADD CONSTRAINT patient_outcome_targets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: patient_package_consumptions patient_package_consumptions_consumed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_package_consumptions
    ADD CONSTRAINT patient_package_consumptions_consumed_by_user_id_fkey FOREIGN KEY (consumed_by_user_id) REFERENCES public.users(id);


--
-- Name: patient_package_consumptions patient_package_consumptions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_package_consumptions
    ADD CONSTRAINT patient_package_consumptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: patient_package_subscriptions patient_package_subscriptions_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_package_subscriptions
    ADD CONSTRAINT patient_package_subscriptions_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.doctor_packages(id);


--
-- Name: patient_package_subscriptions patient_package_subscriptions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_package_subscriptions
    ADD CONSTRAINT patient_package_subscriptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: patient_reminders patient_reminders_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_reminders
    ADD CONSTRAINT patient_reminders_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: patient_reminders patient_reminders_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_reminders
    ADD CONSTRAINT patient_reminders_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: patient_reminders patient_reminders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_reminders
    ADD CONSTRAINT patient_reminders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: patient_transfers patient_transfers_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_transfers
    ADD CONSTRAINT patient_transfers_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: patient_transfers patient_transfers_dest_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_transfers
    ADD CONSTRAINT patient_transfers_dest_tenant_id_fkey FOREIGN KEY (dest_tenant_id) REFERENCES public.tenants(id);


--
-- Name: patient_transfers patient_transfers_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_transfers
    ADD CONSTRAINT patient_transfers_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id);


--
-- Name: patient_transfers patient_transfers_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_transfers
    ADD CONSTRAINT patient_transfers_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: patient_transfers patient_transfers_source_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_transfers
    ADD CONSTRAINT patient_transfers_source_tenant_id_fkey FOREIGN KEY (source_tenant_id) REFERENCES public.tenants(id);


--
-- Name: patients patients_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: patients patients_nationality_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_nationality_id_fkey FOREIGN KEY (nationality_id) REFERENCES public.geo_countries(id);


--
-- Name: patients patients_registered_at_facility_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_registered_at_facility_fkey FOREIGN KEY (registered_at_facility) REFERENCES public.facilities(id);


--
-- Name: patients patients_registered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_registered_by_fkey FOREIGN KEY (registered_by) REFERENCES public.users(id);


--
-- Name: patients patients_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: payment_gateway_transactions payment_gateway_transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_gateway_transactions
    ADD CONSTRAINT payment_gateway_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: payment_gateway_transactions payment_gateway_transactions_pharmacy_pos_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_gateway_transactions
    ADD CONSTRAINT payment_gateway_transactions_pharmacy_pos_sale_id_fkey FOREIGN KEY (pharmacy_pos_sale_id) REFERENCES public.pharmacy_pos_sales(id);


--
-- Name: payment_gateway_transactions payment_gateway_transactions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_gateway_transactions
    ADD CONSTRAINT payment_gateway_transactions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: payment_methods payment_methods_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: payments payments_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id);


--
-- Name: payments payments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pcpndt_equipment pcpndt_equipment_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pcpndt_equipment
    ADD CONSTRAINT pcpndt_equipment_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pcpndt_forms pcpndt_forms_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pcpndt_forms
    ADD CONSTRAINT pcpndt_forms_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: pcpndt_forms pcpndt_forms_patient_consent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pcpndt_forms
    ADD CONSTRAINT pcpndt_forms_patient_consent_id_fkey FOREIGN KEY (patient_consent_id) REFERENCES public.patient_consents(id);


--
-- Name: pcpndt_forms pcpndt_forms_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pcpndt_forms
    ADD CONSTRAINT pcpndt_forms_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: pcpndt_forms pcpndt_forms_performing_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pcpndt_forms
    ADD CONSTRAINT pcpndt_forms_performing_doctor_id_fkey FOREIGN KEY (performing_doctor_id) REFERENCES public.users(id);


--
-- Name: pcpndt_forms pcpndt_forms_referral_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pcpndt_forms
    ADD CONSTRAINT pcpndt_forms_referral_doctor_id_fkey FOREIGN KEY (referral_doctor_id) REFERENCES public.users(id);


--
-- Name: pcpndt_forms pcpndt_forms_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pcpndt_forms
    ADD CONSTRAINT pcpndt_forms_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pest_control_logs pest_control_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pest_control_logs
    ADD CONSTRAINT pest_control_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pest_control_schedules pest_control_schedules_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pest_control_schedules
    ADD CONSTRAINT pest_control_schedules_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: pest_control_schedules pest_control_schedules_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pest_control_schedules
    ADD CONSTRAINT pest_control_schedules_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: pest_control_schedules pest_control_schedules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pest_control_schedules
    ADD CONSTRAINT pest_control_schedules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pg_logbook_entries pg_logbook_entries_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pg_logbook_entries
    ADD CONSTRAINT pg_logbook_entries_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: pg_logbook_entries pg_logbook_entries_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pg_logbook_entries
    ADD CONSTRAINT pg_logbook_entries_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: pg_logbook_entries pg_logbook_entries_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pg_logbook_entries
    ADD CONSTRAINT pg_logbook_entries_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id);


--
-- Name: pg_logbook_entries pg_logbook_entries_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pg_logbook_entries
    ADD CONSTRAINT pg_logbook_entries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pg_logbook_entries pg_logbook_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pg_logbook_entries
    ADD CONSTRAINT pg_logbook_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: pharmacy_allergy_check_log pharmacy_allergy_check_log_overridden_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_allergy_check_log
    ADD CONSTRAINT pharmacy_allergy_check_log_overridden_by_fkey FOREIGN KEY (overridden_by) REFERENCES public.users(id);


--
-- Name: pharmacy_allergy_check_log pharmacy_allergy_check_log_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_allergy_check_log
    ADD CONSTRAINT pharmacy_allergy_check_log_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: pharmacy_allergy_check_log pharmacy_allergy_check_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_allergy_check_log
    ADD CONSTRAINT pharmacy_allergy_check_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pharmacy_batches pharmacy_batches_grn_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_batches
    ADD CONSTRAINT pharmacy_batches_grn_id_fkey FOREIGN KEY (grn_id) REFERENCES public.goods_receipt_notes(id);


--
-- Name: pharmacy_batches pharmacy_batches_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_batches
    ADD CONSTRAINT pharmacy_batches_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id);


--
-- Name: pharmacy_batches pharmacy_batches_quality_check_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_batches
    ADD CONSTRAINT pharmacy_batches_quality_check_by_fkey FOREIGN KEY (quality_check_by) REFERENCES public.users(id);


--
-- Name: pharmacy_batches pharmacy_batches_store_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_batches
    ADD CONSTRAINT pharmacy_batches_store_location_id_fkey FOREIGN KEY (store_location_id) REFERENCES public.store_locations(id);


--
-- Name: pharmacy_batches pharmacy_batches_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_batches
    ADD CONSTRAINT pharmacy_batches_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pharmacy_batches pharmacy_batches_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_batches
    ADD CONSTRAINT pharmacy_batches_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: pharmacy_cash_drawers pharmacy_cash_drawers_cashier_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_cash_drawers
    ADD CONSTRAINT pharmacy_cash_drawers_cashier_user_id_fkey FOREIGN KEY (cashier_user_id) REFERENCES public.users(id);


--
-- Name: pharmacy_cash_drawers pharmacy_cash_drawers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_cash_drawers
    ADD CONSTRAINT pharmacy_cash_drawers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: pharmacy_cash_float_movements pharmacy_cash_float_movements_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_cash_float_movements
    ADD CONSTRAINT pharmacy_cash_float_movements_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: pharmacy_cash_float_movements pharmacy_cash_float_movements_moved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_cash_float_movements
    ADD CONSTRAINT pharmacy_cash_float_movements_moved_by_fkey FOREIGN KEY (moved_by) REFERENCES public.users(id);


--
-- Name: pharmacy_cash_float_movements pharmacy_cash_float_movements_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_cash_float_movements
    ADD CONSTRAINT pharmacy_cash_float_movements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: pharmacy_cashier_overrides pharmacy_cashier_overrides_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_cashier_overrides
    ADD CONSTRAINT pharmacy_cashier_overrides_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: pharmacy_cashier_overrides pharmacy_cashier_overrides_cashier_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_cashier_overrides
    ADD CONSTRAINT pharmacy_cashier_overrides_cashier_user_id_fkey FOREIGN KEY (cashier_user_id) REFERENCES public.users(id);


--
-- Name: pharmacy_cashier_overrides pharmacy_cashier_overrides_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_cashier_overrides
    ADD CONSTRAINT pharmacy_cashier_overrides_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: pharmacy_catalog pharmacy_catalog_preferred_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_catalog
    ADD CONSTRAINT pharmacy_catalog_preferred_supplier_id_fkey FOREIGN KEY (preferred_supplier_id) REFERENCES public.vendors(id);


--
-- Name: pharmacy_catalog pharmacy_catalog_store_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_catalog
    ADD CONSTRAINT pharmacy_catalog_store_catalog_id_fkey FOREIGN KEY (store_catalog_id) REFERENCES public.store_catalog(id);


--
-- Name: pharmacy_catalog pharmacy_catalog_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_catalog
    ADD CONSTRAINT pharmacy_catalog_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pharmacy_counseling pharmacy_counseling_counselled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_counseling
    ADD CONSTRAINT pharmacy_counseling_counselled_by_fkey FOREIGN KEY (counselled_by) REFERENCES public.users(id);


--
-- Name: pharmacy_counseling pharmacy_counseling_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_counseling
    ADD CONSTRAINT pharmacy_counseling_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: pharmacy_coverage_checks pharmacy_coverage_checks_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_coverage_checks
    ADD CONSTRAINT pharmacy_coverage_checks_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.users(id);


--
-- Name: pharmacy_coverage_checks pharmacy_coverage_checks_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_coverage_checks
    ADD CONSTRAINT pharmacy_coverage_checks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: pharmacy_credit_notes pharmacy_credit_notes_adjusted_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_credit_notes
    ADD CONSTRAINT pharmacy_credit_notes_adjusted_invoice_id_fkey FOREIGN KEY (adjusted_invoice_id) REFERENCES public.invoices(id);


--
-- Name: pharmacy_credit_notes pharmacy_credit_notes_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_credit_notes
    ADD CONSTRAINT pharmacy_credit_notes_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: pharmacy_credit_notes pharmacy_credit_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_credit_notes
    ADD CONSTRAINT pharmacy_credit_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: pharmacy_credit_notes pharmacy_credit_notes_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_credit_notes
    ADD CONSTRAINT pharmacy_credit_notes_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: pharmacy_credit_notes pharmacy_credit_notes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_credit_notes
    ADD CONSTRAINT pharmacy_credit_notes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pharmacy_credit_notes pharmacy_credit_notes_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_credit_notes
    ADD CONSTRAINT pharmacy_credit_notes_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: pharmacy_day_settlements pharmacy_day_settlements_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_day_settlements
    ADD CONSTRAINT pharmacy_day_settlements_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.users(id);


--
-- Name: pharmacy_day_settlements pharmacy_day_settlements_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_day_settlements
    ADD CONSTRAINT pharmacy_day_settlements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pharmacy_day_settlements pharmacy_day_settlements_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_day_settlements
    ADD CONSTRAINT pharmacy_day_settlements_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: pharmacy_destruction_log pharmacy_destruction_log_authorized_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_destruction_log
    ADD CONSTRAINT pharmacy_destruction_log_authorized_by_fkey FOREIGN KEY (authorized_by) REFERENCES public.users(id);


--
-- Name: pharmacy_destruction_log pharmacy_destruction_log_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_destruction_log
    ADD CONSTRAINT pharmacy_destruction_log_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: pharmacy_destruction_log pharmacy_destruction_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_destruction_log
    ADD CONSTRAINT pharmacy_destruction_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pharmacy_destruction_log pharmacy_destruction_log_witnessed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_destruction_log
    ADD CONSTRAINT pharmacy_destruction_log_witnessed_by_fkey FOREIGN KEY (witnessed_by) REFERENCES public.users(id);


--
-- Name: pharmacy_drug_margin_daily pharmacy_drug_margin_daily_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_drug_margin_daily
    ADD CONSTRAINT pharmacy_drug_margin_daily_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: pharmacy_drug_recalls pharmacy_drug_recalls_initiated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_drug_recalls
    ADD CONSTRAINT pharmacy_drug_recalls_initiated_by_fkey FOREIGN KEY (initiated_by) REFERENCES public.users(id);


--
-- Name: pharmacy_drug_recalls pharmacy_drug_recalls_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_drug_recalls
    ADD CONSTRAINT pharmacy_drug_recalls_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pharmacy_emergency_kits pharmacy_emergency_kits_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_emergency_kits
    ADD CONSTRAINT pharmacy_emergency_kits_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: pharmacy_emergency_kits pharmacy_emergency_kits_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_emergency_kits
    ADD CONSTRAINT pharmacy_emergency_kits_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: pharmacy_emergency_kits pharmacy_emergency_kits_last_checked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_emergency_kits
    ADD CONSTRAINT pharmacy_emergency_kits_last_checked_by_fkey FOREIGN KEY (last_checked_by) REFERENCES public.users(id);


--
-- Name: pharmacy_emergency_kits pharmacy_emergency_kits_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_emergency_kits
    ADD CONSTRAINT pharmacy_emergency_kits_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: pharmacy_emergency_kits pharmacy_emergency_kits_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_emergency_kits
    ADD CONSTRAINT pharmacy_emergency_kits_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pharmacy_free_dispensings pharmacy_free_dispensings_approving_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_free_dispensings
    ADD CONSTRAINT pharmacy_free_dispensings_approving_user_id_fkey FOREIGN KEY (approving_user_id) REFERENCES public.users(id);


--
-- Name: pharmacy_free_dispensings pharmacy_free_dispensings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_free_dispensings
    ADD CONSTRAINT pharmacy_free_dispensings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: pharmacy_ndps_register pharmacy_ndps_register_dispensed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_ndps_register
    ADD CONSTRAINT pharmacy_ndps_register_dispensed_by_fkey FOREIGN KEY (dispensed_by) REFERENCES public.users(id);


--
-- Name: pharmacy_ndps_register pharmacy_ndps_register_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_ndps_register
    ADD CONSTRAINT pharmacy_ndps_register_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: pharmacy_ndps_register pharmacy_ndps_register_second_witness_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_ndps_register
    ADD CONSTRAINT pharmacy_ndps_register_second_witness_id_fkey FOREIGN KEY (second_witness_id) REFERENCES public.users(id);


--
-- Name: pharmacy_ndps_register pharmacy_ndps_register_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_ndps_register
    ADD CONSTRAINT pharmacy_ndps_register_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pharmacy_ndps_register pharmacy_ndps_register_witnessed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_ndps_register
    ADD CONSTRAINT pharmacy_ndps_register_witnessed_by_fkey FOREIGN KEY (witnessed_by) REFERENCES public.users(id);


--
-- Name: pharmacy_order_items pharmacy_order_items_batch_stock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_order_items
    ADD CONSTRAINT pharmacy_order_items_batch_stock_id_fkey FOREIGN KEY (batch_stock_id) REFERENCES public.batch_stock(id);


--
-- Name: pharmacy_order_items pharmacy_order_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_order_items
    ADD CONSTRAINT pharmacy_order_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pharmacy_orders pharmacy_orders_billing_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_orders
    ADD CONSTRAINT pharmacy_orders_billing_package_id_fkey FOREIGN KEY (billing_package_id) REFERENCES public.billing_packages(id);


--
-- Name: pharmacy_orders pharmacy_orders_discharge_summary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_orders
    ADD CONSTRAINT pharmacy_orders_discharge_summary_id_fkey FOREIGN KEY (discharge_summary_id) REFERENCES public.ipd_discharge_summaries(id);


--
-- Name: pharmacy_orders pharmacy_orders_dispensed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_orders
    ADD CONSTRAINT pharmacy_orders_dispensed_by_fkey FOREIGN KEY (dispensed_by) REFERENCES public.users(id);


--
-- Name: pharmacy_orders pharmacy_orders_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_orders
    ADD CONSTRAINT pharmacy_orders_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: pharmacy_orders pharmacy_orders_ordered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_orders
    ADD CONSTRAINT pharmacy_orders_ordered_by_fkey FOREIGN KEY (ordered_by) REFERENCES public.users(id);


--
-- Name: pharmacy_orders pharmacy_orders_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_orders
    ADD CONSTRAINT pharmacy_orders_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: pharmacy_orders pharmacy_orders_pharmacist_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_orders
    ADD CONSTRAINT pharmacy_orders_pharmacist_reviewed_by_fkey FOREIGN KEY (pharmacist_reviewed_by) REFERENCES public.users(id);


--
-- Name: pharmacy_orders pharmacy_orders_store_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_orders
    ADD CONSTRAINT pharmacy_orders_store_location_id_fkey FOREIGN KEY (store_location_id) REFERENCES public.store_locations(id);


--
-- Name: pharmacy_orders pharmacy_orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_orders
    ADD CONSTRAINT pharmacy_orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pharmacy_payment_transactions pharmacy_payment_transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_payment_transactions
    ADD CONSTRAINT pharmacy_payment_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: pharmacy_payment_transactions pharmacy_payment_transactions_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_payment_transactions
    ADD CONSTRAINT pharmacy_payment_transactions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: pharmacy_payment_transactions pharmacy_payment_transactions_reconciled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_payment_transactions
    ADD CONSTRAINT pharmacy_payment_transactions_reconciled_by_fkey FOREIGN KEY (reconciled_by) REFERENCES public.users(id);


--
-- Name: pharmacy_payment_transactions pharmacy_payment_transactions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_payment_transactions
    ADD CONSTRAINT pharmacy_payment_transactions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pharmacy_petty_cash_vouchers pharmacy_petty_cash_vouchers_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_petty_cash_vouchers
    ADD CONSTRAINT pharmacy_petty_cash_vouchers_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: pharmacy_petty_cash_vouchers pharmacy_petty_cash_vouchers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_petty_cash_vouchers
    ADD CONSTRAINT pharmacy_petty_cash_vouchers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: pharmacy_petty_cash_vouchers pharmacy_petty_cash_vouchers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_petty_cash_vouchers
    ADD CONSTRAINT pharmacy_petty_cash_vouchers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: pharmacy_pos_sale_items pharmacy_pos_sale_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_pos_sale_items
    ADD CONSTRAINT pharmacy_pos_sale_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pharmacy_pos_sales pharmacy_pos_sales_cancelled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_pos_sales
    ADD CONSTRAINT pharmacy_pos_sales_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.users(id);


--
-- Name: pharmacy_pos_sales pharmacy_pos_sales_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_pos_sales
    ADD CONSTRAINT pharmacy_pos_sales_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: pharmacy_pos_sales pharmacy_pos_sales_sold_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_pos_sales
    ADD CONSTRAINT pharmacy_pos_sales_sold_by_fkey FOREIGN KEY (sold_by) REFERENCES public.users(id);


--
-- Name: pharmacy_pos_sales pharmacy_pos_sales_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_pos_sales
    ADD CONSTRAINT pharmacy_pos_sales_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pharmacy_prescriptions pharmacy_prescriptions_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_prescriptions
    ADD CONSTRAINT pharmacy_prescriptions_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: pharmacy_prescriptions pharmacy_prescriptions_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_prescriptions
    ADD CONSTRAINT pharmacy_prescriptions_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: pharmacy_prescriptions pharmacy_prescriptions_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_prescriptions
    ADD CONSTRAINT pharmacy_prescriptions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: pharmacy_prescriptions pharmacy_prescriptions_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_prescriptions
    ADD CONSTRAINT pharmacy_prescriptions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: pharmacy_prescriptions pharmacy_prescriptions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_prescriptions
    ADD CONSTRAINT pharmacy_prescriptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pharmacy_pricing_tiers pharmacy_pricing_tiers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_pricing_tiers
    ADD CONSTRAINT pharmacy_pricing_tiers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: pharmacy_pricing_tiers pharmacy_pricing_tiers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_pricing_tiers
    ADD CONSTRAINT pharmacy_pricing_tiers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pharmacy_repeats pharmacy_repeats_dispensed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_repeats
    ADD CONSTRAINT pharmacy_repeats_dispensed_by_fkey FOREIGN KEY (dispensed_by) REFERENCES public.users(id);


--
-- Name: pharmacy_repeats pharmacy_repeats_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_repeats
    ADD CONSTRAINT pharmacy_repeats_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: pharmacy_returns pharmacy_returns_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_returns
    ADD CONSTRAINT pharmacy_returns_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: pharmacy_returns pharmacy_returns_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_returns
    ADD CONSTRAINT pharmacy_returns_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: pharmacy_returns pharmacy_returns_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_returns
    ADD CONSTRAINT pharmacy_returns_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pharmacy_stock_reconciliation pharmacy_stock_reconciliation_reconciled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_stock_reconciliation
    ADD CONSTRAINT pharmacy_stock_reconciliation_reconciled_by_fkey FOREIGN KEY (reconciled_by) REFERENCES public.users(id);


--
-- Name: pharmacy_stock_reconciliation pharmacy_stock_reconciliation_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_stock_reconciliation
    ADD CONSTRAINT pharmacy_stock_reconciliation_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pharmacy_stock_transactions pharmacy_stock_transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_stock_transactions
    ADD CONSTRAINT pharmacy_stock_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: pharmacy_stock_transactions pharmacy_stock_transactions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_stock_transactions
    ADD CONSTRAINT pharmacy_stock_transactions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pharmacy_store_assignments pharmacy_store_assignments_store_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_store_assignments
    ADD CONSTRAINT pharmacy_store_assignments_store_location_id_fkey FOREIGN KEY (store_location_id) REFERENCES public.store_locations(id);


--
-- Name: pharmacy_store_assignments pharmacy_store_assignments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_store_assignments
    ADD CONSTRAINT pharmacy_store_assignments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pharmacy_store_indents pharmacy_store_indents_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_store_indents
    ADD CONSTRAINT pharmacy_store_indents_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: pharmacy_store_indents pharmacy_store_indents_from_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_store_indents
    ADD CONSTRAINT pharmacy_store_indents_from_store_id_fkey FOREIGN KEY (from_store_id) REFERENCES public.store_locations(id);


--
-- Name: pharmacy_store_indents pharmacy_store_indents_issued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_store_indents
    ADD CONSTRAINT pharmacy_store_indents_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.users(id);


--
-- Name: pharmacy_store_indents pharmacy_store_indents_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_store_indents
    ADD CONSTRAINT pharmacy_store_indents_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id);


--
-- Name: pharmacy_store_indents pharmacy_store_indents_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_store_indents
    ADD CONSTRAINT pharmacy_store_indents_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: pharmacy_store_indents pharmacy_store_indents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_store_indents
    ADD CONSTRAINT pharmacy_store_indents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pharmacy_store_indents pharmacy_store_indents_to_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_store_indents
    ADD CONSTRAINT pharmacy_store_indents_to_store_id_fkey FOREIGN KEY (to_store_id) REFERENCES public.store_locations(id);


--
-- Name: pharmacy_substitutes pharmacy_substitutes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_substitutes
    ADD CONSTRAINT pharmacy_substitutes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pharmacy_substitutions pharmacy_substitutions_substituted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_substitutions
    ADD CONSTRAINT pharmacy_substitutions_substituted_by_fkey FOREIGN KEY (substituted_by) REFERENCES public.users(id);


--
-- Name: pharmacy_substitutions pharmacy_substitutions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_substitutions
    ADD CONSTRAINT pharmacy_substitutions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: pharmacy_supplier_payments pharmacy_supplier_payments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_supplier_payments
    ADD CONSTRAINT pharmacy_supplier_payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: pharmacy_transfer_requests pharmacy_transfer_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_transfer_requests
    ADD CONSTRAINT pharmacy_transfer_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: pharmacy_transfer_requests pharmacy_transfer_requests_from_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_transfer_requests
    ADD CONSTRAINT pharmacy_transfer_requests_from_location_id_fkey FOREIGN KEY (from_location_id) REFERENCES public.store_locations(id);


--
-- Name: pharmacy_transfer_requests pharmacy_transfer_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_transfer_requests
    ADD CONSTRAINT pharmacy_transfer_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: pharmacy_transfer_requests pharmacy_transfer_requests_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_transfer_requests
    ADD CONSTRAINT pharmacy_transfer_requests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pharmacy_transfer_requests pharmacy_transfer_requests_to_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_transfer_requests
    ADD CONSTRAINT pharmacy_transfer_requests_to_location_id_fkey FOREIGN KEY (to_location_id) REFERENCES public.store_locations(id);


--
-- Name: polypharmacy_interaction_alerts polypharmacy_interaction_alerts_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polypharmacy_interaction_alerts
    ADD CONSTRAINT polypharmacy_interaction_alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);


--
-- Name: polypharmacy_interaction_alerts polypharmacy_interaction_alerts_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polypharmacy_interaction_alerts
    ADD CONSTRAINT polypharmacy_interaction_alerts_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.chronic_enrollments(id);


--
-- Name: polypharmacy_interaction_alerts polypharmacy_interaction_alerts_interaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polypharmacy_interaction_alerts
    ADD CONSTRAINT polypharmacy_interaction_alerts_interaction_id_fkey FOREIGN KEY (interaction_id) REFERENCES public.drug_interactions(id);


--
-- Name: polypharmacy_interaction_alerts polypharmacy_interaction_alerts_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polypharmacy_interaction_alerts
    ADD CONSTRAINT polypharmacy_interaction_alerts_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: polypharmacy_interaction_alerts polypharmacy_interaction_alerts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polypharmacy_interaction_alerts
    ADD CONSTRAINT polypharmacy_interaction_alerts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: postnatal_records postnatal_records_examined_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postnatal_records
    ADD CONSTRAINT postnatal_records_examined_by_fkey FOREIGN KEY (examined_by) REFERENCES public.users(id);


--
-- Name: postnatal_records postnatal_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postnatal_records
    ADD CONSTRAINT postnatal_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: pre_authorization_requests pre_authorization_requests_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_authorization_requests
    ADD CONSTRAINT pre_authorization_requests_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: pre_authorization_requests pre_authorization_requests_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_authorization_requests
    ADD CONSTRAINT pre_authorization_requests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: pre_authorization_requests pre_authorization_requests_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_authorization_requests
    ADD CONSTRAINT pre_authorization_requests_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: pre_authorization_requests pre_authorization_requests_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_authorization_requests
    ADD CONSTRAINT pre_authorization_requests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: prescription_items prescription_items_discontinued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_items
    ADD CONSTRAINT prescription_items_discontinued_by_fkey FOREIGN KEY (discontinued_by) REFERENCES public.users(id);


--
-- Name: prescription_items prescription_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_items
    ADD CONSTRAINT prescription_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: prescription_templates prescription_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_templates
    ADD CONSTRAINT prescription_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: prescription_templates prescription_templates_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_templates
    ADD CONSTRAINT prescription_templates_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: prescription_templates prescription_templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_templates
    ADD CONSTRAINT prescription_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: prescriptions prescriptions_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: prescriptions prescriptions_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: prescriptions prescriptions_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: prescriptions prescriptions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: print_jobs print_jobs_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_jobs
    ADD CONSTRAINT print_jobs_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: print_jobs print_jobs_document_output_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_jobs
    ADD CONSTRAINT print_jobs_document_output_id_fkey FOREIGN KEY (document_output_id) REFERENCES public.document_outputs(id);


--
-- Name: print_jobs print_jobs_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_jobs
    ADD CONSTRAINT print_jobs_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: print_jobs print_jobs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_jobs
    ADD CONSTRAINT print_jobs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: printer_configs printer_configs_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.printer_configs
    ADD CONSTRAINT printer_configs_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: printer_configs printer_configs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.printer_configs
    ADD CONSTRAINT printer_configs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: prior_auth_appeals prior_auth_appeals_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prior_auth_appeals
    ADD CONSTRAINT prior_auth_appeals_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: prior_auth_appeals prior_auth_appeals_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prior_auth_appeals
    ADD CONSTRAINT prior_auth_appeals_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: prior_auth_appeals prior_auth_appeals_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prior_auth_appeals
    ADD CONSTRAINT prior_auth_appeals_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: prior_auth_documents prior_auth_documents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prior_auth_documents
    ADD CONSTRAINT prior_auth_documents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: prior_auth_documents prior_auth_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prior_auth_documents
    ADD CONSTRAINT prior_auth_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: prior_auth_requests prior_auth_requests_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prior_auth_requests
    ADD CONSTRAINT prior_auth_requests_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: prior_auth_requests prior_auth_requests_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prior_auth_requests
    ADD CONSTRAINT prior_auth_requests_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: prior_auth_requests prior_auth_requests_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prior_auth_requests
    ADD CONSTRAINT prior_auth_requests_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: prior_auth_requests prior_auth_requests_ordering_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prior_auth_requests
    ADD CONSTRAINT prior_auth_requests_ordering_doctor_id_fkey FOREIGN KEY (ordering_doctor_id) REFERENCES public.users(id);


--
-- Name: prior_auth_requests prior_auth_requests_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prior_auth_requests
    ADD CONSTRAINT prior_auth_requests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: prior_auth_requests prior_auth_requests_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prior_auth_requests
    ADD CONSTRAINT prior_auth_requests_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: prior_auth_requests prior_auth_requests_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prior_auth_requests
    ADD CONSTRAINT prior_auth_requests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: prior_auth_status_log prior_auth_status_log_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prior_auth_status_log
    ADD CONSTRAINT prior_auth_status_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: prior_auth_status_log prior_auth_status_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prior_auth_status_log
    ADD CONSTRAINT prior_auth_status_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: procedure_catalog procedure_catalog_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_catalog
    ADD CONSTRAINT procedure_catalog_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: procedure_catalog procedure_catalog_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_catalog
    ADD CONSTRAINT procedure_catalog_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: procedure_consents procedure_consents_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_consents
    ADD CONSTRAINT procedure_consents_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: procedure_consents procedure_consents_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_consents
    ADD CONSTRAINT procedure_consents_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: procedure_consents procedure_consents_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_consents
    ADD CONSTRAINT procedure_consents_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: procedure_consents procedure_consents_procedure_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_consents
    ADD CONSTRAINT procedure_consents_procedure_order_id_fkey FOREIGN KEY (procedure_order_id) REFERENCES public.procedure_orders(id);


--
-- Name: procedure_consents procedure_consents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_consents
    ADD CONSTRAINT procedure_consents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: procedure_orders procedure_orders_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_orders
    ADD CONSTRAINT procedure_orders_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: procedure_orders procedure_orders_ordered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_orders
    ADD CONSTRAINT procedure_orders_ordered_by_fkey FOREIGN KEY (ordered_by) REFERENCES public.users(id);


--
-- Name: procedure_orders procedure_orders_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_orders
    ADD CONSTRAINT procedure_orders_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: procedure_orders procedure_orders_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_orders
    ADD CONSTRAINT procedure_orders_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: procedure_orders procedure_orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_orders
    ADD CONSTRAINT procedure_orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: processed_webhooks processed_webhooks_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processed_webhooks
    ADD CONSTRAINT processed_webhooks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: psych_assessments psych_assessments_assessed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_assessments
    ADD CONSTRAINT psych_assessments_assessed_by_fkey FOREIGN KEY (assessed_by) REFERENCES public.users(id);


--
-- Name: psych_assessments psych_assessments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_assessments
    ADD CONSTRAINT psych_assessments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: psych_counseling_sessions psych_counseling_sessions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_counseling_sessions
    ADD CONSTRAINT psych_counseling_sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: psych_counseling_sessions psych_counseling_sessions_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_counseling_sessions
    ADD CONSTRAINT psych_counseling_sessions_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.users(id);


--
-- Name: psych_ect_register psych_ect_register_anesthetist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_ect_register
    ADD CONSTRAINT psych_ect_register_anesthetist_id_fkey FOREIGN KEY (anesthetist_id) REFERENCES public.users(id);


--
-- Name: psych_ect_register psych_ect_register_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_ect_register
    ADD CONSTRAINT psych_ect_register_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: psych_ect_register psych_ect_register_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_ect_register
    ADD CONSTRAINT psych_ect_register_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: psych_mhrb_notifications psych_mhrb_notifications_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_mhrb_notifications
    ADD CONSTRAINT psych_mhrb_notifications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: psych_patients psych_patients_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_patients
    ADD CONSTRAINT psych_patients_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: psych_patients psych_patients_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_patients
    ADD CONSTRAINT psych_patients_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: psych_patients psych_patients_treating_psychiatrist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_patients
    ADD CONSTRAINT psych_patients_treating_psychiatrist_id_fkey FOREIGN KEY (treating_psychiatrist_id) REFERENCES public.users(id);


--
-- Name: psych_seclusion_restraint psych_seclusion_restraint_ordered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_seclusion_restraint
    ADD CONSTRAINT psych_seclusion_restraint_ordered_by_fkey FOREIGN KEY (ordered_by) REFERENCES public.users(id);


--
-- Name: psych_seclusion_restraint psych_seclusion_restraint_released_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_seclusion_restraint
    ADD CONSTRAINT psych_seclusion_restraint_released_by_fkey FOREIGN KEY (released_by) REFERENCES public.users(id);


--
-- Name: psych_seclusion_restraint psych_seclusion_restraint_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_seclusion_restraint
    ADD CONSTRAINT psych_seclusion_restraint_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: psychometric_tests psychometric_tests_administered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psychometric_tests
    ADD CONSTRAINT psychometric_tests_administered_by_fkey FOREIGN KEY (administered_by) REFERENCES public.users(id);


--
-- Name: psychometric_tests psychometric_tests_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psychometric_tests
    ADD CONSTRAINT psychometric_tests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: psychometric_tests psychometric_tests_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psychometric_tests
    ADD CONSTRAINT psychometric_tests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: purchase_order_items purchase_order_items_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.store_catalog(id);


--
-- Name: purchase_order_items purchase_order_items_indent_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_indent_item_id_fkey FOREIGN KEY (indent_item_id) REFERENCES public.indent_items(id);


--
-- Name: purchase_order_items purchase_order_items_pharmacy_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pharmacy_catalog_id_fkey FOREIGN KEY (pharmacy_catalog_id) REFERENCES public.pharmacy_catalog(id);


--
-- Name: purchase_order_items purchase_order_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: purchase_orders purchase_orders_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: purchase_orders purchase_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: purchase_orders purchase_orders_indent_requisition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_indent_requisition_id_fkey FOREIGN KEY (indent_requisition_id) REFERENCES public.indent_requisitions(id);


--
-- Name: purchase_orders purchase_orders_store_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_store_location_id_fkey FOREIGN KEY (store_location_id) REFERENCES public.store_locations(id);


--
-- Name: purchase_orders purchase_orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: quality_accreditation_compliance quality_accreditation_compliance_assessed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_accreditation_compliance
    ADD CONSTRAINT quality_accreditation_compliance_assessed_by_fkey FOREIGN KEY (assessed_by) REFERENCES public.users(id);


--
-- Name: quality_accreditation_compliance quality_accreditation_compliance_responsible_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_accreditation_compliance
    ADD CONSTRAINT quality_accreditation_compliance_responsible_person_id_fkey FOREIGN KEY (responsible_person_id) REFERENCES public.users(id);


--
-- Name: quality_accreditation_compliance quality_accreditation_compliance_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_accreditation_compliance
    ADD CONSTRAINT quality_accreditation_compliance_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: quality_accreditation_standards quality_accreditation_standards_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_accreditation_standards
    ADD CONSTRAINT quality_accreditation_standards_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: quality_action_items quality_action_items_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_action_items
    ADD CONSTRAINT quality_action_items_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: quality_action_items quality_action_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_action_items
    ADD CONSTRAINT quality_action_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: quality_audits quality_audits_auditor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_audits
    ADD CONSTRAINT quality_audits_auditor_id_fkey FOREIGN KEY (auditor_id) REFERENCES public.users(id);


--
-- Name: quality_audits quality_audits_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_audits
    ADD CONSTRAINT quality_audits_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: quality_capa quality_capa_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_capa
    ADD CONSTRAINT quality_capa_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: quality_capa quality_capa_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_capa
    ADD CONSTRAINT quality_capa_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: quality_capa quality_capa_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_capa
    ADD CONSTRAINT quality_capa_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: quality_committee_meetings quality_committee_meetings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_committee_meetings
    ADD CONSTRAINT quality_committee_meetings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: quality_committees quality_committees_chairperson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_committees
    ADD CONSTRAINT quality_committees_chairperson_id_fkey FOREIGN KEY (chairperson_id) REFERENCES public.users(id);


--
-- Name: quality_committees quality_committees_secretary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_committees
    ADD CONSTRAINT quality_committees_secretary_id_fkey FOREIGN KEY (secretary_id) REFERENCES public.users(id);


--
-- Name: quality_committees quality_committees_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_committees
    ADD CONSTRAINT quality_committees_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: quality_document_acknowledgments quality_document_acknowledgments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_document_acknowledgments
    ADD CONSTRAINT quality_document_acknowledgments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: quality_document_acknowledgments quality_document_acknowledgments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_document_acknowledgments
    ADD CONSTRAINT quality_document_acknowledgments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: quality_document_versions quality_document_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_document_versions
    ADD CONSTRAINT quality_document_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: quality_document_versions quality_document_versions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_document_versions
    ADD CONSTRAINT quality_document_versions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: quality_documents quality_documents_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_documents
    ADD CONSTRAINT quality_documents_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id);


--
-- Name: quality_documents quality_documents_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_documents
    ADD CONSTRAINT quality_documents_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: quality_documents quality_documents_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_documents
    ADD CONSTRAINT quality_documents_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users(id);


--
-- Name: quality_documents quality_documents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_documents
    ADD CONSTRAINT quality_documents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: quality_incidents quality_incidents_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_incidents
    ADD CONSTRAINT quality_incidents_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: quality_incidents quality_incidents_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_incidents
    ADD CONSTRAINT quality_incidents_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.users(id);


--
-- Name: quality_incidents quality_incidents_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_incidents
    ADD CONSTRAINT quality_incidents_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id);


--
-- Name: quality_incidents quality_incidents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_incidents
    ADD CONSTRAINT quality_incidents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: quality_indicator_data quality_indicator_data_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_indicator_data
    ADD CONSTRAINT quality_indicator_data_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: quality_indicator_values quality_indicator_values_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_indicator_values
    ADD CONSTRAINT quality_indicator_values_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: quality_indicator_values quality_indicator_values_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_indicator_values
    ADD CONSTRAINT quality_indicator_values_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: quality_indicators quality_indicators_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_indicators
    ADD CONSTRAINT quality_indicators_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: queue_display_config queue_display_config_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_display_config
    ADD CONSTRAINT queue_display_config_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: queue_display_config queue_display_config_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_display_config
    ADD CONSTRAINT queue_display_config_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: queue_priority_rules queue_priority_rules_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_priority_rules
    ADD CONSTRAINT queue_priority_rules_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: queue_priority_rules queue_priority_rules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_priority_rules
    ADD CONSTRAINT queue_priority_rules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: queue_tokens queue_tokens_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_tokens
    ADD CONSTRAINT queue_tokens_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: queue_tokens queue_tokens_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_tokens
    ADD CONSTRAINT queue_tokens_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: queue_tokens queue_tokens_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_tokens
    ADD CONSTRAINT queue_tokens_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: queue_tokens queue_tokens_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_tokens
    ADD CONSTRAINT queue_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: radiation_dose_records radiation_dose_records_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiation_dose_records
    ADD CONSTRAINT radiation_dose_records_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: radiation_dose_records radiation_dose_records_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiation_dose_records
    ADD CONSTRAINT radiation_dose_records_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: radiation_dose_records radiation_dose_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiation_dose_records
    ADD CONSTRAINT radiation_dose_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: radiology_dicom_studies radiology_dicom_studies_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_dicom_studies
    ADD CONSTRAINT radiology_dicom_studies_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: radiology_dicom_studies radiology_dicom_studies_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_dicom_studies
    ADD CONSTRAINT radiology_dicom_studies_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: radiology_dosimetry_records radiology_dosimetry_records_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_dosimetry_records
    ADD CONSTRAINT radiology_dosimetry_records_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: radiology_dosimetry_records radiology_dosimetry_records_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_dosimetry_records
    ADD CONSTRAINT radiology_dosimetry_records_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.users(id);


--
-- Name: radiology_dosimetry_records radiology_dosimetry_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_dosimetry_records
    ADD CONSTRAINT radiology_dosimetry_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: radiology_modalities radiology_modalities_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_modalities
    ADD CONSTRAINT radiology_modalities_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: radiology_orders radiology_orders_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_orders
    ADD CONSTRAINT radiology_orders_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: radiology_orders radiology_orders_ordered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_orders
    ADD CONSTRAINT radiology_orders_ordered_by_fkey FOREIGN KEY (ordered_by) REFERENCES public.users(id);


--
-- Name: radiology_orders radiology_orders_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_orders
    ADD CONSTRAINT radiology_orders_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: radiology_orders radiology_orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_orders
    ADD CONSTRAINT radiology_orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: radiology_reports radiology_reports_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_reports
    ADD CONSTRAINT radiology_reports_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id);


--
-- Name: radiology_reports radiology_reports_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_reports
    ADD CONSTRAINT radiology_reports_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: radiology_reports radiology_reports_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_reports
    ADD CONSTRAINT radiology_reports_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: radiology_share_links radiology_share_links_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_share_links
    ADD CONSTRAINT radiology_share_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: radiology_share_links radiology_share_links_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_share_links
    ADD CONSTRAINT radiology_share_links_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: rate_contract_items rate_contract_items_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_contract_items
    ADD CONSTRAINT rate_contract_items_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.store_catalog(id);


--
-- Name: rate_contract_items rate_contract_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_contract_items
    ADD CONSTRAINT rate_contract_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: rate_contracts rate_contracts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_contracts
    ADD CONSTRAINT rate_contracts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: rate_contracts rate_contracts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_contracts
    ADD CONSTRAINT rate_contracts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: rate_plan_items rate_plan_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plan_items
    ADD CONSTRAINT rate_plan_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: rate_plans rate_plans_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plans
    ADD CONSTRAINT rate_plans_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: rca_reports rca_reports_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_reports
    ADD CONSTRAINT rca_reports_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: rca_reports rca_reports_prepared_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_reports
    ADD CONSTRAINT rca_reports_prepared_by_fkey FOREIGN KEY (prepared_by) REFERENCES public.users(id);


--
-- Name: rca_reports rca_reports_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_reports
    ADD CONSTRAINT rca_reports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: rca_reports rca_reports_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_reports
    ADD CONSTRAINT rca_reports_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: receipts receipts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: referrals referrals_from_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_from_department_id_fkey FOREIGN KEY (from_department_id) REFERENCES public.departments(id);


--
-- Name: referrals referrals_from_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_from_doctor_id_fkey FOREIGN KEY (from_doctor_id) REFERENCES public.users(id);


--
-- Name: referrals referrals_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: referrals referrals_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: referrals referrals_to_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_to_department_id_fkey FOREIGN KEY (to_department_id) REFERENCES public.departments(id);


--
-- Name: referrals referrals_to_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_to_doctor_id_fkey FOREIGN KEY (to_doctor_id) REFERENCES public.users(id);


--
-- Name: refresh_tokens refresh_tokens_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: refunds refunds_refunded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_refunded_by_fkey FOREIGN KEY (refunded_by) REFERENCES public.users(id);


--
-- Name: refunds refunds_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: regulatory_bodies regulatory_bodies_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulatory_bodies
    ADD CONSTRAINT regulatory_bodies_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.geo_countries(id);


--
-- Name: regulatory_bodies regulatory_bodies_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulatory_bodies
    ADD CONSTRAINT regulatory_bodies_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.geo_states(id);


--
-- Name: rehab_plans rehab_plans_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rehab_plans
    ADD CONSTRAINT rehab_plans_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: rehab_plans rehab_plans_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rehab_plans
    ADD CONSTRAINT rehab_plans_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: rehab_plans rehab_plans_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rehab_plans
    ADD CONSTRAINT rehab_plans_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.users(id);


--
-- Name: rehab_sessions rehab_sessions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rehab_sessions
    ADD CONSTRAINT rehab_sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: rehab_sessions rehab_sessions_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rehab_sessions
    ADD CONSTRAINT rehab_sessions_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.users(id);


--
-- Name: relation_tuples relation_tuples_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.relation_tuples
    ADD CONSTRAINT relation_tuples_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: reorder_alerts reorder_alerts_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reorder_alerts
    ADD CONSTRAINT reorder_alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);


--
-- Name: reorder_alerts reorder_alerts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reorder_alerts
    ADD CONSTRAINT reorder_alerts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: restraint_documentation restraint_documentation_ordering_physician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restraint_documentation
    ADD CONSTRAINT restraint_documentation_ordering_physician_id_fkey FOREIGN KEY (ordering_physician_id) REFERENCES public.users(id);


--
-- Name: restraint_documentation restraint_documentation_psychiatrist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restraint_documentation
    ADD CONSTRAINT restraint_documentation_psychiatrist_id_fkey FOREIGN KEY (psychiatrist_id) REFERENCES public.users(id);


--
-- Name: restraint_documentation restraint_documentation_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restraint_documentation
    ADD CONSTRAINT restraint_documentation_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: restraint_monitoring_events restraint_monitoring_events_monitored_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restraint_monitoring_events
    ADD CONSTRAINT restraint_monitoring_events_monitored_by_fkey FOREIGN KEY (monitored_by) REFERENCES public.users(id);


--
-- Name: restraint_monitoring_events restraint_monitoring_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restraint_monitoring_events
    ADD CONSTRAINT restraint_monitoring_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: restraint_monitoring_events restraint_monitoring_events_witness_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restraint_monitoring_events
    ADD CONSTRAINT restraint_monitoring_events_witness_user_id_fkey FOREIGN KEY (witness_user_id) REFERENCES public.users(id);


--
-- Name: restraint_monitoring_logs restraint_monitoring_logs_checked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restraint_monitoring_logs
    ADD CONSTRAINT restraint_monitoring_logs_checked_by_fkey FOREIGN KEY (checked_by) REFERENCES public.users(id);


--
-- Name: restraint_monitoring_logs restraint_monitoring_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restraint_monitoring_logs
    ADD CONSTRAINT restraint_monitoring_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: restricted_drug_approvals restricted_drug_approvals_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restricted_drug_approvals
    ADD CONSTRAINT restricted_drug_approvals_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: restricted_drug_approvals restricted_drug_approvals_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restricted_drug_approvals
    ADD CONSTRAINT restricted_drug_approvals_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: restricted_drug_approvals restricted_drug_approvals_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restricted_drug_approvals
    ADD CONSTRAINT restricted_drug_approvals_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: restricted_drug_approvals restricted_drug_approvals_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restricted_drug_approvals
    ADD CONSTRAINT restricted_drug_approvals_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: restricted_drug_approvals restricted_drug_approvals_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restricted_drug_approvals
    ADD CONSTRAINT restricted_drug_approvals_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: retrospective_entries retrospective_entries_entered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retrospective_entries
    ADD CONSTRAINT retrospective_entries_entered_by_fkey FOREIGN KEY (entered_by) REFERENCES public.users(id);


--
-- Name: retrospective_entries retrospective_entries_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retrospective_entries
    ADD CONSTRAINT retrospective_entries_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: roles roles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: room_turnarounds room_turnarounds_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_turnarounds
    ADD CONSTRAINT room_turnarounds_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: room_turnarounds room_turnarounds_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_turnarounds
    ADD CONSTRAINT room_turnarounds_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: room_turnarounds room_turnarounds_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_turnarounds
    ADD CONSTRAINT room_turnarounds_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: room_turnarounds room_turnarounds_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_turnarounds
    ADD CONSTRAINT room_turnarounds_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: scheduled_jobs scheduled_jobs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_jobs
    ADD CONSTRAINT scheduled_jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: scheduled_jobs scheduled_jobs_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_jobs
    ADD CONSTRAINT scheduled_jobs_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.integration_pipelines(id);


--
-- Name: scheduling_overbooking_rules scheduling_overbooking_rules_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduling_overbooking_rules
    ADD CONSTRAINT scheduling_overbooking_rules_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: scheduling_overbooking_rules scheduling_overbooking_rules_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduling_overbooking_rules
    ADD CONSTRAINT scheduling_overbooking_rules_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: scheduling_overbooking_rules scheduling_overbooking_rules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduling_overbooking_rules
    ADD CONSTRAINT scheduling_overbooking_rules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: scheduling_waitlist scheduling_waitlist_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduling_waitlist
    ADD CONSTRAINT scheduling_waitlist_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: scheduling_waitlist scheduling_waitlist_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduling_waitlist
    ADD CONSTRAINT scheduling_waitlist_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: scheduling_waitlist scheduling_waitlist_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduling_waitlist
    ADD CONSTRAINT scheduling_waitlist_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: scheduling_waitlist scheduling_waitlist_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduling_waitlist
    ADD CONSTRAINT scheduling_waitlist_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: scheduling_waitlist scheduling_waitlist_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduling_waitlist
    ADD CONSTRAINT scheduling_waitlist_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: security_access_cards security_access_cards_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_access_cards
    ADD CONSTRAINT security_access_cards_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: security_access_cards security_access_cards_issued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_access_cards
    ADD CONSTRAINT security_access_cards_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.users(id);


--
-- Name: security_access_cards security_access_cards_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_access_cards
    ADD CONSTRAINT security_access_cards_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: security_access_logs security_access_logs_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_access_logs
    ADD CONSTRAINT security_access_logs_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: security_access_logs security_access_logs_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_access_logs
    ADD CONSTRAINT security_access_logs_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: security_access_logs security_access_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_access_logs
    ADD CONSTRAINT security_access_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: security_cameras security_cameras_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_cameras
    ADD CONSTRAINT security_cameras_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: security_code_debriefs security_code_debriefs_code_activation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_code_debriefs
    ADD CONSTRAINT security_code_debriefs_code_activation_id_fkey FOREIGN KEY (code_activation_id) REFERENCES public.er_code_activations(id);


--
-- Name: security_code_debriefs security_code_debriefs_facilitator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_code_debriefs
    ADD CONSTRAINT security_code_debriefs_facilitator_id_fkey FOREIGN KEY (facilitator_id) REFERENCES public.users(id);


--
-- Name: security_code_debriefs security_code_debriefs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_code_debriefs
    ADD CONSTRAINT security_code_debriefs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: security_incidents security_incidents_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_incidents
    ADD CONSTRAINT security_incidents_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: security_incidents security_incidents_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_incidents
    ADD CONSTRAINT security_incidents_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id);


--
-- Name: security_incidents security_incidents_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_incidents
    ADD CONSTRAINT security_incidents_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: security_incidents security_incidents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_incidents
    ADD CONSTRAINT security_incidents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: security_patient_tags security_patient_tags_activated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_patient_tags
    ADD CONSTRAINT security_patient_tags_activated_by_fkey FOREIGN KEY (activated_by) REFERENCES public.users(id);


--
-- Name: security_patient_tags security_patient_tags_deactivated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_patient_tags
    ADD CONSTRAINT security_patient_tags_deactivated_by_fkey FOREIGN KEY (deactivated_by) REFERENCES public.users(id);


--
-- Name: security_patient_tags security_patient_tags_mother_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_patient_tags
    ADD CONSTRAINT security_patient_tags_mother_id_fkey FOREIGN KEY (mother_id) REFERENCES public.patients(id);


--
-- Name: security_patient_tags security_patient_tags_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_patient_tags
    ADD CONSTRAINT security_patient_tags_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: security_patient_tags security_patient_tags_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_patient_tags
    ADD CONSTRAINT security_patient_tags_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: security_tag_alerts security_tag_alerts_code_activation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_tag_alerts
    ADD CONSTRAINT security_tag_alerts_code_activation_id_fkey FOREIGN KEY (code_activation_id) REFERENCES public.er_code_activations(id);


--
-- Name: security_tag_alerts security_tag_alerts_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_tag_alerts
    ADD CONSTRAINT security_tag_alerts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: security_tag_alerts security_tag_alerts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_tag_alerts
    ADD CONSTRAINT security_tag_alerts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: security_zones security_zones_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_zones
    ADD CONSTRAINT security_zones_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: security_zones security_zones_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_zones
    ADD CONSTRAINT security_zones_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: sensitive_patients sensitive_patients_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensitive_patients
    ADD CONSTRAINT sensitive_patients_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: shift_definitions shift_definitions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_definitions
    ADD CONSTRAINT shift_definitions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: shift_handoffs shift_handoffs_incoming_nurse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_handoffs
    ADD CONSTRAINT shift_handoffs_incoming_nurse_id_fkey FOREIGN KEY (incoming_nurse_id) REFERENCES public.users(id);


--
-- Name: shift_handoffs shift_handoffs_outgoing_nurse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_handoffs
    ADD CONSTRAINT shift_handoffs_outgoing_nurse_id_fkey FOREIGN KEY (outgoing_nurse_id) REFERENCES public.users(id);


--
-- Name: shift_handoffs shift_handoffs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_handoffs
    ADD CONSTRAINT shift_handoffs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: signed_records signed_records_signer_credential_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signed_records
    ADD CONSTRAINT signed_records_signer_credential_id_fkey FOREIGN KEY (signer_credential_id) REFERENCES public.doctor_signature_credentials(id);


--
-- Name: signed_records signed_records_signer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signed_records
    ADD CONSTRAINT signed_records_signer_user_id_fkey FOREIGN KEY (signer_user_id) REFERENCES public.users(id);


--
-- Name: specialty_records specialty_records_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specialty_records
    ADD CONSTRAINT specialty_records_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: specialty_records specialty_records_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specialty_records
    ADD CONSTRAINT specialty_records_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: specialty_records specialty_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specialty_records
    ADD CONSTRAINT specialty_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: specialty_templates specialty_templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specialty_templates
    ADD CONSTRAINT specialty_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: statutory_records statutory_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statutory_records
    ADD CONSTRAINT statutory_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: stock_disposal_requests stock_disposal_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_disposal_requests
    ADD CONSTRAINT stock_disposal_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: stock_disposal_requests stock_disposal_requests_executed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_disposal_requests
    ADD CONSTRAINT stock_disposal_requests_executed_by_fkey FOREIGN KEY (executed_by) REFERENCES public.users(id);


--
-- Name: stock_disposal_requests stock_disposal_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_disposal_requests
    ADD CONSTRAINT stock_disposal_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: stock_disposal_requests stock_disposal_requests_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_disposal_requests
    ADD CONSTRAINT stock_disposal_requests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: stock_disposal_requests stock_disposal_requests_witness_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_disposal_requests
    ADD CONSTRAINT stock_disposal_requests_witness_id_fkey FOREIGN KEY (witness_id) REFERENCES public.users(id);


--
-- Name: stock_transfers stock_transfers_dispatched_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_dispatched_by_fkey FOREIGN KEY (dispatched_by) REFERENCES public.users(id);


--
-- Name: stock_transfers stock_transfers_initiated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_initiated_by_fkey FOREIGN KEY (initiated_by) REFERENCES public.users(id);


--
-- Name: stock_transfers stock_transfers_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id);


--
-- Name: stock_transfers stock_transfers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: store_catalog store_catalog_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_catalog
    ADD CONSTRAINT store_catalog_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: store_locations store_locations_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_locations
    ADD CONSTRAINT store_locations_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: store_locations store_locations_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_locations
    ADD CONSTRAINT store_locations_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: store_locations store_locations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_locations
    ADD CONSTRAINT store_locations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: store_stock_movements store_stock_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_stock_movements
    ADD CONSTRAINT store_stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: store_stock_movements store_stock_movements_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_stock_movements
    ADD CONSTRAINT store_stock_movements_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: store_stock_movements store_stock_movements_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_stock_movements
    ADD CONSTRAINT store_stock_movements_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: store_stock_movements store_stock_movements_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_stock_movements
    ADD CONSTRAINT store_stock_movements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: stores stores_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: supplier_payments supplier_payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT supplier_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: supplier_payments supplier_payments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT supplier_payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: surgeries surgeries_anesthesiologist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgeries
    ADD CONSTRAINT surgeries_anesthesiologist_id_fkey FOREIGN KEY (anesthesiologist_id) REFERENCES public.users(id);


--
-- Name: surgeries surgeries_assistant_surgeon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgeries
    ADD CONSTRAINT surgeries_assistant_surgeon_id_fkey FOREIGN KEY (assistant_surgeon_id) REFERENCES public.users(id);


--
-- Name: surgeries surgeries_circulating_nurse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgeries
    ADD CONSTRAINT surgeries_circulating_nurse_id_fkey FOREIGN KEY (circulating_nurse_id) REFERENCES public.users(id);


--
-- Name: surgeries surgeries_scrub_nurse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgeries
    ADD CONSTRAINT surgeries_scrub_nurse_id_fkey FOREIGN KEY (scrub_nurse_id) REFERENCES public.users(id);


--
-- Name: surgeries surgeries_surgeon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgeries
    ADD CONSTRAINT surgeries_surgeon_id_fkey FOREIGN KEY (surgeon_id) REFERENCES public.users(id);


--
-- Name: surgeries surgeries_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgeries
    ADD CONSTRAINT surgeries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: system_state system_state_set_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_state
    ADD CONSTRAINT system_state_set_by_fkey FOREIGN KEY (set_by) REFERENCES public.users(id);


--
-- Name: tat_alerts tat_alerts_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tat_alerts
    ADD CONSTRAINT tat_alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);


--
-- Name: tat_alerts tat_alerts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tat_alerts
    ADD CONSTRAINT tat_alerts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tat_benchmarks tat_benchmarks_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tat_benchmarks
    ADD CONSTRAINT tat_benchmarks_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: tat_benchmarks tat_benchmarks_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tat_benchmarks
    ADD CONSTRAINT tat_benchmarks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tat_records tat_records_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tat_records
    ADD CONSTRAINT tat_records_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: tat_records tat_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tat_records
    ADD CONSTRAINT tat_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tax_categories tax_categories_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_categories
    ADD CONSTRAINT tax_categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tds_certificates tds_certificates_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tds_certificates
    ADD CONSTRAINT tds_certificates_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id);


--
-- Name: tds_certificates tds_certificates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tds_certificates
    ADD CONSTRAINT tds_certificates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tds_deductions tds_deductions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tds_deductions
    ADD CONSTRAINT tds_deductions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: tds_deductions tds_deductions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tds_deductions
    ADD CONSTRAINT tds_deductions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tenant_db_topology tenant_db_topology_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_db_topology
    ADD CONSTRAINT tenant_db_topology_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tenant_db_topology tenant_db_topology_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_db_topology
    ADD CONSTRAINT tenant_db_topology_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: tenant_settings tenant_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tenants tenants_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.geo_countries(id);


--
-- Name: tenants tenants_district_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.geo_districts(id);


--
-- Name: tenants tenants_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.hospital_groups(id);


--
-- Name: tenants tenants_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.hospital_regions(id);


--
-- Name: tenants tenants_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.geo_states(id);


--
-- Name: tpa_rate_cards tpa_rate_cards_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tpa_rate_cards
    ADD CONSTRAINT tpa_rate_cards_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: training_attendance training_attendance_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_attendance
    ADD CONSTRAINT training_attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id);


--
-- Name: training_attendance training_attendance_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_attendance
    ADD CONSTRAINT training_attendance_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: training_programs training_programs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_programs
    ADD CONSTRAINT training_programs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: training_records training_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_records
    ADD CONSTRAINT training_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: transfusion_records transfusion_records_administered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfusion_records
    ADD CONSTRAINT transfusion_records_administered_by_fkey FOREIGN KEY (administered_by) REFERENCES public.users(id);


--
-- Name: transfusion_records transfusion_records_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfusion_records
    ADD CONSTRAINT transfusion_records_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: transfusion_records transfusion_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfusion_records
    ADD CONSTRAINT transfusion_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: transfusion_records transfusion_records_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfusion_records
    ADD CONSTRAINT transfusion_records_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: transfusions transfusions_completed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfusions
    ADD CONSTRAINT transfusions_completed_by_id_fkey FOREIGN KEY (completed_by_id) REFERENCES public.users(id);


--
-- Name: transfusions transfusions_patient_verified_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfusions
    ADD CONSTRAINT transfusions_patient_verified_by_id_fkey FOREIGN KEY (patient_verified_by_id) REFERENCES public.users(id);


--
-- Name: transfusions transfusions_product_verified_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfusions
    ADD CONSTRAINT transfusions_product_verified_by_id_fkey FOREIGN KEY (product_verified_by_id) REFERENCES public.users(id);


--
-- Name: transfusions transfusions_started_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfusions
    ADD CONSTRAINT transfusions_started_by_id_fkey FOREIGN KEY (started_by_id) REFERENCES public.users(id);


--
-- Name: transfusions transfusions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfusions
    ADD CONSTRAINT transfusions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: transport_requests transport_requests_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transport_requests
    ADD CONSTRAINT transport_requests_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: transport_requests transport_requests_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transport_requests
    ADD CONSTRAINT transport_requests_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: transport_requests transport_requests_from_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transport_requests
    ADD CONSTRAINT transport_requests_from_location_id_fkey FOREIGN KEY (from_location_id) REFERENCES public.locations(id);


--
-- Name: transport_requests transport_requests_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transport_requests
    ADD CONSTRAINT transport_requests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: transport_requests transport_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transport_requests
    ADD CONSTRAINT transport_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: transport_requests transport_requests_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transport_requests
    ADD CONSTRAINT transport_requests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: transport_requests transport_requests_to_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transport_requests
    ADD CONSTRAINT transport_requests_to_location_id_fkey FOREIGN KEY (to_location_id) REFERENCES public.locations(id);


--
-- Name: tv_announcements tv_announcements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tv_announcements
    ADD CONSTRAINT tv_announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: tv_announcements tv_announcements_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tv_announcements
    ADD CONSTRAINT tv_announcements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tv_displays tv_displays_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tv_displays
    ADD CONSTRAINT tv_displays_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: tv_displays tv_displays_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tv_displays
    ADD CONSTRAINT tv_displays_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ur_payer_communications ur_payer_communications_communicated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ur_payer_communications
    ADD CONSTRAINT ur_payer_communications_communicated_by_fkey FOREIGN KEY (communicated_by) REFERENCES public.users(id);


--
-- Name: ur_payer_communications ur_payer_communications_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ur_payer_communications
    ADD CONSTRAINT ur_payer_communications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ur_status_conversions ur_status_conversions_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ur_status_conversions
    ADD CONSTRAINT ur_status_conversions_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: ur_status_conversions ur_status_conversions_converted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ur_status_conversions
    ADD CONSTRAINT ur_status_conversions_converted_by_fkey FOREIGN KEY (converted_by) REFERENCES public.users(id);


--
-- Name: ur_status_conversions ur_status_conversions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ur_status_conversions
    ADD CONSTRAINT ur_status_conversions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: user_facility_assignments user_facility_assignments_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_facility_assignments
    ADD CONSTRAINT user_facility_assignments_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON DELETE CASCADE;


--
-- Name: user_facility_assignments user_facility_assignments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_facility_assignments
    ADD CONSTRAINT user_facility_assignments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: user_hospital_assignments user_hospital_assignments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_hospital_assignments
    ADD CONSTRAINT user_hospital_assignments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: user_hospital_assignments user_hospital_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_hospital_assignments
    ADD CONSTRAINT user_hospital_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: users users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: utilization_reviews utilization_reviews_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilization_reviews
    ADD CONSTRAINT utilization_reviews_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: utilization_reviews utilization_reviews_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilization_reviews
    ADD CONSTRAINT utilization_reviews_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: utilization_reviews utilization_reviews_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilization_reviews
    ADD CONSTRAINT utilization_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users(id);


--
-- Name: utilization_reviews utilization_reviews_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilization_reviews
    ADD CONSTRAINT utilization_reviews_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: vendors vendors_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: visiting_hours visiting_hours_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visiting_hours
    ADD CONSTRAINT visiting_hours_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: visiting_hours visiting_hours_ward_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visiting_hours
    ADD CONSTRAINT visiting_hours_ward_id_fkey FOREIGN KEY (ward_id) REFERENCES public.locations(id);


--
-- Name: visitor_logs visitor_logs_logged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_logs
    ADD CONSTRAINT visitor_logs_logged_by_fkey FOREIGN KEY (logged_by) REFERENCES public.users(id);


--
-- Name: visitor_logs visitor_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_logs
    ADD CONSTRAINT visitor_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: visitor_passes visitor_passes_issued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_passes
    ADD CONSTRAINT visitor_passes_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.users(id);


--
-- Name: visitor_passes visitor_passes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_passes
    ADD CONSTRAINT visitor_passes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: visitor_passes visitor_passes_ward_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_passes
    ADD CONSTRAINT visitor_passes_ward_id_fkey FOREIGN KEY (ward_id) REFERENCES public.locations(id);


--
-- Name: visitor_registrations visitor_registrations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_registrations
    ADD CONSTRAINT visitor_registrations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: visitor_registrations visitor_registrations_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_registrations
    ADD CONSTRAINT visitor_registrations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: visitor_registrations visitor_registrations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_registrations
    ADD CONSTRAINT visitor_registrations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: visitor_registrations visitor_registrations_ward_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_registrations
    ADD CONSTRAINT visitor_registrations_ward_id_fkey FOREIGN KEY (ward_id) REFERENCES public.locations(id);


--
-- Name: vitals_capture_schedules vitals_capture_schedules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vitals_capture_schedules
    ADD CONSTRAINT vitals_capture_schedules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: vitals_capture_schedules vitals_capture_schedules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vitals_capture_schedules
    ADD CONSTRAINT vitals_capture_schedules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: vitals vitals_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vitals
    ADD CONSTRAINT vitals_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: vitals vitals_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vitals
    ADD CONSTRAINT vitals_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: vitals vitals_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vitals
    ADD CONSTRAINT vitals_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: vulnerabilities vulnerabilities_discovered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vulnerabilities
    ADD CONSTRAINT vulnerabilities_discovered_by_fkey FOREIGN KEY (discovered_by) REFERENCES public.users(id);


--
-- Name: vulnerabilities vulnerabilities_remediated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vulnerabilities
    ADD CONSTRAINT vulnerabilities_remediated_by_fkey FOREIGN KEY (remediated_by) REFERENCES public.users(id);


--
-- Name: ward_bed_mappings ward_bed_mappings_bed_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ward_bed_mappings
    ADD CONSTRAINT ward_bed_mappings_bed_location_id_fkey FOREIGN KEY (bed_location_id) REFERENCES public.locations(id);


--
-- Name: ward_bed_mappings ward_bed_mappings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ward_bed_mappings
    ADD CONSTRAINT ward_bed_mappings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: wards wards_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wards
    ADD CONSTRAINT wards_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: wards wards_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wards
    ADD CONSTRAINT wards_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: widget_templates widget_templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.widget_templates
    ADD CONSTRAINT widget_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: work_orders work_orders_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: work_orders work_orders_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id);


--
-- Name: work_orders work_orders_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: work_orders work_orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: workflow_instances workflow_instances_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_instances
    ADD CONSTRAINT workflow_instances_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: workflow_step_logs workflow_step_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_step_logs
    ADD CONSTRAINT workflow_step_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: wound_assessments wound_assessments_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wound_assessments
    ADD CONSTRAINT wound_assessments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: wound_assessments wound_assessments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wound_assessments
    ADD CONSTRAINT wound_assessments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

