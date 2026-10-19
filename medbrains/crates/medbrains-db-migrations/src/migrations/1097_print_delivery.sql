-- Print delivery (#221). A rendered document remembers which template made
-- it, so a print job can be re-rendered for a thermal printer (ZPL/ESC-POS)
-- from the context it was made with. Older rows recover it from the stored
-- file's name, which has always been `<template_code>.pdf`.
ALTER TABLE document_outputs ADD COLUMN IF NOT EXISTS template_code text;
UPDATE document_outputs
   SET template_code = regexp_replace(file_url, '^.*/([^/]+)\.pdf$', '\1')
 WHERE template_code IS NULL AND file_url LIKE '%.pdf';

-- The delivery poll takes the oldest queued jobs first.
CREATE INDEX IF NOT EXISTS idx_print_jobs_queued
    ON print_jobs (tenant_id, priority DESC, created_at)
    WHERE status = 'queued' AND deleted_at IS NULL;
