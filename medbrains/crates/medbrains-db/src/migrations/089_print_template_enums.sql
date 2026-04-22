-- Migration 089: Add missing enum values for print templates
-- Must be a separate migration so values are committed before use in 090

DO $$ BEGIN
    ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'visitor_pass';
    ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'estimate';
    ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'credit_note';
    ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'gst_invoice';
    ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'insurance_form';
    ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'tds_certificate';
    ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'package_bill';
    ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'culture_report';
    ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'histopathology_report';
    ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'crossmatch_report';
    ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'component_issue';
    ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'patient_education';
    ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'appointment_slip';
    ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'interim_bill';
END $$;
