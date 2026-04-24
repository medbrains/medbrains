-- 108_academic_templates.sql — Seed academic print templates
-- Enum values added in 107 (must be committed before use)

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
     'PG logbook case entry with HMS auto-populated patient data',
     '{"sections": [{"type": "heading", "text": "PG LOGBOOK CASE ENTRY"}]}'),
    ('intern_logbook_entry', 'Intern Logbook Entry', 'intern_logbook', 'academic',
     'Internship logbook entry form',
     '{"sections": [{"type": "heading", "text": "INTERN LOGBOOK ENTRY"}]}'),
    ('assessment_marksheet', 'Internal Assessment Mark Sheet', 'assessment', 'academic',
     'Internal assessment mark sheet',
     '{"sections": [{"type": "heading", "text": "INTERNAL ASSESSMENT MARK SHEET"}]}'),
    ('osce_scoring', 'OSCE Station Scoring Sheet', 'assessment', 'academic',
     'OSCE station scoring sheet',
     '{"sections": [{"type": "heading", "text": "OSCE STATION SCORING"}]}'),
    ('simulation_debrief', 'Simulation Debriefing', 'assessment', 'academic',
     'Post-simulation debriefing form',
     '{"sections": [{"type": "heading", "text": "SIMULATION DEBRIEFING"}]}'),
    ('cme_certificate', 'CME / FDP Certificate', 'certificate', 'academic',
     'CME certificate with QR verification',
     '{"sections": [{"type": "heading", "text": "CERTIFICATE"}]}'),
    ('iec_approval', 'IEC Ethics Approval', 'certificate', 'academic',
     'Ethics committee approval certificate',
     '{"sections": [{"type": "heading", "text": "IEC APPROVAL CERTIFICATE"}]}'),
    ('research_proposal', 'Research Proposal', 'research_form', 'academic',
     'Research proposal submission form',
     '{"sections": [{"type": "heading", "text": "RESEARCH PROPOSAL"}]}'),
    ('hostel_allotment', 'Hostel Room Allotment', 'hostel_form', 'academic',
     'Hostel room allotment order',
     '{"sections": [{"type": "heading", "text": "HOSTEL ROOM ALLOTMENT ORDER"}]}')
) AS vals(code, name, category, module_code, description, body)
WHERE NOT EXISTS (
    SELECT 1 FROM document_templates dt WHERE dt.tenant_id = t.id AND dt.code = vals.code
)
ON CONFLICT (tenant_id, code) DO NOTHING;

END $$;
