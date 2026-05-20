-- ====================================================================
-- Migration: 0124_clinical_corpus_entries.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: clinical_corpus_entries
-- Drops: none
-- ====================================================================

-- Clinical terminology and note-completion corpus.
-- Stores tenant-editable completion entries plus global MedBrains starter phrases.
-- External dictionaries/terminologies must be imported with source and license metadata.

CREATE TABLE IF NOT EXISTS public.clinical_corpus_entries (
    id uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    entry_key text NOT NULL,
    corpus_type varchar(40) NOT NULL DEFAULT 'medical_term',
    section varchar(64),
    term text NOT NULL,
    aliases text[] NOT NULL DEFAULT '{}'::text[],
    short_text text,
    insert_text text,
    source_name text NOT NULL DEFAULT 'MedBrains',
    source_url text,
    license_name text,
    license_status varchar(40) NOT NULL DEFAULT 'owned',
    source_version text,
    language varchar(16) NOT NULL DEFAULT 'en',
    priority integer NOT NULL DEFAULT 100,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES public.users(id),
    updated_by uuid REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT clinical_corpus_entries_corpus_type_check
        CHECK (corpus_type IN ('soap_phrase', 'medical_term', 'lay_term', 'icd10', 'icd11', 'snomed', 'loinc', 'rxnorm')),
    CONSTRAINT clinical_corpus_entries_license_status_check
        CHECK (license_status IN ('owned', 'open', 'licensed', 'restricted', 'reference_only'))
);

CREATE UNIQUE INDEX IF NOT EXISTS clinical_corpus_entries_key_idx
    ON public.clinical_corpus_entries (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), entry_key);

CREATE INDEX IF NOT EXISTS clinical_corpus_entries_lookup_idx
    ON public.clinical_corpus_entries (tenant_id, corpus_type, section, is_active, priority);

CREATE INDEX IF NOT EXISTS clinical_corpus_entries_aliases_idx
    ON public.clinical_corpus_entries USING gin (aliases);

-- Keep startup-safe immutable indexes here. A weighted full-text vector can be
-- added later as a materialized column/trigger if corpus volume requires it.
CREATE INDEX IF NOT EXISTS clinical_corpus_entries_term_prefix_idx
    ON public.clinical_corpus_entries (lower(term) text_pattern_ops);

CREATE INDEX IF NOT EXISTS clinical_corpus_entries_short_text_prefix_idx
    ON public.clinical_corpus_entries (lower(COALESCE(short_text, '')) text_pattern_ops);

DROP TRIGGER IF EXISTS trg_clinical_corpus_entries_updated_at ON public.clinical_corpus_entries;
CREATE TRIGGER trg_clinical_corpus_entries_updated_at
    BEFORE UPDATE ON public.clinical_corpus_entries
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.clinical_corpus_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinical_corpus_entries_read_tenant_or_global
    ON public.clinical_corpus_entries;
DROP POLICY IF EXISTS clinical_corpus_entries_write_tenant
    ON public.clinical_corpus_entries;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'clinical_corpus_entries'
          AND policyname = 'clinical_corpus_entries_read_tenant_or_global'
    ) THEN
        CREATE POLICY clinical_corpus_entries_read_tenant_or_global
            ON public.clinical_corpus_entries
            FOR SELECT
            USING (
                tenant_id IS NULL
                OR (tenant_id)::text = current_setting('app.tenant_id'::text, true)
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'clinical_corpus_entries'
          AND policyname = 'clinical_corpus_entries_write_tenant'
    ) THEN
        CREATE POLICY clinical_corpus_entries_write_tenant
            ON public.clinical_corpus_entries
            FOR ALL
            USING ((tenant_id)::text = current_setting('app.tenant_id'::text, true))
            WITH CHECK ((tenant_id)::text = current_setting('app.tenant_id'::text, true));
    END IF;
END
$$;

INSERT INTO public.clinical_corpus_entries
    (entry_key, corpus_type, section, term, aliases, short_text, insert_text, source_name, license_name, license_status, priority)
VALUES
    (
        'soap:s:visit-header',
        'soap_phrase',
        'chief_complaint',
        'visit header',
        ARRAY['date', 'time', 'provider', 'visit', 'present', 'chief'],
        'Date, time, provider and presenting complaint',
        'Date:
Time:
Provider:
This ___ year old ___ presents for ___.',
        'MedBrains SOAP starter corpus',
        'MedBrains owned template',
        'owned',
        10
    ),
    (
        'soap:s:hpi',
        'soap_phrase',
        'chief_complaint',
        'HPI scaffold',
        ARRAY['hpi', 'history', 'onset', 'location', 'duration', 'severity', 'timing'],
        'Location, quality, severity, timing, context and associated symptoms',
        'History of present illness:
Location:
Quality:
Severity:
Duration:
Timing/onset:
Timing/frequency:
Context:
Relieved by:
Worsened by:
Associated signs and symptoms:',
        'MedBrains SOAP starter corpus',
        'MedBrains owned template',
        'owned',
        20
    ),
    (
        'soap:s:ros',
        'soap_phrase',
        'chief_complaint',
        'ROS systems',
        ARRAY['ros', 'review', 'symptoms', 'systems', 'constitutional', 'cardio', 'neuro'],
        'Problem-focused review of systems',
        'Review of systems:
Constitutional:
Eyes:
ENT:
Cardiovascular:
Respiratory:
Gastrointestinal:
Genitourinary:
Musculoskeletal:
Skin/breast:
Neurological:
Psychiatric:
Endocrine:
Hematologic/lymphatic:
Allergic/immunologic:',
        'MedBrains SOAP starter corpus',
        'MedBrains owned template',
        'owned',
        30
    ),
    (
        'soap:s:social-history',
        'soap_phrase',
        'chief_complaint',
        'social history',
        ARRAY['social', 'culture', 'education', 'housing', 'occupation', 'tobacco', 'alcohol'],
        'Social determinants and habits relevant to care',
        'Social history:
Cultural background:
Education level:
Economic condition:
Housing:
Number in household:
Marital status:
Lives with:
Children:
Occupation:
Occupational hazards:
Nutrition:
Exercise:
Tobacco use:
Caffeine:
Sexual activity/contraception:
Alcohol/recreational drug use:',
        'MedBrains SOAP starter corpus',
        'MedBrains owned template',
        'owned',
        40
    ),
    (
        'soap:s:past-medical-history',
        'soap_phrase',
        'chief_complaint',
        'past medical history',
        ARRAY['pmh', 'past', 'medical', 'hospitalization', 'surgery', 'chronic'],
        'Hospitalizations, surgeries and chronic problems',
        'Past medical history:
Hospitalizations:
Surgical history:
Chronic medical problems: hypertension, diabetes, coronary heart disease, cerebrovascular disease, asthma/COPD, arthritis, gout, renal disease, thyroid disease, other.',
        'MedBrains SOAP starter corpus',
        'MedBrains owned template',
        'owned',
        50
    ),
    (
        'soap:o:vitals',
        'soap_phrase',
        'examination',
        'vitals block',
        ARRAY['vitals', 'bp', 'pulse', 'temperature', 'spo2', 'weight', 'height'],
        'Vitals in objective format',
        'Vitals: height ___, weight ___, temperature ___, BP ___, pulse ___, RR ___, SpO2 ___.',
        'MedBrains SOAP starter corpus',
        'MedBrains owned template',
        'owned',
        10
    ),
    (
        'soap:o:general-normal',
        'soap_phrase',
        'examination',
        'general normal',
        ARRAY['general', 'appearance', 'oriented', 'distress', 'ambulating'],
        'General examination line',
        'General: well appearing, well nourished, no distress. Oriented x3, normal mood and affect. Ambulating without difficulty.',
        'MedBrains SOAP starter corpus',
        'MedBrains owned template',
        'owned',
        20
    ),
    (
        'soap:o:heent',
        'soap_phrase',
        'examination',
        'HEENT normal',
        ARRAY['heent', 'head', 'eyes', 'ears', 'nose', 'mouth', 'pharynx'],
        'Head, eyes, ears, nose, mouth and pharynx',
        'HEENT:
Head: normocephalic, atraumatic.
Eyes: conjunctiva clear, sclera non-icteric, EOM intact, PERRL.
Ears: canals clear, tympanic membranes mobile, hearing intact.
Nose: mucosa non-inflamed, septum and turbinates normal.
Mouth/pharynx: mucous membranes moist, no mucosal lesions or exudate.',
        'MedBrains SOAP starter corpus',
        'MedBrains owned template',
        'owned',
        30
    ),
    (
        'soap:o:neck-heart-lungs',
        'soap_phrase',
        'examination',
        'neck heart lungs',
        ARRAY['neck', 'heart', 'cardio', 'lungs', 'respiratory', 'chest'],
        'Neck and cardiorespiratory examination',
        'Neck: supple, no lesions, bruits or adenopathy; thyroid non-enlarged and non-tender.
Heart: regular rate and rhythm, no murmur or gallop.
Lungs: clear to auscultation and percussion.',
        'MedBrains SOAP starter corpus',
        'MedBrains owned template',
        'owned',
        40
    ),
    (
        'soap:o:abdomen-back',
        'soap_phrase',
        'examination',
        'abdomen back',
        ARRAY['abdomen', 'back', 'bowel', 'cva', 'gastro'],
        'Abdomen and back examination',
        'Abdomen: bowel sounds normal, no tenderness, organomegaly, masses or hernia.
Back: spine normal without deformity or tenderness; no CVA tenderness.',
        'MedBrains SOAP starter corpus',
        'MedBrains owned template',
        'owned',
        50
    ),
    (
        'soap:o:msk-neuro',
        'soap_phrase',
        'examination',
        'MSK/neuro',
        ARRAY['msk', 'musculoskeletal', 'neuro', 'gait', 'spine', 'reflex'],
        'Musculoskeletal and neurological examination',
        'Musculoskeletal: normal gait and station, no deformity, focal tenderness, effusion, instability or abnormal tone.
Neurologic: cranial nerves grossly intact, sensation intact, reflexes appropriate.',
        'MedBrains SOAP starter corpus',
        'MedBrains owned template',
        'owned',
        60
    ),
    (
        'soap:a:assessment',
        'soap_phrase',
        'history',
        'assessment scaffold',
        ARRAY['assessment', 'impression', 'diagnosis', 'differential', 'risk'],
        'Clinical impression and differential',
        'Assessment:
Health status and lifestyle risks:
Primary diagnosis:
Differential diagnosis:
Severity/risk:',
        'MedBrains SOAP starter corpus',
        'MedBrains owned template',
        'owned',
        10
    ),
    (
        'soap:a:problem-list',
        'soap_phrase',
        'history',
        'problem list',
        ARRAY['problem', 'problems', 'status', 'evidence'],
        'Problem-oriented assessment',
        'Problem list:
1. ___ - status ___ - evidence ___.
2. ___ - status ___ - evidence ___.',
        'MedBrains SOAP starter corpus',
        'MedBrains owned template',
        'owned',
        20
    ),
    (
        'soap:p:labs-imaging',
        'soap_phrase',
        'plan',
        'labs/imaging',
        ARRAY['lab', 'labs', 'xray', 'x-ray', 'imaging', 'investigation'],
        'Investigation orders',
        'Laboratory:
X-rays/imaging:
Other investigations:',
        'MedBrains SOAP starter corpus',
        'MedBrains owned template',
        'owned',
        10
    ),
    (
        'soap:p:medication-plan',
        'soap_phrase',
        'plan',
        'medication plan',
        ARRAY['med', 'meds', 'medicine', 'drug', 'dose', 'rx'],
        'Medicine dose, duration and reconciliation',
        'Medications:
Dose/frequency/duration:
Allergy and interaction risk reviewed:
Medication reconciliation updated:',
        'MedBrains SOAP starter corpus',
        'MedBrains owned template',
        'owned',
        20
    ),
    (
        'soap:p:education-followup',
        'soap_phrase',
        'plan',
        'education and follow-up',
        ARRAY['education', 'counsel', 'warning', 'advice', 'explain', 'follow', 'review', 'return'],
        'Patient education, warning signs and follow-up',
        'Patient education: diagnosis explained, warning signs discussed, medicine use explained, questions answered.
Follow-up: review in ___ days/weeks, earlier if ___.',
        'MedBrains SOAP starter corpus',
        'MedBrains owned template',
        'owned',
        30
    )
ON CONFLICT DO NOTHING;
