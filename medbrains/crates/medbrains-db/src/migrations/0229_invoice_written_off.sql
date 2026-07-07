-- Write-off settlement. An approved bad-debt write-off is a non-cash settlement: it
-- reduces the outstanding balance. We model it by adding the amount to paid_amount (so the
-- balance = total_amount - paid_amount stays correct in every existing computation, ~11
-- sites) AND recording the written-off portion here, so cash collected is still derivable
-- as (paid_amount - written_off_amount). Approval was previously a no-op on the invoice.

ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS written_off_amount numeric(12, 2) NOT NULL DEFAULT 0;
