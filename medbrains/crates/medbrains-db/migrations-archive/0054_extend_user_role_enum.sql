-- Extend user_role enum to cover module-specific operational roles
-- (MRD, canteen, security, BME, ambulance, radiology tech, CSSD, blood bank,
--  front office, infection control, procurement, store keeper, HR, camp,
--  insurance, OT, dietitian, plus prior gaps in seed).
--
-- ALTER TYPE ... ADD VALUE is non-transactional; each statement runs alone.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'quality_officer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'occ_health_officer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'utilization_reviewer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'case_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'scheduling_admin';

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'mrd_officer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'canteen_staff';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'dietitian';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'security_guard';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'biomed_engineer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ambulance_driver';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'radiology_tech';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'cssd_technician';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'blood_bank_tech';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'front_office_staff';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'infection_control_officer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'procurement_officer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'store_keeper';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hr_officer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'camp_coordinator';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'insurance_officer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ot_staff';
