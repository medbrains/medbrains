-- ============================================================
-- MedBrains schema — module: core
-- ============================================================

--
-- PostgreSQL database dump
--



-- Dumped from database version 16.11
-- Dumped by pg_dump version 18.1 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;


SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;



--
-- Name: accreditation_body; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.accreditation_body AS ENUM (
    'nabh',
    'nmc',
    'nabl',
    'jci',
    'abdm',
    'naac',
    'other'
);



--
-- Name: address_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.address_type AS ENUM (
    'current',
    'permanent',
    'correspondence',
    'workplace',
    'temporary'
);



--
-- Name: adherence_event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.adherence_event_type AS ENUM (
    'dose_taken',
    'dose_missed',
    'dose_late',
    'refill_on_time',
    'refill_late',
    'refill_missed',
    'appointment_attended',
    'appointment_missed',
    'appointment_rescheduled'
);



--
-- Name: admission_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.admission_source AS ENUM (
    'er',
    'opd',
    'direct',
    'referral',
    'transfer_in'
);



--
-- Name: admission_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.admission_status AS ENUM (
    'admitted',
    'transferred',
    'discharged',
    'absconded',
    'deceased'
);



--
-- Name: advance_purpose; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.advance_purpose AS ENUM (
    'admission',
    'prepaid',
    'general',
    'procedure'
);



--
-- Name: advance_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.advance_status AS ENUM (
    'active',
    'partially_used',
    'fully_used',
    'refunded'
);



--
-- Name: adverse_event_severity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.adverse_event_severity AS ENUM (
    'mild',
    'moderate',
    'severe',
    'fatal'
);



--
-- Name: adverse_event_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.adverse_event_status AS ENUM (
    'draft',
    'submitted',
    'under_review',
    'closed',
    'withdrawn'
);



--
-- Name: allergy_severity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.allergy_severity AS ENUM (
    'mild',
    'moderate',
    'severe',
    'life_threatening'
);



--
-- Name: allergy_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.allergy_type AS ENUM (
    'drug',
    'food',
    'environmental',
    'latex',
    'contrast_dye',
    'biological',
    'other'
);



--
-- Name: ambulance_maintenance_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ambulance_maintenance_status AS ENUM (
    'scheduled',
    'in_progress',
    'completed',
    'overdue',
    'cancelled'
);



--
-- Name: ambulance_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ambulance_status AS ENUM (
    'available',
    'on_trip',
    'maintenance',
    'off_duty',
    'decommissioned'
);



--
-- Name: ambulance_trip_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ambulance_trip_priority AS ENUM (
    'critical',
    'urgent',
    'routine'
);



--
-- Name: ambulance_trip_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ambulance_trip_status AS ENUM (
    'requested',
    'dispatched',
    'en_route_pickup',
    'at_pickup',
    'en_route_drop',
    'at_drop',
    'completed',
    'cancelled'
);



--
-- Name: ambulance_trip_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ambulance_trip_type AS ENUM (
    'emergency',
    'scheduled',
    'inter_facility',
    'discharge'
);



--
-- Name: ambulance_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ambulance_type AS ENUM (
    'bls',
    'als',
    'patient_transport',
    'mortuary',
    'neonatal'
);



--
-- Name: anc_risk_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.anc_risk_category AS ENUM (
    'low',
    'moderate',
    'high',
    'very_high'
);



--
-- Name: anesthesia_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.anesthesia_type AS ENUM (
    'general',
    'spinal',
    'epidural',
    'regional_block',
    'local',
    'sedation',
    'combined'
);



--
-- Name: antibiotic_action; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.antibiotic_action AS ENUM (
    'initiate',
    'escalate',
    'de_escalate',
    'stop'
);



--
-- Name: antibiotic_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.antibiotic_request_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);



--
-- Name: appeal_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.appeal_status AS ENUM (
    'draft',
    'submitted',
    'in_review',
    'upheld',
    'overturned',
    'withdrawn'
);



--
-- Name: appointment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.appointment_status AS ENUM (
    'scheduled',
    'confirmed',
    'checked_in',
    'in_consultation',
    'completed',
    'cancelled',
    'no_show'
);



--
-- Name: appointment_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.appointment_type AS ENUM (
    'new_visit',
    'follow_up',
    'consultation',
    'procedure',
    'walk_in'
);



--
-- Name: asa_classification; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.asa_classification AS ENUM (
    'asa_1',
    'asa_2',
    'asa_3',
    'asa_4',
    'asa_5',
    'asa_6'
);



--
-- Name: audit_action; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.audit_action AS ENUM (
    'invoice_created',
    'invoice_issued',
    'invoice_cancelled',
    'payment_recorded',
    'payment_voided',
    'refund_created',
    'discount_applied',
    'discount_removed',
    'advance_collected',
    'advance_adjusted',
    'advance_refunded',
    'credit_note_created',
    'credit_note_applied',
    'claim_created',
    'claim_updated',
    'day_closed',
    'write_off_created',
    'write_off_approved',
    'invoice_cloned',
    'journal_entry_posted',
    'tds_deducted',
    'bank_reconciled',
    'gstr_filed',
    'threshold_alert',
    'erp_exported'
);



--
-- Name: bb_billing_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.bb_billing_status AS ENUM (
    'pending',
    'invoiced',
    'paid',
    'waived'
);



--
-- Name: bb_cold_chain_alert_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.bb_cold_chain_alert_level AS ENUM (
    'normal',
    'warning',
    'critical'
);



--
-- Name: bb_lookback_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.bb_lookback_status AS ENUM (
    'detected',
    'investigating',
    'notified',
    'closed'
);



--
-- Name: bb_return_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.bb_return_status AS ENUM (
    'requested',
    'inspecting',
    'accepted',
    'rejected'
);



--
-- Name: bed_reservation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.bed_reservation_status AS ENUM (
    'active',
    'confirmed',
    'cancelled',
    'expired',
    'fulfilled'
);



--
-- Name: bed_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.bed_status AS ENUM (
    'vacant_clean',
    'vacant_dirty',
    'reserved',
    'occupied',
    'occupied_transfer_pending',
    'maintenance',
    'blocked'
);



--
-- Name: bedside_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.bedside_request_status AS ENUM (
    'pending',
    'acknowledged',
    'in_progress',
    'completed',
    'cancelled'
);



--
-- Name: bedside_request_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.bedside_request_type AS ENUM (
    'nurse_call',
    'pain_management',
    'bathroom_assist',
    'water_food',
    'blanket_pillow',
    'position_change',
    'other'
);



--
-- Name: blood_bag_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.blood_bag_status AS ENUM (
    'collected',
    'processing',
    'tested',
    'available',
    'reserved',
    'crossmatched',
    'issued',
    'transfused',
    'returned',
    'expired',
    'discarded'
);



--
-- Name: blood_component_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.blood_component_type AS ENUM (
    'whole_blood',
    'prbc',
    'ffp',
    'platelets',
    'cryoprecipitate',
    'granulocytes'
);



--
-- Name: blood_group; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.blood_group AS ENUM (
    'a_positive',
    'a_negative',
    'b_positive',
    'b_negative',
    'ab_positive',
    'ab_negative',
    'o_positive',
    'o_negative',
    'unknown'
);



--
-- Name: bme_breakdown_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.bme_breakdown_priority AS ENUM (
    'critical',
    'high',
    'medium',
    'low'
);



--
-- Name: bme_breakdown_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.bme_breakdown_status AS ENUM (
    'reported',
    'acknowledged',
    'in_progress',
    'parts_awaited',
    'resolved',
    'closed'
);



--
-- Name: bme_calibration_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.bme_calibration_status AS ENUM (
    'calibrated',
    'due',
    'overdue',
    'out_of_tolerance',
    'exempted'
);



--
-- Name: bme_contract_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.bme_contract_type AS ENUM (
    'amc',
    'cmc',
    'warranty',
    'camc'
);



--
-- Name: bme_equipment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.bme_equipment_status AS ENUM (
    'active',
    'under_maintenance',
    'out_of_service',
    'condemned',
    'disposed'
);



--
-- Name: bme_pm_frequency; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.bme_pm_frequency AS ENUM (
    'monthly',
    'quarterly',
    'semi_annual',
    'annual'
);



--
-- Name: bme_risk_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.bme_risk_category AS ENUM (
    'critical',
    'high',
    'medium',
    'low'
);



--
-- Name: bme_work_order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.bme_work_order_status AS ENUM (
    'open',
    'assigned',
    'in_progress',
    'completed',
    'cancelled'
);



--
-- Name: bme_work_order_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.bme_work_order_type AS ENUM (
    'preventive',
    'corrective',
    'calibration',
    'installation',
    'inspection'
);



--
-- Name: body_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.body_status AS ENUM (
    'received',
    'cold_storage',
    'inquest_pending',
    'pm_scheduled',
    'pm_completed',
    'released',
    'unclaimed',
    'disposed'
);



--
-- Name: camp_followup_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.camp_followup_status AS ENUM (
    'scheduled',
    'completed',
    'missed',
    'cancelled'
);



--
-- Name: camp_registration_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.camp_registration_status AS ENUM (
    'registered',
    'screened',
    'referred',
    'converted',
    'no_show'
);



--
-- Name: camp_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.camp_status AS ENUM (
    'planned',
    'approved',
    'setup',
    'active',
    'completed',
    'cancelled'
);



--
-- Name: camp_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.camp_type AS ENUM (
    'general_health',
    'blood_donation',
    'vaccination',
    'eye_screening',
    'dental',
    'awareness',
    'specialized'
);



--
-- Name: capa_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.capa_status AS ENUM (
    'open',
    'in_progress',
    'completed',
    'verified',
    'overdue'
);



--
-- Name: care_plan_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.care_plan_status AS ENUM (
    'active',
    'resolved',
    'discontinued'
);



--
-- Name: case_mgmt_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.case_mgmt_status AS ENUM (
    'assigned',
    'active',
    'pending_discharge',
    'discharged',
    'closed'
);



--
-- Name: cath_device_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cath_device_type AS ENUM (
    'stent',
    'balloon',
    'guidewire',
    'catheter',
    'closure_device',
    'pacemaker',
    'icd',
    'lead',
    'other'
);



--
-- Name: cath_procedure_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cath_procedure_type AS ENUM (
    'diagnostic_cath',
    'pci',
    'pacemaker',
    'icd',
    'eps',
    'ablation',
    'valve_intervention',
    'structural',
    'peripheral'
);



--
-- Name: charge_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.charge_source AS ENUM (
    'opd',
    'ipd',
    'lab',
    'pharmacy',
    'procedure',
    'manual',
    'radiology',
    'ot',
    'emergency',
    'diet',
    'cssd',
    'ambulance'
);



--
-- Name: checklist_phase; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.checklist_phase AS ENUM (
    'sign_in',
    'time_out',
    'sign_out'
);



--
-- Name: chronic_program_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.chronic_program_type AS ENUM (
    'tb_dots',
    'hiv_art',
    'diabetes',
    'hypertension',
    'ckd',
    'copd',
    'asthma',
    'cancer_chemo',
    'mental_health',
    'epilepsy',
    'thyroid',
    'rheumatic',
    'other'
);



--
-- Name: cleaning_area_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cleaning_area_type AS ENUM (
    'icu',
    'ward',
    'ot',
    'er',
    'lab',
    'pharmacy',
    'corridor',
    'lobby',
    'washroom',
    'kitchen',
    'general'
);



--
-- Name: cleaning_task_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cleaning_task_status AS ENUM (
    'pending',
    'assigned',
    'in_progress',
    'completed',
    'verified',
    'rejected'
);



--
-- Name: clinical_assessment_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.clinical_assessment_type AS ENUM (
    'morse_fall_scale',
    'braden_scale',
    'gcs',
    'pain_vas',
    'pain_nrs',
    'pain_flacc',
    'barthel_adl',
    'norton_scale',
    'waterlow_score',
    'rass',
    'cam',
    'news2',
    'mews',
    'custom'
);



--
-- Name: cms_content_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cms_content_type AS ENUM (
    'article',
    'quick_post',
    'opinion',
    'case_study',
    'news',
    'event',
    'announcement'
);



--
-- Name: cms_post_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cms_post_status AS ENUM (
    'draft',
    'pending_review',
    'pending_medical_review',
    'approved',
    'published',
    'scheduled',
    'archived'
);



--
-- Name: comm_alert_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.comm_alert_status AS ENUM (
    'triggered',
    'acknowledged',
    'escalated',
    'resolved',
    'expired'
);



--
-- Name: comm_channel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.comm_channel AS ENUM (
    'sms',
    'whatsapp',
    'email',
    'push',
    'ivr',
    'portal'
);



--
-- Name: comm_clinical_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.comm_clinical_priority AS ENUM (
    'routine',
    'urgent',
    'critical',
    'stat'
);



--
-- Name: comm_complaint_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.comm_complaint_source AS ENUM (
    'walk_in',
    'phone',
    'email',
    'portal',
    'kiosk',
    'social_media',
    'google_review'
);



--
-- Name: comm_complaint_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.comm_complaint_status AS ENUM (
    'open',
    'assigned',
    'in_progress',
    'pending_review',
    'resolved',
    'closed',
    'reopened'
);



--
-- Name: comm_feedback_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.comm_feedback_type AS ENUM (
    'bedside',
    'post_discharge',
    'nps',
    'department',
    'kiosk'
);



--
-- Name: comm_message_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.comm_message_status AS ENUM (
    'queued',
    'sent',
    'delivered',
    'failed',
    'read'
);



--
-- Name: comm_template_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.comm_template_type AS ENUM (
    'appointment_reminder',
    'lab_result',
    'discharge_summary',
    'billing',
    'medication_reminder',
    'follow_up',
    'generic',
    'marketing'
);



--
-- Name: committee_frequency; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.committee_frequency AS ENUM (
    'weekly',
    'biweekly',
    'monthly',
    'quarterly',
    'biannual',
    'annual',
    'as_needed'
);



--
-- Name: compliance_checklist_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.compliance_checklist_status AS ENUM (
    'not_started',
    'in_progress',
    'compliant',
    'non_compliant',
    'not_applicable'
);



--
-- Name: compliance_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.compliance_status AS ENUM (
    'compliant',
    'partially_compliant',
    'non_compliant',
    'not_applicable'
);



--
-- Name: concession_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.concession_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'auto_applied'
);



--
-- Name: condemnation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.condemnation_status AS ENUM (
    'initiated',
    'committee_review',
    'approved',
    'condemned',
    'rejected'
);



--
-- Name: consent_audit_action; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.consent_audit_action AS ENUM (
    'created',
    'granted',
    'denied',
    'signed',
    'refused',
    'withdrawn',
    'revoked',
    'expired',
    'renewed',
    'amended'
);



--
-- Name: consent_capture_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.consent_capture_mode AS ENUM (
    'paper_signed',
    'digital_signature',
    'biometric',
    'otp_verified',
    'verbal_recorded'
);



--
-- Name: consent_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.consent_status AS ENUM (
    'granted',
    'denied',
    'withdrawn',
    'pending'
);



--
-- Name: consent_template_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.consent_template_category AS ENUM (
    'general',
    'surgical',
    'anesthesia',
    'blood_transfusion',
    'investigation',
    'data_sharing',
    'research',
    'photography',
    'teaching',
    'refusal',
    'advance_directive',
    'organ_donation',
    'communication',
    'custom'
);



--
-- Name: consent_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.consent_type AS ENUM (
    'general_treatment',
    'data_sharing',
    'abdm_linking',
    'research_participation',
    'sms_communication',
    'email_communication',
    'photography',
    'advance_directive',
    'organ_donation',
    'hie_participation'
);



--
-- Name: consumable_issue_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.consumable_issue_status AS ENUM (
    'issued',
    'returned',
    'billed'
);



--
-- Name: credential_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.credential_status AS ENUM (
    'active',
    'expired',
    'suspended',
    'revoked',
    'pending_renewal'
);



--
-- Name: credential_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.credential_type AS ENUM (
    'medical_council',
    'nursing_council',
    'pharmacy_council',
    'dental_council',
    'other_council',
    'bls',
    'acls',
    'pals',
    'nals',
    'fire_safety',
    'radiation_safety',
    'nabh_orientation'
);



--
-- Name: credit_patient_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.credit_patient_status AS ENUM (
    'active',
    'overdue',
    'suspended',
    'closed'
);



--
-- Name: crossmatch_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.crossmatch_status AS ENUM (
    'requested',
    'testing',
    'compatible',
    'incompatible',
    'issued',
    'cancelled'
);



--
-- Name: currency_code; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.currency_code AS ENUM (
    'INR',
    'USD',
    'EUR',
    'GBP',
    'AED',
    'SAR',
    'SGD',
    'BDT',
    'NPR',
    'LKR'
);



--
-- Name: day_close_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.day_close_status AS ENUM (
    'open',
    'verified',
    'discrepancy'
);



--
-- Name: death_cert_form_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.death_cert_form_type AS ENUM (
    'form_4',
    'form_4a'
);



--
-- Name: delivery_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.delivery_type AS ENUM (
    'normal_vaginal',
    'assisted_vaginal',
    'lscs_elective',
    'lscs_emergency',
    'breech'
);



--
-- Name: department_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.department_type AS ENUM (
    'clinical',
    'pre_clinical',
    'para_clinical',
    'administrative',
    'support',
    'academic'
);



--
-- Name: device_instance_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.device_instance_status AS ENUM (
    'pending_setup',
    'configuring',
    'testing',
    'active',
    'degraded',
    'disconnected',
    'maintenance',
    'decommissioned'
);



--
-- Name: device_message_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.device_message_status AS ENUM (
    'received',
    'parsed',
    'mapped',
    'validated',
    'delivered',
    'failed',
    'rejected',
    'dead_letter'
);



--
-- Name: device_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.device_type AS ENUM (
    'central_line',
    'urinary_catheter',
    'ventilator',
    'arterial_line',
    'peripheral_iv',
    'nasogastric_tube',
    'chest_tube',
    'tracheostomy'
);



--
-- Name: diet_order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.diet_order_status AS ENUM (
    'active',
    'modified',
    'completed',
    'cancelled'
);



--
-- Name: diet_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.diet_type AS ENUM (
    'regular',
    'diabetic',
    'renal',
    'cardiac',
    'liquid',
    'soft',
    'high_protein',
    'low_sodium',
    'npo',
    'custom'
);



--
-- Name: discharge_barrier_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.discharge_barrier_type AS ENUM (
    'insurance_auth',
    'placement',
    'equipment',
    'family',
    'transport',
    'financial',
    'clinical',
    'documentation',
    'other'
);



--
-- Name: discharge_summary_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.discharge_summary_status AS ENUM (
    'draft',
    'finalized'
);



--
-- Name: discharge_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.discharge_type AS ENUM (
    'normal',
    'lama',
    'dama',
    'absconded',
    'referred',
    'deceased',
    'death'
);



--
-- Name: dnr_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.dnr_status AS ENUM (
    'active',
    'expired',
    'revoked'
);



--
-- Name: document_output_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.document_output_status AS ENUM (
    'draft',
    'generated',
    'printed',
    'downloaded',
    'voided',
    'superseded'
);



--
-- Name: document_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.document_status AS ENUM (
    'draft',
    'under_review',
    'approved',
    'released',
    'revised',
    'obsolete'
);



--
-- Name: document_template_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.document_template_category AS ENUM (
    'prescription',
    'consultation_summary',
    'discharge_summary',
    'death_certificate',
    'consent_form',
    'lab_report',
    'radiology_report',
    'opd_bill',
    'ipd_bill',
    'receipt',
    'case_sheet_cover',
    'progress_note',
    'nursing_assessment',
    'mar_chart',
    'vitals_chart',
    'surgical_checklist',
    'anesthesia_record',
    'operation_note',
    'employee_id_card',
    'purchase_order',
    'patient_card',
    'wristband',
    'queue_token',
    'bmw_manifest',
    'pcpndt_form_f',
    'mlc_certificate',
    'referral_letter',
    'medical_certificate',
    'fitness_certificate',
    'blood_requisition',
    'diet_chart',
    'investigation_report',
    'transfer_summary',
    'admission_form',
    'against_medical_advice',
    'medico_legal_report',
    'birth_certificate',
    'duty_roster',
    'indent_form',
    'grn_form',
    'custom',
    'visitor_pass',
    'estimate',
    'credit_note',
    'gst_invoice',
    'insurance_form',
    'tds_certificate',
    'package_bill',
    'culture_report',
    'histopathology_report',
    'crossmatch_report',
    'component_issue',
    'patient_education',
    'appointment_slip',
    'interim_bill',
    'pg_logbook',
    'intern_logbook',
    'assessment',
    'certificate',
    'research_form',
    'hostel_form'
);



--
-- Name: donation_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.donation_type AS ENUM (
    'whole_blood',
    'apheresis_platelets',
    'apheresis_plasma'
);



--
-- Name: drug_screen_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.drug_screen_status AS ENUM (
    'ordered',
    'collected',
    'sent_to_lab',
    'mro_review',
    'positive',
    'negative',
    'inconclusive',
    'cancelled'
);



--
-- Name: ect_laterality; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ect_laterality AS ENUM (
    'bilateral',
    'right_unilateral',
    'left_unilateral'
);



--
-- Name: employee_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.employee_status AS ENUM (
    'active',
    'on_leave',
    'suspended',
    'resigned',
    'terminated',
    'retired',
    'absconding'
);



--
-- Name: employment_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.employment_type AS ENUM (
    'permanent',
    'contract',
    'visiting',
    'intern',
    'resident',
    'fellow',
    'volunteer',
    'outsourced'
);



--
-- Name: encounter_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.encounter_status AS ENUM (
    'open',
    'in_progress',
    'completed',
    'cancelled'
);



--
-- Name: encounter_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.encounter_type AS ENUM (
    'opd',
    'ipd',
    'emergency'
);



--
-- Name: enrollment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enrollment_status AS ENUM (
    'active',
    'completed',
    'discontinued',
    'transferred',
    'lost_to_followup',
    'deceased'
);



--
-- Name: er_visit_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.er_visit_status AS ENUM (
    'registered',
    'triaged',
    'in_treatment',
    'observation',
    'admitted',
    'discharged',
    'transferred',
    'lama',
    'deceased'
);



--
-- Name: erp_export_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.erp_export_status AS ENUM (
    'pending',
    'exported',
    'failed',
    'acknowledged'
);



--
-- Name: facility_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.facility_status AS ENUM (
    'active',
    'inactive',
    'under_construction',
    'closed'
);



--
-- Name: facility_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.facility_type AS ENUM (
    'main_hospital',
    'medical_college',
    'dental_college',
    'nursing_college',
    'pharmacy_college',
    'ayush_hospital',
    'research_center',
    'blood_bank',
    'dialysis_center',
    'trauma_center',
    'burn_center',
    'rehabilitation_center',
    'palliative_care',
    'psychiatric_hospital',
    'eye_hospital',
    'maternity_hospital',
    'pediatric_hospital',
    'cancer_center',
    'cardiac_center',
    'neuro_center',
    'ortho_center',
    'day_care_center',
    'diagnostic_center',
    'telemedicine_hub',
    'community_health_center',
    'primary_health_center',
    'sub_center',
    'urban_health_center',
    'mobile_health_unit',
    'other'
);



--
-- Name: field_data_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.field_data_type AS ENUM (
    'text',
    'email',
    'phone',
    'date',
    'datetime',
    'time',
    'select',
    'multiselect',
    'checkbox',
    'radio',
    'textarea',
    'number',
    'decimal',
    'file',
    'hidden',
    'computed',
    'boolean',
    'uuid_fk',
    'json'
);



--
-- Name: financial_class; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.financial_class AS ENUM (
    'self_pay',
    'insurance',
    'government_scheme',
    'corporate',
    'charity',
    'research'
);



--
-- Name: fms_drill_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fms_drill_type AS ENUM (
    'fire',
    'code_red',
    'evacuation',
    'chemical_spill',
    'bomb_threat'
);



--
-- Name: fms_energy_source_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fms_energy_source_type AS ENUM (
    'grid',
    'dg_set',
    'ups',
    'solar',
    'inverter'
);



--
-- Name: fms_fire_equipment_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fms_fire_equipment_type AS ENUM (
    'extinguisher_abc',
    'extinguisher_co2',
    'extinguisher_water',
    'hydrant',
    'hose_reel',
    'smoke_detector',
    'heat_detector',
    'sprinkler',
    'fire_alarm_panel',
    'emergency_light'
);



--
-- Name: fms_gas_source_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fms_gas_source_type AS ENUM (
    'psa_plant',
    'lmo_tank',
    'cylinder_manifold',
    'pipeline'
);



--
-- Name: fms_gas_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fms_gas_type AS ENUM (
    'oxygen',
    'nitrous_oxide',
    'nitrogen',
    'medical_air',
    'vacuum',
    'co2',
    'heliox'
);



--
-- Name: fms_water_source_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fms_water_source_type AS ENUM (
    'municipal',
    'borewell',
    'tanker',
    'ro_plant',
    'stp_recycled'
);



--
-- Name: fms_water_test_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fms_water_test_type AS ENUM (
    'bacteriological',
    'chemical',
    'endotoxin',
    'conductivity'
);



--
-- Name: fms_work_order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fms_work_order_status AS ENUM (
    'open',
    'assigned',
    'in_progress',
    'on_hold',
    'completed',
    'cancelled'
);



--
-- Name: form_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.form_status AS ENUM (
    'draft',
    'active',
    'deprecated'
);



--
-- Name: gender; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.gender AS ENUM (
    'male',
    'female',
    'other',
    'unknown'
);



--
-- Name: grn_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.grn_status AS ENUM (
    'draft',
    'inspecting',
    'accepted',
    'partially_accepted',
    'rejected',
    'completed'
);



--
-- Name: gst_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.gst_type AS ENUM (
    'cgst_sgst',
    'igst',
    'exempt'
);



--
-- Name: gstr_filing_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.gstr_filing_status AS ENUM (
    'draft',
    'validated',
    'filed',
    'accepted',
    'error'
);



--
-- Name: hai_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.hai_type AS ENUM (
    'clabsi',
    'cauti',
    'vap',
    'ssi',
    'cdiff',
    'mrsa',
    'other'
);



--
-- Name: hearing_test_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.hearing_test_type AS ENUM (
    'pta',
    'bera',
    'oae',
    'tympanometry',
    'speech_audiometry'
);



--
-- Name: hemodynamic_site; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.hemodynamic_site AS ENUM (
    'aorta',
    'lv',
    'rv',
    'ra',
    'la',
    'pa',
    'pcwp',
    'svg',
    'lm',
    'lad',
    'lcx',
    'rca',
    'other'
);



--
-- Name: hld_result; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.hld_result AS ENUM (
    'pass',
    'fail',
    'pending'
);



--
-- Name: hospital_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.hospital_type AS ENUM (
    'medical_college',
    'multi_specialty',
    'district_hospital',
    'community_health',
    'primary_health',
    'standalone_clinic',
    'eye_hospital',
    'dental_college'
);



--
-- Name: hygiene_moment; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.hygiene_moment AS ENUM (
    'before_patient',
    'before_aseptic',
    'after_body_fluid',
    'after_patient',
    'after_surroundings'
);



--
-- Name: icu_score_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.icu_score_type AS ENUM (
    'apache_ii',
    'apache_iv',
    'sofa',
    'gcs',
    'prism',
    'snappe',
    'rass',
    'cam_icu'
);



--
-- Name: identifier_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.identifier_type AS ENUM (
    'aadhaar',
    'pan',
    'voter_id',
    'driving_license',
    'passport',
    'ration_card',
    'ssn',
    'nhs_number',
    'medicare_number',
    'national_id',
    'birth_certificate',
    'employee_id',
    'disability_certificate',
    'abha',
    'abha_address',
    'emirates_id',
    'iqama',
    'uhid_external'
);



--
-- Name: incident_severity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.incident_severity AS ENUM (
    'near_miss',
    'minor',
    'moderate',
    'major',
    'sentinel'
);



--
-- Name: incident_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.incident_status AS ENUM (
    'reported',
    'acknowledged',
    'investigating',
    'rca_complete',
    'capa_assigned',
    'capa_in_progress',
    'closed',
    'reopened'
);



--
-- Name: indicator_frequency; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.indicator_frequency AS ENUM (
    'daily',
    'weekly',
    'monthly',
    'quarterly',
    'annually'
);



--
-- Name: indicator_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.indicator_type AS ENUM (
    'chemical',
    'biological'
);



--
-- Name: infection_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.infection_status AS ENUM (
    'suspected',
    'confirmed',
    'ruled_out'
);



--
-- Name: instrument_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.instrument_status AS ENUM (
    'available',
    'in_use',
    'decontaminating',
    'sterilizing',
    'sterile',
    'damaged',
    'condemned'
);



--
-- Name: insurance_scheme_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.insurance_scheme_type AS ENUM (
    'private',
    'cghs',
    'echs',
    'pmjay',
    'esis',
    'state_scheme'
);



--
-- Name: intake_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.intake_type AS ENUM (
    'oral',
    'iv_fluid',
    'iv_medication',
    'blood_product',
    'enteral_feed',
    'parenteral',
    'irrigation',
    'other'
);



--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_status AS ENUM (
    'draft',
    'issued',
    'partially_paid',
    'paid',
    'cancelled',
    'refunded'
);



--
-- Name: ip_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ip_type AS ENUM (
    'general',
    'semi_private',
    'private',
    'deluxe',
    'suite',
    'icu',
    'nicu',
    'picu',
    'hdu',
    'isolation',
    'nursery'
);



--
-- Name: ipd_clinical_doc_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ipd_clinical_doc_type AS ENUM (
    'wound_care',
    'central_line',
    'catheter',
    'drain',
    'restraint',
    'transfusion',
    'clinical_pathway',
    'other',
    'elopement_risk',
    'dialysis',
    'endoscopy',
    'chemotherapy',
    'blood_transfusion_checklist'
);



--
-- Name: journal_entry_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.journal_entry_status AS ENUM (
    'draft',
    'posted',
    'reversed'
);



--
-- Name: journal_entry_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.journal_entry_type AS ENUM (
    'manual',
    'auto_invoice',
    'auto_payment',
    'auto_refund',
    'auto_write_off',
    'auto_advance'
);



--
-- Name: lab_collection_center_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_collection_center_type AS ENUM (
    'hospital',
    'satellite',
    'partner',
    'camp'
);



--
-- Name: lab_dispatch_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_dispatch_method AS ENUM (
    'counter',
    'email',
    'sms',
    'whatsapp',
    'portal',
    'courier'
);



--
-- Name: lab_eqas_evaluation; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_eqas_evaluation AS ENUM (
    'acceptable',
    'marginal',
    'unacceptable',
    'pending'
);



--
-- Name: lab_home_collection_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_home_collection_status AS ENUM (
    'scheduled',
    'assigned',
    'in_transit',
    'arrived',
    'collected',
    'returned_to_lab',
    'cancelled'
);



--
-- Name: lab_order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_order_status AS ENUM (
    'ordered',
    'sample_collected',
    'processing',
    'completed',
    'verified',
    'cancelled'
);



--
-- Name: lab_outsource_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_outsource_status AS ENUM (
    'pending_send',
    'sent',
    'result_received',
    'cancelled'
);



--
-- Name: lab_payout_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_payout_status AS ENUM (
    'pending',
    'approved',
    'paid',
    'cancelled'
);



--
-- Name: lab_phlebotomy_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_phlebotomy_status AS ENUM (
    'waiting',
    'in_progress',
    'completed',
    'skipped'
);



--
-- Name: lab_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_priority AS ENUM (
    'routine',
    'urgent',
    'stat'
);



--
-- Name: lab_qc_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_qc_status AS ENUM (
    'accepted',
    'rejected',
    'warning'
);



--
-- Name: lab_report_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_report_status AS ENUM (
    'preliminary',
    'final',
    'amended'
);



--
-- Name: lab_result_flag; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_result_flag AS ENUM (
    'normal',
    'low',
    'high',
    'critical_low',
    'critical_high',
    'abnormal'
);



--
-- Name: lab_sample_archive_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_sample_archive_status AS ENUM (
    'stored',
    'retrieved',
    'discarded',
    'expired'
);



--
-- Name: lab_westgard_rule; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_westgard_rule AS ENUM (
    '1_2s',
    '1_3s',
    '2_2s',
    'r_4s',
    '4_1s',
    '10x'
);



--
-- Name: labor_stage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.labor_stage AS ENUM (
    'first_latent',
    'first_active',
    'second',
    'third',
    'completed'
);



--
-- Name: leave_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.leave_status AS ENUM (
    'draft',
    'pending_hod',
    'pending_admin',
    'approved',
    'rejected',
    'cancelled'
);



--
-- Name: leave_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.leave_type AS ENUM (
    'casual',
    'earned',
    'medical',
    'maternity',
    'paternity',
    'compensatory',
    'study',
    'special',
    'loss_of_pay'
);



--
-- Name: linen_contamination_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.linen_contamination_type AS ENUM (
    'regular',
    'contaminated',
    'isolation'
);



--
-- Name: linen_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.linen_status AS ENUM (
    'clean',
    'in_use',
    'soiled',
    'washing',
    'condemned'
);



--
-- Name: lms_content_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lms_content_type AS ENUM (
    'text',
    'video',
    'document',
    'slides',
    'scorm',
    'external_link'
);



--
-- Name: lms_enrollment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lms_enrollment_status AS ENUM (
    'assigned',
    'in_progress',
    'completed',
    'expired',
    'cancelled'
);



--
-- Name: lms_question_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lms_question_type AS ENUM (
    'single_choice',
    'multiple_choice',
    'true_false',
    'fill_blank'
);



--
-- Name: load_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.load_status AS ENUM (
    'loading',
    'running',
    'completed',
    'failed'
);



--
-- Name: location_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.location_level AS ENUM (
    'campus',
    'building',
    'floor',
    'wing',
    'zone',
    'room',
    'bed'
);



--
-- Name: mar_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.mar_status AS ENUM (
    'scheduled',
    'given',
    'held',
    'refused',
    'missed',
    'self_administered'
);



--
-- Name: marital_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.marital_status AS ENUM (
    'single',
    'married',
    'divorced',
    'widowed',
    'separated',
    'domestic_partner',
    'unknown'
);



--
-- Name: mass_casualty_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.mass_casualty_status AS ENUM (
    'activated',
    'ongoing',
    'scaling_down',
    'deactivated'
);



--
-- Name: meal_prep_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.meal_prep_status AS ENUM (
    'pending',
    'preparing',
    'ready',
    'dispatched',
    'delivered'
);



--
-- Name: meal_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.meal_type AS ENUM (
    'breakfast',
    'morning_snack',
    'lunch',
    'afternoon_snack',
    'dinner',
    'bedtime_snack'
);



--
-- Name: medication_event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.medication_event_type AS ENUM (
    'started',
    'dose_changed',
    'switched',
    'discontinued',
    'resumed',
    'held'
);



--
-- Name: mlc_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.mlc_status AS ENUM (
    'registered',
    'under_investigation',
    'opinion_given',
    'court_pending',
    'closed'
);



--
-- Name: module_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.module_status AS ENUM (
    'available',
    'enabled',
    'disabled',
    'coming_soon'
);



--
-- Name: mrd_movement_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.mrd_movement_status AS ENUM (
    'issued',
    'returned',
    'overdue'
);



--
-- Name: mrd_record_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.mrd_record_status AS ENUM (
    'active',
    'archived',
    'destroyed',
    'missing'
);



--
-- Name: mrd_register_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.mrd_register_type AS ENUM (
    'birth',
    'death'
);



--
-- Name: ndps_register_action; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ndps_register_action AS ENUM (
    'receipt',
    'dispensed',
    'destroyed',
    'transferred',
    'adjustment'
);



--
-- Name: nursing_shift; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.nursing_shift AS ENUM (
    'morning',
    'afternoon',
    'night'
);



--
-- Name: nursing_task_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.nursing_task_category AS ENUM (
    'vital_check',
    'wound_care',
    'catheter_care',
    'repositioning',
    'mouth_care',
    'hygiene',
    'mobilization',
    'teaching',
    'drain_care',
    'tracheostomy_care',
    'medication',
    'other'
);



--
-- Name: nursing_task_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.nursing_task_priority AS ENUM (
    'routine',
    'urgent',
    'stat'
);



--
-- Name: nutrition_route; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.nutrition_route AS ENUM (
    'enteral',
    'parenteral',
    'oral',
    'npo'
);



--
-- Name: order_set_context; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_set_context AS ENUM (
    'general',
    'admission',
    'pre_operative',
    'diagnosis_specific',
    'department_specific'
);



--
-- Name: order_set_item_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_set_item_type AS ENUM (
    'lab',
    'medication',
    'nursing',
    'diet'
);



--
-- Name: ot_booking_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ot_booking_status AS ENUM (
    'requested',
    'confirmed',
    'in_progress',
    'completed',
    'cancelled',
    'postponed'
);



--
-- Name: ot_case_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ot_case_priority AS ENUM (
    'elective',
    'urgent',
    'emergency'
);



--
-- Name: ot_consumable_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ot_consumable_category AS ENUM (
    'surgical_instrument',
    'implant',
    'disposable',
    'suture',
    'drug',
    'blood_product',
    'other'
);



--
-- Name: ot_room_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ot_room_status AS ENUM (
    'available',
    'in_use',
    'cleaning',
    'maintenance',
    'reserved'
);



--
-- Name: outbreak_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.outbreak_status AS ENUM (
    'suspected',
    'confirmed',
    'contained',
    'closed'
);



--
-- Name: output_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.output_type AS ENUM (
    'urine',
    'drain',
    'nasogastric',
    'vomit',
    'stool',
    'blood_loss',
    'wound_drainage',
    'chest_tube',
    'other'
);



--
-- Name: pa_urgency; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pa_urgency AS ENUM (
    'standard',
    'urgent',
    'retrospective'
);



--
-- Name: patient_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.patient_category AS ENUM (
    'general',
    'private',
    'insurance',
    'pmjay',
    'cghs',
    'staff',
    'vip',
    'mlc',
    'esi',
    'corporate',
    'free',
    'charity',
    'research_subject',
    'staff_dependent'
);



--
-- Name: payment_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_mode AS ENUM (
    'cash',
    'card',
    'upi',
    'bank_transfer',
    'cheque',
    'insurance',
    'credit'
);



--
-- Name: pcpndt_form_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pcpndt_form_status AS ENUM (
    'draft',
    'submitted',
    'registered',
    'expired'
);



--
-- Name: pharmacy_dispensing_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pharmacy_dispensing_type AS ENUM (
    'prescription',
    'otc',
    'discharge',
    'package',
    'emergency'
);



--
-- Name: pharmacy_payment_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pharmacy_payment_mode AS ENUM (
    'cash',
    'card',
    'upi',
    'insurance',
    'credit',
    'mixed'
);



--
-- Name: pharmacy_return_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pharmacy_return_status AS ENUM (
    'requested',
    'approved',
    'returned_to_stock',
    'destroyed',
    'rejected'
);



--
-- Name: pharmacy_rx_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pharmacy_rx_status AS ENUM (
    'pending_review',
    'approved',
    'rejected',
    'on_hold',
    'dispensing',
    'dispensed',
    'partially_dispensed',
    'cancelled'
);



--
-- Name: po_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.po_status AS ENUM (
    'draft',
    'submitted',
    'approved',
    'sent_to_vendor',
    'partially_received',
    'fully_received',
    'closed',
    'cancelled'
);



--
-- Name: postop_recovery_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.postop_recovery_status AS ENUM (
    'in_recovery',
    'stable',
    'shifted_to_ward',
    'shifted_to_icu',
    'discharged'
);



--
-- Name: preop_clearance_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.preop_clearance_status AS ENUM (
    'pending',
    'cleared',
    'not_cleared',
    'conditional'
);



--
-- Name: print_format; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.print_format AS ENUM (
    'a4_portrait',
    'a4_landscape',
    'a5_portrait',
    'a5_landscape',
    'thermal_80mm',
    'thermal_58mm',
    'label_50x25mm',
    'wristband',
    'custom'
);



--
-- Name: print_job_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.print_job_status AS ENUM (
    'queued',
    'printing',
    'completed',
    'failed',
    'cancelled'
);



--
-- Name: prior_auth_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.prior_auth_status AS ENUM (
    'draft',
    'pending_info',
    'submitted',
    'in_review',
    'approved',
    'partially_approved',
    'denied',
    'expired',
    'cancelled'
);



--
-- Name: progress_note_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.progress_note_type AS ENUM (
    'doctor_round',
    'nursing_note',
    'specialist_opinion',
    'dietitian_note',
    'physiotherapy_note',
    'social_worker_note',
    'discharge_note'
);



--
-- Name: psych_admission_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.psych_admission_category AS ENUM (
    'independent',
    'supported',
    'minor_supported',
    'emergency'
);



--
-- Name: queue_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.queue_priority AS ENUM (
    'normal',
    'elderly',
    'disabled',
    'pregnant',
    'emergency_referral',
    'vip'
);



--
-- Name: queue_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.queue_status AS ENUM (
    'waiting',
    'called',
    'in_consultation',
    'completed',
    'no_show'
);



--
-- Name: radiology_order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.radiology_order_status AS ENUM (
    'ordered',
    'scheduled',
    'in_progress',
    'completed',
    'reported',
    'verified',
    'cancelled'
);



--
-- Name: radiology_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.radiology_priority AS ENUM (
    'routine',
    'urgent',
    'stat'
);



--
-- Name: radiology_report_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.radiology_report_status AS ENUM (
    'draft',
    'preliminary',
    'final',
    'amended'
);



--
-- Name: radiopharmaceutical_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.radiopharmaceutical_type AS ENUM (
    'diagnostic',
    'therapeutic'
);



--
-- Name: rate_contract_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rate_contract_status AS ENUM (
    'draft',
    'active',
    'expired',
    'terminated'
);



--
-- Name: recon_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.recon_status AS ENUM (
    'unmatched',
    'matched',
    'discrepancy',
    'excluded'
);



--
-- Name: registration_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.registration_source AS ENUM (
    'walk_in',
    'phone',
    'online_portal',
    'mobile_app',
    'kiosk',
    'referral',
    'ambulance',
    'camp',
    'telemedicine'
);



--
-- Name: registration_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.registration_type AS ENUM (
    'new',
    'revisit',
    'transfer_in',
    'referral',
    'emergency',
    'camp',
    'telemedicine',
    'pre_registration'
);



--
-- Name: regulatory_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.regulatory_level AS ENUM (
    'international',
    'national',
    'state',
    'education'
);



--
-- Name: rehab_discipline; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rehab_discipline AS ENUM (
    'physiotherapy',
    'occupational_therapy',
    'speech_therapy',
    'psychology',
    'prosthetics_orthotics'
);



--
-- Name: requirement_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.requirement_level AS ENUM (
    'optional',
    'recommended',
    'conditional',
    'mandatory'
);



--
-- Name: restraint_check_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.restraint_check_status AS ENUM (
    'circulation_ok',
    'skin_intact',
    'repositioned',
    'released',
    'escalated'
);



--
-- Name: restraint_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.restraint_type AS ENUM (
    'physical',
    'chemical',
    'seclusion'
);



--
-- Name: retrospective_entry_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.retrospective_entry_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);



--
-- Name: rtw_clearance_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rtw_clearance_status AS ENUM (
    'pending_evaluation',
    'cleared_full',
    'cleared_with_restrictions',
    'not_cleared',
    'follow_up_required'
);



--
-- Name: scope_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.scope_status AS ENUM (
    'available',
    'in_use',
    'reprocessing',
    'quarantine',
    'decommissioned'
);



--
-- Name: screen_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.screen_type AS ENUM (
    'form',
    'list',
    'detail',
    'composite',
    'wizard',
    'dashboard',
    'calendar',
    'kanban'
);



--
-- Name: sec_access_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sec_access_method AS ENUM (
    'card',
    'biometric',
    'pin',
    'manual'
);



--
-- Name: sec_incident_severity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sec_incident_severity AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);



--
-- Name: sec_incident_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sec_incident_status AS ENUM (
    'reported',
    'investigating',
    'resolved',
    'closed'
);



--
-- Name: sec_patient_tag_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sec_patient_tag_type AS ENUM (
    'infant_rfid',
    'wander_guard',
    'elopement_risk'
);



--
-- Name: sec_tag_alert_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sec_tag_alert_status AS ENUM (
    'active',
    'alert_triggered',
    'resolved',
    'deactivated'
);



--
-- Name: sec_zone_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sec_zone_level AS ENUM (
    'public',
    'general',
    'restricted',
    'high_security',
    'critical'
);



--
-- Name: service_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.service_type AS ENUM (
    'consultation',
    'procedure',
    'investigation',
    'surgery',
    'therapy',
    'nursing',
    'support',
    'administrative'
);



--
-- Name: shift_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.shift_type AS ENUM (
    'morning',
    'afternoon',
    'evening',
    'night',
    'general',
    'split',
    'on_call',
    'custom'
);



--
-- Name: sidecar_trigger; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sidecar_trigger AS ENUM (
    'screen_load',
    'screen_exit',
    'form_submit',
    'form_validate',
    'form_save_draft',
    'field_change',
    'row_select',
    'row_action',
    'interval',
    'step_enter',
    'step_leave'
);



--
-- Name: signature_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.signature_type AS ENUM (
    'pen_on_paper',
    'digital_pen',
    'aadhaar_esign',
    'biometric_thumb',
    'otp',
    'video_consent',
    'verbal_witness'
);



--
-- Name: stemi_pathway_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.stemi_pathway_status AS ENUM (
    'door',
    'ecg',
    'cath_lab_activation',
    'arterial_access',
    'balloon_inflation',
    'completed'
);



--
-- Name: sterilization_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sterilization_method AS ENUM (
    'steam',
    'eto',
    'plasma',
    'dry_heat',
    'flash'
);



--
-- Name: stock_transfer_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.stock_transfer_status AS ENUM (
    'requested',
    'approved',
    'dispatched',
    'in_transit',
    'received',
    'cancelled'
);



--
-- Name: supplier_payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.supplier_payment_status AS ENUM (
    'pending',
    'partially_paid',
    'paid',
    'overdue',
    'disputed'
);



--
-- Name: tax_applicability; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tax_applicability AS ENUM (
    'taxable',
    'exempt',
    'zero_rated'
);



--
-- Name: tds_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tds_status AS ENUM (
    'deducted',
    'deposited',
    'certificate_issued'
);



--
-- Name: training_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.training_status AS ENUM (
    'scheduled',
    'in_progress',
    'completed',
    'cancelled',
    'failed'
);



--
-- Name: transfer_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.transfer_status AS ENUM (
    'requested',
    'approved',
    'in_transit',
    'received',
    'cancelled',
    'rejected'
);



--
-- Name: transfer_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.transfer_type AS ENUM (
    'inter_ward',
    'inter_department',
    'inter_hospital'
);



--
-- Name: transfusion_reaction_severity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.transfusion_reaction_severity AS ENUM (
    'mild',
    'moderate',
    'severe',
    'fatal'
);



--
-- Name: transport_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.transport_mode AS ENUM (
    'wheelchair',
    'stretcher',
    'walking',
    'porter',
    'ambulance'
);



--
-- Name: transport_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.transport_status AS ENUM (
    'requested',
    'assigned',
    'in_transit',
    'completed',
    'cancelled'
);



--
-- Name: triage_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.triage_level AS ENUM (
    'immediate',
    'emergent',
    'urgent',
    'less_urgent',
    'non_urgent',
    'expectant',
    'unassigned'
);



--
-- Name: ur_decision; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ur_decision AS ENUM (
    'approved',
    'denied',
    'pending_info',
    'modified',
    'escalated'
);



--
-- Name: ur_review_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ur_review_type AS ENUM (
    'pre_admission',
    'admission',
    'continued_stay',
    'retrospective'
);



--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'super_admin',
    'hospital_admin',
    'doctor',
    'nurse',
    'receptionist',
    'lab_technician',
    'pharmacist',
    'billing_clerk',
    'housekeeping_staff',
    'facilities_manager',
    'audit_officer'
);



--
-- Name: ved_class; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ved_class AS ENUM (
    'vital',
    'essential',
    'desirable'
);



--
-- Name: vendor_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vendor_status AS ENUM (
    'active',
    'inactive',
    'blacklisted',
    'pending_approval'
);



--
-- Name: ventilator_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ventilator_mode AS ENUM (
    'cmv',
    'acv',
    'simv',
    'psv',
    'cpap',
    'bipap',
    'hfov',
    'aprv',
    'niv',
    'other'
);



--
-- Name: verification_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.verification_status AS ENUM (
    'pending',
    'active',
    'inactive',
    'unknown',
    'error'
);



--
-- Name: visitor_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.visitor_category AS ENUM (
    'general',
    'legal_counsel',
    'religious',
    'vip',
    'media',
    'vendor',
    'emergency'
);



--
-- Name: visitor_pass_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.visitor_pass_status AS ENUM (
    'active',
    'expired',
    'revoked'
);



--
-- Name: waste_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.waste_category AS ENUM (
    'yellow',
    'red',
    'white_translucent',
    'blue',
    'cytotoxic',
    'chemical',
    'radioactive'
);



--
-- Name: watermark_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.watermark_type AS ENUM (
    'none',
    'draft',
    'confidential',
    'copy',
    'duplicate',
    'uncontrolled',
    'sample',
    'cancelled'
);



--
-- Name: widget_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.widget_type AS ENUM (
    'stat_card',
    'data_table',
    'list',
    'chart',
    'quick_actions',
    'module_embed',
    'form_embed',
    'system_health',
    'custom_html'
);



--
-- Name: workflow_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.workflow_status AS ENUM (
    'pending',
    'in_progress',
    'paused',
    'completed',
    'cancelled',
    'error'
);



--
-- Name: write_off_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.write_off_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);



--
-- Name: apply_department_rls(regclass, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_department_rls(tbl regclass, dept_col text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    short_name TEXT := regexp_replace(tbl::text, '^.*\.', '');
    policy_name TEXT := 'dept_scope_' || short_name;
BEGIN
    -- Department policy is additive to tenant isolation; both must pass.
    -- Postgres applies all permissive policies as OR within action, so we
    -- must declare this RESTRICTIVE so it AND-combines with tenant policy.
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %s', policy_name, tbl);

    EXECUTE format(
        'CREATE POLICY %I ON %s '
        || 'AS RESTRICTIVE '
        || 'USING (check_department_access(%I)) '
        || 'WITH CHECK (check_department_access(%I))',
        policy_name, tbl, dept_col, dept_col
    );
END $$;



--
-- Name: apply_tenant_rls(regclass); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_tenant_rls(tbl regclass) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    short_name TEXT := regexp_replace(tbl::text, '^.*\.', '');
    policy_name TEXT := 'tenant_isolation_' || short_name;
BEGIN
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);

    -- Drop existing policy with same name to make this idempotent
    EXECUTE format('DROP POLICY IF EXISTS %I ON %s', policy_name, tbl);

    EXECUTE format(
        'CREATE POLICY %I ON %s '
        || 'USING (tenant_id::text = current_setting(''app.tenant_id'', true)) '
        || 'WITH CHECK (tenant_id::text = current_setting(''app.tenant_id'', true))',
        policy_name, tbl
    );
END $$;



--
-- Name: apply_tenant_rls_with_global(regclass); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_tenant_rls_with_global(tbl regclass) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    short_name TEXT := regexp_replace(tbl::text, '^.*\.', '');
    policy_name TEXT := 'tenant_isolation_' || short_name;
BEGIN
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %s', policy_name, tbl);

    EXECUTE format(
        'CREATE POLICY %I ON %s '
        || 'USING (tenant_id IS NULL OR tenant_id::text = current_setting(''app.tenant_id'', true)) '
        || 'WITH CHECK (tenant_id IS NULL OR tenant_id::text = current_setting(''app.tenant_id'', true))',
        policy_name, tbl
    );
END $$;



--
-- Name: audit_trigger_func(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_trigger_func() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_tenant_id     UUID;
    v_user_id       UUID;
    v_ip_address    TEXT;
    v_user_agent    TEXT;
    v_session_id    UUID;
    v_correlation   UUID;
    v_old_values    JSONB;
    v_new_values    JSONB;
    v_entity_id     UUID;
    v_skip          BOOLEAN := false;
BEGIN
    -- Read context from session GUCs (set by application middleware)
    BEGIN
        v_tenant_id := NULLIF(current_setting('app.tenant_id', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN v_tenant_id := NULL;
    END;
    BEGIN
        v_user_id := NULLIF(current_setting('app.user_id', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN v_user_id := NULL;
    END;
    BEGIN
        v_ip_address := NULLIF(current_setting('app.ip_address', true), '');
    EXCEPTION WHEN OTHERS THEN v_ip_address := NULL;
    END;
    BEGIN
        v_user_agent := NULLIF(current_setting('app.user_agent', true), '');
    EXCEPTION WHEN OTHERS THEN v_user_agent := NULL;
    END;
    BEGIN
        v_session_id := NULLIF(current_setting('app.session_id', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN v_session_id := NULL;
    END;
    BEGIN
        v_correlation := NULLIF(current_setting('app.correlation_id', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN v_correlation := NULL;
    END;

    -- Without tenant context we cannot audit; bail out silently rather
    -- than failing the underlying write.
    IF v_tenant_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    IF (TG_OP = 'INSERT') THEN
        v_entity_id := (row_to_json(NEW)->>'id')::UUID;
        v_new_values := to_jsonb(NEW);
    ELSIF (TG_OP = 'UPDATE') THEN
        v_entity_id := (row_to_json(NEW)->>'id')::UUID;
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        -- Skip no-op updates that only changed updated_at
        IF v_old_values - 'updated_at' = v_new_values - 'updated_at' THEN
            v_skip := true;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        v_entity_id := (row_to_json(OLD)->>'id')::UUID;
        v_old_values := to_jsonb(OLD);
    END IF;

    -- HTTP middleware dedup: if we have a correlation_id and an audit row
    -- already exists for this correlation+entity within the last 5s, skip
    IF NOT v_skip AND v_correlation IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM audit_log
            WHERE correlation_id = v_correlation
              AND entity_id IS NOT DISTINCT FROM v_entity_id
              AND entity_type = TG_TABLE_NAME
              AND created_at > now() - INTERVAL '5 seconds'
        ) THEN
            v_skip := true;
        END IF;
    END IF;

    IF NOT v_skip THEN
        INSERT INTO audit_log (
            tenant_id, user_id, action, entity_type, entity_id,
            old_values, new_values, ip_address, user_agent,
            session_id, correlation_id, hash
        ) VALUES (
            v_tenant_id, v_user_id, TG_OP, TG_TABLE_NAME, v_entity_id,
            v_old_values, v_new_values, v_ip_address, v_user_agent,
            v_session_id, v_correlation, NULL
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
END $$;



--
-- Name: check_department_access(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_department_access(dept_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    dept_ids_raw TEXT;
    dept_ids UUID[];
BEGIN
    dept_ids_raw := current_setting('app.user_department_ids', true);
    IF dept_ids_raw IS NULL OR dept_ids_raw = '' OR dept_ids_raw = '{}' THEN
        RETURN TRUE;  -- no restriction
    END IF;
    dept_ids := dept_ids_raw::UUID[];
    RETURN dept_id = ANY(dept_ids) OR dept_id IS NULL;
END;
$$;



--
-- Name: next_queue_token_seq(uuid, uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.next_queue_token_seq(p_tenant_id uuid, p_department_id uuid, p_date date DEFAULT CURRENT_DATE) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_seq INT;
BEGIN
    SELECT COALESCE(MAX(token_seq), 0) + 1 INTO v_seq
    FROM queue_tokens
    WHERE tenant_id = p_tenant_id
      AND department_id = p_department_id
      AND token_date = p_date;
    RETURN v_seq;
END;
$$;



--
-- Name: update_integration_pipelines_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_integration_pipelines_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;



--
-- Name: update_screen_masters_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_screen_masters_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;



--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;



--
-- Name: validate_tenant_db_topology(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_tenant_db_topology() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.topology IN ('patroni', 'aurora_with_patroni_reads') THEN
        IF NEW.patroni_writer_url IS NULL OR NEW.patroni_reader_url IS NULL THEN
            RAISE EXCEPTION 'topology=%, patroni_writer_url AND patroni_reader_url required',
                            NEW.topology;
        END IF;
    END IF;
    RETURN NEW;
END $$;


SET default_tablespace = '';

SET default_table_access_method = heap;


--
-- Name: backup_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    backup_type text NOT NULL,
    backup_name text NOT NULL,
    file_path text,
    file_size_bytes bigint,
    status text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    verification_at timestamp with time zone,
    retention_days integer,
    expires_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: bed_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bed_states (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    location_id uuid NOT NULL,
    status public.bed_status DEFAULT 'vacant_clean'::public.bed_status NOT NULL,
    patient_id uuid,
    changed_by uuid,
    reason text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    cleaning_started_at timestamp with time zone,
    cleaning_completed_at timestamp with time zone,
    expected_discharge_at timestamp with time zone,
    blocked_reason text,
    reserved_for_patient uuid,
    reserved_until timestamp with time zone,
    ward_id uuid,
    admission_id uuid,
    is_isolation boolean DEFAULT false NOT NULL
);



--
-- Name: data_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_migrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    direction text NOT NULL,
    entity_type text NOT NULL,
    file_name text,
    file_path text,
    file_size_bytes bigint,
    status text DEFAULT 'pending'::text NOT NULL,
    total_records integer,
    processed_records integer,
    success_count integer,
    error_count integer,
    warning_count integer,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    initiated_by uuid NOT NULL,
    error_log jsonb DEFAULT '[]'::jsonb NOT NULL,
    mapping_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    options jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.data_migrations FORCE ROW LEVEL SECURITY;



--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    parent_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    department_type public.department_type NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    working_hours jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT chk_departments_code_length CHECK (((length(code) >= 2) AND (length(code) <= 20))),
    CONSTRAINT chk_departments_code_pattern CHECK ((code ~ '^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$'::text)),
    CONSTRAINT chk_departments_name_length CHECK (((length(name) >= 2) AND (length(name) <= 100)))
);



--
-- Name: job_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    job_type text NOT NULL,
    pipeline_id uuid,
    execution_id uuid,
    connector_id uuid,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    priority integer DEFAULT 5 NOT NULL,
    max_retries integer DEFAULT 3 NOT NULL,
    retry_count integer DEFAULT 0 NOT NULL,
    next_retry_at timestamp with time zone,
    locked_by text,
    locked_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    error text,
    correlation_id uuid DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT job_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text, 'dead_letter'::text])))
);



--
-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    parent_id uuid,
    level public.location_level NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    bed_type_id uuid,
    status text,
    CONSTRAINT chk_locations_code_length CHECK (((length(code) >= 2) AND (length(code) <= 20))),
    CONSTRAINT chk_locations_code_pattern CHECK ((code ~ '^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$'::text)),
    CONSTRAINT chk_locations_name_length CHECK (((length(name) >= 2) AND (length(name) <= 100)))
);



--
-- Name: master_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_config (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    module text NOT NULL,
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: regulatory_bodies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regulatory_bodies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    level public.regulatory_level NOT NULL,
    country_id uuid,
    state_id uuid,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: retrospective_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retrospective_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    source_table text NOT NULL,
    source_record_id uuid NOT NULL,
    clinical_event_date timestamp with time zone NOT NULL,
    entry_date timestamp with time zone DEFAULT now() NOT NULL,
    entered_by uuid NOT NULL,
    reason text NOT NULL,
    status public.retrospective_entry_status DEFAULT 'pending'::public.retrospective_entry_status NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: scheduled_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    pipeline_id uuid NOT NULL,
    name text NOT NULL,
    cron_expression text NOT NULL,
    timezone text DEFAULT 'Asia/Kolkata'::text NOT NULL,
    input_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    next_run_at timestamp with time zone NOT NULL,
    last_run_at timestamp with time zone,
    last_status text,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: sequences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sequences (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    seq_type text NOT NULL,
    prefix text DEFAULT ''::text NOT NULL,
    current_val bigint DEFAULT 0 NOT NULL,
    pad_width integer DEFAULT 5 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_sequences_pad_width CHECK (((pad_width >= 3) AND (pad_width <= 10))),
    CONSTRAINT chk_sequences_prefix_length CHECK ((length(prefix) <= 20))
);



--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    department_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    service_type public.service_type NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    workflow_template_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    description text,
    base_price numeric(12,2) DEFAULT 0 NOT NULL
);



--
-- Name: signed_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.signed_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    record_type text NOT NULL,
    record_id uuid NOT NULL,
    signer_user_id uuid NOT NULL,
    signer_role text NOT NULL,
    signer_credential_id uuid,
    signed_at timestamp with time zone DEFAULT now() NOT NULL,
    payload_hash bytea NOT NULL,
    signature_bytes bytea NOT NULL,
    display_image_snapshot text,
    display_block text,
    legal_class text NOT NULL,
    device_fingerprint text,
    ip_address inet,
    user_agent text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT signed_records_legal_class_check CHECK ((legal_class = ANY (ARRAY['administrative'::text, 'clinical'::text, 'medico_legal'::text, 'statutory_export'::text]))),
    CONSTRAINT signed_records_record_type_check CHECK ((record_type = ANY (ARRAY['prescription'::text, 'lab_report'::text, 'radiology_report'::text, 'discharge_summary'::text, 'mlc_certificate'::text, 'death_certificate'::text, 'fitness_certificate'::text, 'medical_leave_certificate'::text, 'birth_certificate'::text, 'consent_form'::text, 'operative_note'::text, 'progress_note'::text, 'package_subscription'::text, 'order_basket'::text, 'invoice'::text, 'refund'::text, 'other'::text]))),
    CONSTRAINT signed_records_signer_role_check CHECK ((signer_role = ANY (ARRAY['primary'::text, 'co_signer'::text, 'attestor'::text, 'witness'::text])))
);

ALTER TABLE ONLY public.signed_records FORCE ROW LEVEL SECURITY;



--
-- Name: system_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_state (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    mode text DEFAULT 'normal'::text NOT NULL,
    since timestamp with time zone DEFAULT now() NOT NULL,
    reason text,
    set_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT system_state_mode_check CHECK ((mode = ANY (ARRAY['normal'::text, 'degraded'::text, 'read_only'::text])))
);

ALTER TABLE ONLY public.system_state FORCE ROW LEVEL SECURITY;



--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    hospital_type public.hospital_type NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    address_line1 text,
    address_line2 text,
    city text,
    pincode text,
    phone text,
    email text,
    website text,
    logo_url text,
    registration_no text,
    accreditation text,
    timezone text DEFAULT 'Asia/Kolkata'::text NOT NULL,
    locale text DEFAULT 'en-IN'::text NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    fy_start_month integer DEFAULT 4 NOT NULL,
    latitude numeric(10,7),
    longitude numeric(10,7),
    country_id uuid,
    state_id uuid,
    district_id uuid,
    allowed_ips jsonb DEFAULT '[]'::jsonb NOT NULL,
    group_id uuid,
    region_id uuid,
    branch_code text,
    is_headquarters boolean DEFAULT false,
    CONSTRAINT chk_tenants_code_length CHECK (((length(code) >= 2) AND (length(code) <= 20))),
    CONSTRAINT chk_tenants_code_pattern CHECK ((code ~ '^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$'::text)),
    CONSTRAINT chk_tenants_currency_length CHECK ((length(currency) = 3)),
    CONSTRAINT chk_tenants_email_pattern CHECK (((email IS NULL) OR (email ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'::text))),
    CONSTRAINT chk_tenants_fy_start_month CHECK (((fy_start_month >= 1) AND (fy_start_month <= 12))),
    CONSTRAINT chk_tenants_name_length CHECK (((length(name) >= 2) AND (length(name) <= 100))),
    CONSTRAINT chk_tenants_pincode_digits CHECK (((pincode IS NULL) OR (pincode ~ '^\d{4,10}$'::text)))
);



--
-- Name: vulnerabilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vulnerabilities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    cve_id text,
    title text NOT NULL,
    description text,
    severity text NOT NULL,
    affected_component text NOT NULL,
    discovered_at timestamp with time zone DEFAULT now() NOT NULL,
    discovered_by uuid,
    remediation_status text,
    remediation_notes text,
    remediation_deadline date,
    remediated_at timestamp with time zone,
    remediated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.vulnerabilities FORCE ROW LEVEL SECURITY;



--
-- Name: workflow_instances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_instances (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    template_id uuid NOT NULL,
    patient_id uuid,
    status public.workflow_status DEFAULT 'pending'::public.workflow_status NOT NULL,
    current_step integer DEFAULT 0 NOT NULL,
    state jsonb DEFAULT '{}'::jsonb NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);



--
-- Name: workflow_step_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_step_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    instance_id uuid NOT NULL,
    step_index integer NOT NULL,
    step_name text NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    sla_met boolean,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);



--
-- Name: workflow_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    steps jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: backup_history backup_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_history
    ADD CONSTRAINT backup_history_pkey PRIMARY KEY (id);



--
-- Name: bed_states bed_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_states
    ADD CONSTRAINT bed_states_pkey PRIMARY KEY (id);



--
-- Name: bed_states bed_states_tenant_id_location_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_states
    ADD CONSTRAINT bed_states_tenant_id_location_id_key UNIQUE (tenant_id, location_id);



--
-- Name: data_migrations data_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_migrations
    ADD CONSTRAINT data_migrations_pkey PRIMARY KEY (id);



--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);



--
-- Name: departments departments_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: job_queue job_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_queue
    ADD CONSTRAINT job_queue_pkey PRIMARY KEY (id);



--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);



--
-- Name: locations locations_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: master_config master_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_config
    ADD CONSTRAINT master_config_pkey PRIMARY KEY (id);



--
-- Name: master_config master_config_tenant_id_module_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_config
    ADD CONSTRAINT master_config_tenant_id_module_key_key UNIQUE (tenant_id, module, key);



--
-- Name: regulatory_bodies regulatory_bodies_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulatory_bodies
    ADD CONSTRAINT regulatory_bodies_code_key UNIQUE (code);



--
-- Name: regulatory_bodies regulatory_bodies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulatory_bodies
    ADD CONSTRAINT regulatory_bodies_pkey PRIMARY KEY (id);



--
-- Name: retrospective_entries retrospective_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retrospective_entries
    ADD CONSTRAINT retrospective_entries_pkey PRIMARY KEY (id);



--
-- Name: scheduled_jobs scheduled_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_jobs
    ADD CONSTRAINT scheduled_jobs_pkey PRIMARY KEY (id);



--
-- Name: sequences sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sequences
    ADD CONSTRAINT sequences_pkey PRIMARY KEY (id);



--
-- Name: sequences sequences_tenant_id_seq_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sequences
    ADD CONSTRAINT sequences_tenant_id_seq_type_key UNIQUE (tenant_id, seq_type);



--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);



--
-- Name: services services_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: signed_records signed_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signed_records
    ADD CONSTRAINT signed_records_pkey PRIMARY KEY (id);



--
-- Name: system_state system_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_state
    ADD CONSTRAINT system_state_pkey PRIMARY KEY (id);



--
-- Name: system_state system_state_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_state
    ADD CONSTRAINT system_state_tenant_id_key UNIQUE (tenant_id);



--
-- Name: tenants tenants_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_code_key UNIQUE (code);



--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);



--
-- Name: vulnerabilities vulnerabilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vulnerabilities
    ADD CONSTRAINT vulnerabilities_pkey PRIMARY KEY (id);



--
-- Name: workflow_instances workflow_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_instances
    ADD CONSTRAINT workflow_instances_pkey PRIMARY KEY (id);



--
-- Name: workflow_step_logs workflow_step_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_step_logs
    ADD CONSTRAINT workflow_step_logs_pkey PRIMARY KEY (id);



--
-- Name: workflow_templates workflow_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_templates
    ADD CONSTRAINT workflow_templates_pkey PRIMARY KEY (id);



--
-- Name: workflow_templates workflow_templates_tenant_id_code_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_templates
    ADD CONSTRAINT workflow_templates_tenant_id_code_version_key UNIQUE (tenant_id, code, version);



--
-- Name: idx_backup_history_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backup_history_recent ON public.backup_history USING btree (started_at DESC);



--
-- Name: idx_bed_states_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bed_states_status ON public.bed_states USING btree (tenant_id, status);



--
-- Name: idx_bed_states_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bed_states_tenant ON public.bed_states USING btree (tenant_id);



--
-- Name: idx_bed_states_ward; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bed_states_ward ON public.bed_states USING btree (ward_id);



--
-- Name: idx_data_migrations_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_data_migrations_tenant ON public.data_migrations USING btree (tenant_id, created_at DESC);



--
-- Name: idx_departments_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_parent ON public.departments USING btree (parent_id);



--
-- Name: idx_departments_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_tenant ON public.departments USING btree (tenant_id);



--
-- Name: idx_job_queue_correlation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_queue_correlation ON public.job_queue USING btree (correlation_id);



--
-- Name: idx_job_queue_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_queue_pending ON public.job_queue USING btree (status, priority, created_at) WHERE (status = 'pending'::text);



--
-- Name: idx_job_queue_retry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_queue_retry ON public.job_queue USING btree (next_retry_at) WHERE ((status = 'failed'::text) AND (retry_count < max_retries));



--
-- Name: idx_job_queue_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_queue_tenant ON public.job_queue USING btree (tenant_id, status);



--
-- Name: idx_locations_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_locations_level ON public.locations USING btree (tenant_id, level);



--
-- Name: idx_locations_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_locations_parent ON public.locations USING btree (parent_id);



--
-- Name: idx_locations_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_locations_tenant ON public.locations USING btree (tenant_id);



--
-- Name: idx_master_config_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_config_tenant ON public.master_config USING btree (tenant_id);



--
-- Name: idx_regulatory_bodies_country; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_regulatory_bodies_country ON public.regulatory_bodies USING btree (country_id);



--
-- Name: idx_regulatory_bodies_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_regulatory_bodies_level ON public.regulatory_bodies USING btree (level);



--
-- Name: idx_retro_entries_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retro_entries_pending ON public.retrospective_entries USING btree (tenant_id, status) WHERE (status = 'pending'::public.retrospective_entry_status);



--
-- Name: idx_retro_entries_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retro_entries_source ON public.retrospective_entries USING btree (tenant_id, source_table, source_record_id);



--
-- Name: idx_scheduled_jobs_next; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_jobs_next ON public.scheduled_jobs USING btree (next_run_at) WHERE (is_active = true);



--
-- Name: idx_services_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_department ON public.services USING btree (department_id);



--
-- Name: idx_services_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_tenant ON public.services USING btree (tenant_id);



--
-- Name: idx_system_state_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_state_tenant ON public.system_state USING btree (tenant_id);



--
-- Name: idx_tenants_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_group ON public.tenants USING btree (group_id) WHERE (group_id IS NOT NULL);



--
-- Name: idx_tenants_region; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_region ON public.tenants USING btree (region_id) WHERE (region_id IS NOT NULL);



--
-- Name: idx_vulns_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vulns_severity ON public.vulnerabilities USING btree (tenant_id, severity, remediation_status);



--
-- Name: idx_workflow_instances_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_instances_patient ON public.workflow_instances USING btree (patient_id);



--
-- Name: idx_workflow_instances_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_instances_status ON public.workflow_instances USING btree (tenant_id, status);



--
-- Name: idx_workflow_instances_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_instances_tenant ON public.workflow_instances USING btree (tenant_id);



--
-- Name: idx_workflow_step_logs_instance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_step_logs_instance ON public.workflow_step_logs USING btree (instance_id);



--
-- Name: idx_workflow_step_logs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_step_logs_tenant ON public.workflow_step_logs USING btree (tenant_id);



--
-- Name: idx_workflow_templates_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_templates_tenant ON public.workflow_templates USING btree (tenant_id);



--
-- Name: signed_records_legal_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX signed_records_legal_idx ON public.signed_records USING btree (tenant_id, legal_class, signed_at DESC);



--
-- Name: signed_records_record_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX signed_records_record_idx ON public.signed_records USING btree (tenant_id, record_type, record_id);



--
-- Name: signed_records_signer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX signed_records_signer_idx ON public.signed_records USING btree (tenant_id, signer_user_id, signed_at DESC);



--
-- Name: regulatory_bodies set_updated_at_regulatory_bodies; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_regulatory_bodies BEFORE UPDATE ON public.regulatory_bodies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: system_state system_state_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER system_state_updated_at BEFORE UPDATE ON public.system_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: departments trg_departments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: locations trg_locations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_locations_updated_at BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: master_config trg_master_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_master_config_updated_at BEFORE UPDATE ON public.master_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: scheduled_jobs trg_scheduled_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scheduled_jobs_updated_at BEFORE UPDATE ON public.scheduled_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: sequences trg_sequences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sequences_updated_at BEFORE UPDATE ON public.sequences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: services trg_services_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: tenants trg_tenants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: workflow_templates trg_workflow_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_workflow_templates_updated_at BEFORE UPDATE ON public.workflow_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: backup_history backup_history_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_history
    ADD CONSTRAINT backup_history_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);



--
-- Name: bed_states bed_states_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_states
    ADD CONSTRAINT bed_states_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);



--
-- Name: bed_states bed_states_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_states
    ADD CONSTRAINT bed_states_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);



--
-- Name: data_migrations data_migrations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_migrations
    ADD CONSTRAINT data_migrations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);



--
-- Name: departments departments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.departments(id);



--
-- Name: departments departments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);



--
-- Name: services fk_services_workflow_template; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT fk_services_workflow_template FOREIGN KEY (workflow_template_id) REFERENCES public.workflow_templates(id);



--
-- Name: job_queue job_queue_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_queue
    ADD CONSTRAINT job_queue_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);



--
-- Name: locations locations_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.locations(id);



--
-- Name: locations locations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);



--
-- Name: master_config master_config_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_config
    ADD CONSTRAINT master_config_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);



--
-- Name: retrospective_entries retrospective_entries_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retrospective_entries
    ADD CONSTRAINT retrospective_entries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);



--
-- Name: scheduled_jobs scheduled_jobs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_jobs
    ADD CONSTRAINT scheduled_jobs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);



--
-- Name: sequences sequences_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sequences
    ADD CONSTRAINT sequences_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);



--
-- Name: services services_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);



--
-- Name: services services_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);



--
-- Name: signed_records signed_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signed_records
    ADD CONSTRAINT signed_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;



--
-- Name: system_state system_state_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_state
    ADD CONSTRAINT system_state_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);



--
-- Name: vulnerabilities vulnerabilities_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vulnerabilities
    ADD CONSTRAINT vulnerabilities_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);



--
-- Name: workflow_instances workflow_instances_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_instances
    ADD CONSTRAINT workflow_instances_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.workflow_templates(id);



--
-- Name: workflow_instances workflow_instances_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_instances
    ADD CONSTRAINT workflow_instances_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);



--
-- Name: workflow_step_logs workflow_step_logs_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_step_logs
    ADD CONSTRAINT workflow_step_logs_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.workflow_instances(id);



--
-- Name: workflow_step_logs workflow_step_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_step_logs
    ADD CONSTRAINT workflow_step_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);



--
-- Name: workflow_templates workflow_templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_templates
    ADD CONSTRAINT workflow_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);



--
-- Name: bed_states; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bed_states ENABLE ROW LEVEL SECURITY;


--
-- Name: data_migrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_migrations ENABLE ROW LEVEL SECURITY;


--
-- Name: departments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;


--
-- Name: services dept_scope_services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dept_scope_services ON public.services USING (public.check_department_access(department_id));



--
-- Name: job_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;


--
-- Name: locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;


--
-- Name: master_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master_config ENABLE ROW LEVEL SECURITY;


--
-- Name: retrospective_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.retrospective_entries ENABLE ROW LEVEL SECURITY;


--
-- Name: scheduled_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scheduled_jobs ENABLE ROW LEVEL SECURITY;


--
-- Name: scheduled_jobs scheduled_jobs_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY scheduled_jobs_tenant ON public.scheduled_jobs USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: sequences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;


--
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;


--
-- Name: signed_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.signed_records ENABLE ROW LEVEL SECURITY;


--
-- Name: system_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_state ENABLE ROW LEVEL SECURITY;


--
-- Name: retrospective_entries tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.retrospective_entries USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: bed_states tenant_isolation_bed_states; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_bed_states ON public.bed_states USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: data_migrations tenant_isolation_data_migrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_data_migrations ON public.data_migrations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: departments tenant_isolation_departments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_departments ON public.departments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: job_queue tenant_isolation_job_queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_job_queue ON public.job_queue USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: locations tenant_isolation_locations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_locations ON public.locations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: master_config tenant_isolation_master_config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_master_config ON public.master_config USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: sequences tenant_isolation_sequences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_sequences ON public.sequences USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: services tenant_isolation_services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_services ON public.services USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: signed_records tenant_isolation_signed_records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_signed_records ON public.signed_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: system_state tenant_isolation_system_state; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_system_state ON public.system_state USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: vulnerabilities tenant_isolation_vulnerabilities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_vulnerabilities ON public.vulnerabilities USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: workflow_instances tenant_isolation_workflow_instances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_workflow_instances ON public.workflow_instances USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: workflow_step_logs tenant_isolation_workflow_step_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_workflow_step_logs ON public.workflow_step_logs USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: workflow_templates tenant_isolation_workflow_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_workflow_templates ON public.workflow_templates USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: vulnerabilities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vulnerabilities ENABLE ROW LEVEL SECURITY;


--
-- Name: workflow_instances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_instances ENABLE ROW LEVEL SECURITY;


--
-- Name: workflow_step_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_step_logs ENABLE ROW LEVEL SECURITY;


--
-- Name: workflow_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;

