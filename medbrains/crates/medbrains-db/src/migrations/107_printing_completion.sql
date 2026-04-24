-- 107_printing_completion.sql — Multi-entity branding + specialty/academic print templates

-- ══════════════════════════════════════════════════════════
--  Multi-Entity Branding
-- ══════════════════════════════════════════════════════════

-- Each tenant can have multiple brand entities (Hospital, Medical College, Trust)
-- Print templates reference the entity for header/logo selection.

CREATE TABLE IF NOT EXISTS brand_entities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    code            TEXT NOT NULL,                    -- 'hospital', 'medical_college', 'trust', 'pharmacy'
    name            TEXT NOT NULL,                    -- "Alagappa Medical College & Hospital"
    short_name      TEXT,                             -- "AMCH"
    logo_url        TEXT,
    address         TEXT,
    phone           TEXT,
    email           TEXT,
    registration_no TEXT,                             -- MCI/NMC/Trust registration
    is_default      BOOLEAN NOT NULL DEFAULT false,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, code)
);

ALTER TABLE brand_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY brand_entities_tenant ON brand_entities
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_brand_entities_tenant ON brand_entities(tenant_id);

CREATE TRIGGER trg_brand_entities_updated_at BEFORE UPDATE ON brand_entities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Link templates to brand entity
ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS brand_entity_id UUID REFERENCES brand_entities(id);

-- ══════════════════════════════════════════════════════════
--  Add academic template categories to enum
-- ══════════════════════════════════════════════════════════

DO $$ BEGIN
    ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'pg_logbook';
    ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'intern_logbook';
    ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'assessment';
    ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'certificate';
    ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'research_form';
    ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'hostel_form';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Enum values may already exist: %', SQLERRM;
END $$;

-- ══════════════════════════════════════════════════════════
--  Seed Academic Print Templates (skipped if no tenants)
-- ══════════════════════════════════════════════════════════

DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM tenants LIMIT 1) THEN
    RETURN;
END IF;

INSERT INTO document_templates (
    tenant_id, code, name, category, module_code, description,
    version, is_active, is_default, print_format,
    header_layout, body_layout, footer_layout
)
SELECT t.id, vals.code, vals.name, vals.category::document_template_category, vals.module_code, vals.description,
       1, true, false, 'a4_portrait'::print_format,
       '{"logo": true, "hospital_name": true}'::jsonb,
       vals.body::jsonb,
       '{"page_number": true, "printed_date": true}'::jsonb
FROM tenants t
CROSS JOIN (VALUES
    ('pg_logbook_case', 'PG Logbook Case Entry', 'pg_logbook', 'academic',
     'Case entry form for postgraduate logbook with HMS auto-populated patient data',
     '{"sections": [{"type": "heading", "text": "PG LOGBOOK — CASE ENTRY"}, {"type": "key_value", "rows": [{"field": "{{pg_name}}", "label": "PG Student"}, {"field": "{{department}}", "label": "Department"}, {"field": "{{date}}", "label": "Date"}]}, {"type": "patient_info", "fields": ["patient_name", "uhid", "age", "gender", "diagnosis"]}, {"type": "text", "field": "{{procedure_performed}}", "label": "Procedure"}, {"type": "text", "field": "{{learning_points}}", "label": "Learning Points"}, {"type": "signature_block", "signatures": [{"role": "pg_student", "label": "PG Student"}, {"role": "guide", "label": "Guide/Supervisor"}]}]}'),

    ('intern_logbook_entry', 'Intern Logbook Entry', 'intern_logbook', 'academic',
     'Internship logbook case/procedure entry form',
     '{"sections": [{"type": "heading", "text": "INTERN LOGBOOK ENTRY"}, {"type": "key_value", "rows": [{"field": "{{intern_name}}", "label": "Intern"}, {"field": "{{posting}}", "label": "Posting"}, {"field": "{{date}}", "label": "Date"}]}, {"type": "text", "field": "{{case_summary}}", "label": "Case Summary"}, {"type": "text", "field": "{{procedures}}", "label": "Procedures Assisted/Performed"}, {"type": "signature_block", "signatures": [{"role": "intern", "label": "Intern"}, {"role": "supervisor", "label": "Unit Head"}]}]}'),

    ('assessment_marksheet', 'Internal Assessment Mark Sheet', 'assessment', 'academic',
     'Internal assessment mark sheet for theory and practical exams',
     '{"sections": [{"type": "heading", "text": "INTERNAL ASSESSMENT MARK SHEET"}, {"type": "key_value", "rows": [{"field": "{{subject}}", "label": "Subject"}, {"field": "{{semester}}", "label": "Semester"}, {"field": "{{exam_date}}", "label": "Date"}]}, {"type": "table", "title": "Marks", "columns": [{"header": "Roll No", "field": "{{roll_no}}"}, {"header": "Student Name", "field": "{{student_name}}"}, {"header": "Theory", "field": "{{theory_marks}}"}, {"header": "Practical", "field": "{{practical_marks}}"}, {"header": "Total", "field": "{{total}}"}]}, {"type": "signature_block", "signatures": [{"role": "examiner", "label": "Examiner"}, {"role": "hod", "label": "HOD"}]}]}'),

    ('osce_scoring', 'OSCE Station Scoring Sheet', 'assessment', 'academic',
     'Objective Structured Clinical Examination station scoring sheet',
     '{"sections": [{"type": "heading", "text": "OSCE STATION SCORING"}, {"type": "key_value", "rows": [{"field": "{{station_no}}", "label": "Station"}, {"field": "{{skill_tested}}", "label": "Skill Tested"}, {"field": "{{time_allowed}}", "label": "Time (min)"}]}, {"type": "table", "title": "Scoring Criteria", "columns": [{"header": "Criterion", "field": "{{criterion}}"}, {"header": "Max Marks", "field": "{{max}}"}, {"header": "Obtained", "field": "{{obtained}}"}]}, {"type": "text", "field": "{{examiner_comments}}", "label": "Comments"}, {"type": "signature_block", "signatures": [{"role": "examiner", "label": "Examiner"}]}]}'),

    ('simulation_debrief', 'Simulation Session Debriefing', 'assessment', 'academic',
     'Post-simulation debriefing form with structured reflection',
     '{"sections": [{"type": "heading", "text": "SIMULATION DEBRIEFING FORM"}, {"type": "key_value", "rows": [{"field": "{{scenario}}", "label": "Scenario"}, {"field": "{{date}}", "label": "Date"}, {"field": "{{facilitator}}", "label": "Facilitator"}]}, {"type": "text", "field": "{{what_went_well}}", "label": "What Went Well"}, {"type": "text", "field": "{{areas_to_improve}}", "label": "Areas for Improvement"}, {"type": "text", "field": "{{action_plan}}", "label": "Action Plan"}, {"type": "signature_block", "signatures": [{"role": "participant", "label": "Participant"}, {"role": "facilitator", "label": "Facilitator"}]}]}'),

    ('cme_certificate', 'CME / FDP Certificate', 'certificate', 'academic',
     'Continuing Medical Education / Faculty Development Programme certificate with QR verification',
     '{"sections": [{"type": "heading", "text": "CERTIFICATE"}, {"type": "paragraph", "text": "This is to certify that"}, {"type": "key_value", "rows": [{"field": "{{participant_name}}", "label": "", "bold": true}]}, {"type": "paragraph", "text": "has successfully completed the"}, {"type": "key_value", "rows": [{"field": "{{program_title}}", "label": "Programme"}, {"field": "{{dates}}", "label": "Duration"}, {"field": "{{credit_hours}}", "label": "Credit Hours"}]}, {"type": "qr_code", "data": "verification_url"}, {"type": "signature_block", "signatures": [{"role": "organizer", "label": "Organizing Secretary"}, {"role": "dean", "label": "Dean"}]}]}'),

    ('iec_approval', 'IEC Ethics Approval Certificate', 'certificate', 'academic',
     'Institutional Ethics Committee approval certificate for research',
     '{"sections": [{"type": "heading", "text": "INSTITUTIONAL ETHICS COMMITTEE — APPROVAL CERTIFICATE"}, {"type": "key_value", "rows": [{"field": "{{protocol_no}}", "label": "Protocol No"}, {"field": "{{approval_date}}", "label": "Approval Date"}, {"field": "{{valid_until}}", "label": "Valid Until"}]}, {"type": "key_value", "rows": [{"field": "{{pi_name}}", "label": "Principal Investigator"}, {"field": "{{study_title}}", "label": "Study Title"}, {"field": "{{study_type}}", "label": "Study Type"}]}, {"type": "paragraph", "text": "The above research protocol has been reviewed and approved by the Institutional Ethics Committee."}, {"type": "signature_block", "signatures": [{"role": "iec_chair", "label": "IEC Chairman"}, {"role": "member_secretary", "label": "Member Secretary"}]}]}'),

    ('research_proposal', 'Research Proposal Submission', 'research_form', 'academic',
     'Structured research proposal submission form',
     '{"sections": [{"type": "heading", "text": "RESEARCH PROPOSAL"}, {"type": "key_value", "rows": [{"field": "{{pi_name}}", "label": "PI"}, {"field": "{{department}}", "label": "Department"}, {"field": "{{submission_date}}", "label": "Date"}]}, {"type": "text", "field": "{{title}}", "label": "Title"}, {"type": "text", "field": "{{objectives}}", "label": "Objectives"}, {"type": "text", "field": "{{methodology}}", "label": "Methodology"}, {"type": "text", "field": "{{sample_size}}", "label": "Sample Size & Duration"}, {"type": "text", "field": "{{budget}}", "label": "Budget"}, {"type": "signature_block", "signatures": [{"role": "pi", "label": "PI"}, {"role": "guide", "label": "Guide"}, {"role": "hod", "label": "HOD"}]}]}'),

    ('hostel_allotment', 'Hostel Room Allotment Order', 'hostel_form', 'academic',
     'Hostel room allotment order for students/PGs',
     '{"sections": [{"type": "heading", "text": "HOSTEL ROOM ALLOTMENT ORDER"}, {"type": "key_value", "rows": [{"field": "{{order_no}}", "label": "Order No"}, {"field": "{{date}}", "label": "Date"}]}, {"type": "key_value", "rows": [{"field": "{{student_name}}", "label": "Name"}, {"field": "{{roll_no}}", "label": "Roll No"}, {"field": "{{course}}", "label": "Course"}, {"field": "{{year}}", "label": "Year"}]}, {"type": "key_value", "rows": [{"field": "{{hostel_name}}", "label": "Hostel"}, {"field": "{{room_no}}", "label": "Room No"}, {"field": "{{from_date}}", "label": "From"}, {"field": "{{to_date}}", "label": "To"}]}, {"type": "signature_block", "signatures": [{"role": "warden", "label": "Warden"}, {"role": "dean_students", "label": "Dean of Students"}]}]}')
) AS vals(code, name, category, module_code, description, body)
WHERE NOT EXISTS (
    SELECT 1 FROM document_templates dt WHERE dt.tenant_id = t.id AND dt.code = vals.code
)
ON CONFLICT (tenant_id, code) DO NOTHING;

END $$;
