-- The daily pharmacy settlement could not be upserted.
--
-- `get_settlement` builds one settlement row per tenant per day by summing
-- that day's payment transactions, and re-runs as the day goes on, so it is an
-- upsert by nature. Its ON CONFLICT named (tenant_id, settlement_date), which
-- matches no unique index: the only one is
-- (tenant_id, settlement_date, counter_id).
--
-- Adding counter_id to the conflict target does not fix it. This settlement is
-- tenant-wide -- the query takes no counter and aggregates every transaction of
-- the day -- so counter_id is NULL, and Postgres treats NULLs in a unique index
-- as distinct. Every refresh would insert another row, and a cash
-- reconciliation that silently doubles is worse than one that errors.
--
-- So the tenant-wide daily row gets its own key. Per-counter settlements keep
-- the existing three-column index untouched; this only constrains the rows
-- where counter_id IS NULL, which is exactly the shape this handler writes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_settlements_tenant_date_no_counter
    ON pharmacy_day_settlements (tenant_id, settlement_date)
    WHERE counter_id IS NULL AND deleted_at IS NULL;
