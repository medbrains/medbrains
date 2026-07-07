-- Inter-pharmacy transfer lifecycle (MP4). The transfer stopped at 'approved' and never
-- moved stock. Now: DISPATCH FEFO-decrements the from-location's batch_stock and records the
-- exact batches taken in dispatched_lines; RECEIVE recreates those batches at the
-- to-location (preserving batch_number + expiry for recall traceability).

ALTER TABLE pharmacy_transfer_requests
    DROP CONSTRAINT IF EXISTS pharmacy_transfer_requests_status_check;
ALTER TABLE pharmacy_transfer_requests
    ADD CONSTRAINT pharmacy_transfer_requests_status_check
    CHECK (status = ANY (ARRAY[
        'draft'::text, 'approved'::text, 'dispatched'::text,
        'received'::text, 'transferred'::text, 'cancelled'::text
    ]));

ALTER TABLE pharmacy_transfer_requests
    ADD COLUMN IF NOT EXISTS dispatched_lines jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE pharmacy_transfer_requests ADD COLUMN IF NOT EXISTS dispatched_by uuid;
ALTER TABLE pharmacy_transfer_requests ADD COLUMN IF NOT EXISTS dispatched_at timestamptz;
ALTER TABLE pharmacy_transfer_requests ADD COLUMN IF NOT EXISTS received_by uuid;
ALTER TABLE pharmacy_transfer_requests ADD COLUMN IF NOT EXISTS received_at timestamptz;
