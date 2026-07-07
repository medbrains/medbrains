-- Credential gate: a REVOKED medical registration (regulator struck off / suspended) is
-- stricter than an expired one — it must HARD-block regulated acts (prescribe, operate)
-- with no override. Expired stays a soft gate (override + audit). Adds the revoked flag.

ALTER TABLE doctor_profiles
    ADD COLUMN IF NOT EXISTS registration_revoked boolean NOT NULL DEFAULT false;
