-- 111: Learning Management System (LMS)
-- Extends HR training infrastructure with courses, quizzes, learning paths,
-- certificates, and compliance tracking.

-- ══════════════════════════════════════════════════════════
--  ENUMS
-- ══════════════════════════════════════════════════════════

CREATE TYPE lms_content_type AS ENUM (
    'text', 'video', 'document', 'slides', 'scorm', 'external_link'
);

CREATE TYPE lms_enrollment_status AS ENUM (
    'assigned', 'in_progress', 'completed', 'expired', 'cancelled'
);

CREATE TYPE lms_question_type AS ENUM (
    'single_choice', 'multiple_choice', 'true_false', 'fill_blank'
);

-- ══════════════════════════════════════════════════════════
--  1. COURSES
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lms_courses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    code                TEXT NOT NULL,
    title               TEXT NOT NULL,
    description         TEXT,
    category            TEXT NOT NULL DEFAULT 'general',
    duration_hours      NUMERIC(5,1),
    is_mandatory        BOOLEAN NOT NULL DEFAULT false,
    target_roles        JSONB NOT NULL DEFAULT '[]',
    thumbnail_url       TEXT,
    content_type        lms_content_type NOT NULL DEFAULT 'text',
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_by          UUID REFERENCES users(id),
    training_program_id UUID REFERENCES training_programs(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, code)
);

ALTER TABLE lms_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY lms_courses_tenant ON lms_courses
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_lms_courses_tenant ON lms_courses(tenant_id);
CREATE INDEX idx_lms_courses_active ON lms_courses(tenant_id, is_active) WHERE is_active = true;
CREATE INDEX idx_lms_courses_category ON lms_courses(tenant_id, category);

CREATE TRIGGER trg_lms_courses_updated_at BEFORE UPDATE ON lms_courses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════
--  2. COURSE MODULES (lessons/sections within a course)
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lms_course_modules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id   UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT,
    sort_order  INT NOT NULL DEFAULT 0,
    content     JSONB NOT NULL DEFAULT '{}',
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lms_modules_course ON lms_course_modules(course_id, sort_order);

CREATE TRIGGER trg_lms_modules_updated_at BEFORE UPDATE ON lms_course_modules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════
--  3. QUIZZES
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lms_quizzes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id           UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    description         TEXT,
    pass_percentage     INT NOT NULL DEFAULT 70,
    max_attempts        INT NOT NULL DEFAULT 3,
    time_limit_minutes  INT,
    shuffle_questions   BOOLEAN NOT NULL DEFAULT true,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lms_quizzes_course ON lms_quizzes(course_id);

CREATE TRIGGER trg_lms_quizzes_updated_at BEFORE UPDATE ON lms_quizzes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════
--  4. QUIZ QUESTIONS
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lms_quiz_questions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id         UUID NOT NULL REFERENCES lms_quizzes(id) ON DELETE CASCADE,
    question_text   TEXT NOT NULL,
    question_type   lms_question_type NOT NULL DEFAULT 'single_choice',
    options         JSONB NOT NULL DEFAULT '[]',
    correct_answer  JSONB NOT NULL DEFAULT '""',
    explanation     TEXT,
    points          INT NOT NULL DEFAULT 1,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lms_questions_quiz ON lms_quiz_questions(quiz_id, sort_order);

-- ══════════════════════════════════════════════════════════
--  5. ENROLLMENTS
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lms_enrollments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    user_id             UUID NOT NULL REFERENCES users(id),
    course_id           UUID NOT NULL REFERENCES lms_courses(id),
    assigned_by         UUID REFERENCES users(id),
    assigned_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_date            DATE,
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    status              lms_enrollment_status NOT NULL DEFAULT 'assigned',
    progress_percentage INT NOT NULL DEFAULT 0,
    last_module_id      UUID REFERENCES lms_course_modules(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, user_id, course_id)
);

ALTER TABLE lms_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY lms_enrollments_tenant ON lms_enrollments
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_lms_enrollments_user ON lms_enrollments(tenant_id, user_id);
CREATE INDEX idx_lms_enrollments_status ON lms_enrollments(tenant_id, status);
CREATE INDEX idx_lms_enrollments_course ON lms_enrollments(tenant_id, course_id);

CREATE TRIGGER trg_lms_enrollments_updated_at BEFORE UPDATE ON lms_enrollments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════
--  6. QUIZ ATTEMPTS
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lms_quiz_attempts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id   UUID NOT NULL REFERENCES lms_enrollments(id) ON DELETE CASCADE,
    quiz_id         UUID NOT NULL REFERENCES lms_quizzes(id),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    score           INT,
    max_score       INT,
    passed          BOOLEAN,
    answers         JSONB NOT NULL DEFAULT '[]',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lms_attempts_enrollment ON lms_quiz_attempts(enrollment_id);
CREATE INDEX idx_lms_attempts_quiz ON lms_quiz_attempts(quiz_id);

-- ══════════════════════════════════════════════════════════
--  7. LEARNING PATHS
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lms_learning_paths (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    code            TEXT NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    target_roles    JSONB NOT NULL DEFAULT '[]',
    is_mandatory    BOOLEAN NOT NULL DEFAULT false,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, code)
);

ALTER TABLE lms_learning_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY lms_paths_tenant ON lms_learning_paths
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_lms_paths_tenant ON lms_learning_paths(tenant_id);

CREATE TRIGGER trg_lms_paths_updated_at BEFORE UPDATE ON lms_learning_paths
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════
--  8. LEARNING PATH ↔ COURSE JUNCTION
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lms_learning_path_courses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path_id     UUID NOT NULL REFERENCES lms_learning_paths(id) ON DELETE CASCADE,
    course_id   UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
    sort_order  INT NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (path_id, course_id)
);

CREATE INDEX idx_lms_path_courses ON lms_learning_path_courses(path_id, sort_order);

-- ══════════════════════════════════════════════════════════
--  9. CERTIFICATES
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lms_certificates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    user_id             UUID NOT NULL REFERENCES users(id),
    course_id           UUID REFERENCES lms_courses(id),
    path_id             UUID REFERENCES lms_learning_paths(id),
    enrollment_id       UUID REFERENCES lms_enrollments(id),
    certificate_no      TEXT NOT NULL,
    issued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at          DATE,
    issued_by           UUID REFERENCES users(id),
    training_record_id  UUID REFERENCES training_records(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, certificate_no)
);

ALTER TABLE lms_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY lms_certificates_tenant ON lms_certificates
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX idx_lms_certificates_user ON lms_certificates(tenant_id, user_id);
CREATE INDEX idx_lms_certificates_expiry ON lms_certificates(tenant_id, expires_at)
    WHERE expires_at IS NOT NULL;
