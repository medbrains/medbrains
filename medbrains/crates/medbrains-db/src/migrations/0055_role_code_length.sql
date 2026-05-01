-- Old length cap (20) too tight for module-specific role codes
-- like 'infection_control_officer' (25). Bump to 32.
ALTER TABLE roles DROP CONSTRAINT IF EXISTS chk_roles_code_length;
ALTER TABLE roles
    ADD CONSTRAINT chk_roles_code_length
    CHECK (length(code) >= 2 AND length(code) <= 32);
