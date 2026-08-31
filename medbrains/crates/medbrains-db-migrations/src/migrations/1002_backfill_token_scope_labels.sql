-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- Name the queues on tokens already issued.
--
-- Until now only the manual `POST /api/tokens/issue` handler resolved a
-- token's scope label. Every automatic path -- OPD check-in, camp
-- registration, the lab, the pharmacy -- passed `scope_label: None`, so the
-- token knew its department by id and could not say the name. The board
-- announced a number and named no room, and `announce_token` broadcast
-- `room: null` to every display.
--
-- The issue path now resolves it for new tokens. This gives the same answer to
-- the ones already sitting in the table, so a board refreshed after this
-- migration does not show a room for the patient called at nine and a blank
-- for the one called at eight.
--
-- Only rows that have a scope to resolve are touched: a `global` token (the
-- lab, billing, registration) has no `scope_id` and correctly has no label.
-- `token_scopes` is the same view the application resolves through, so this
-- cannot drift from what a fresh token would have been given.

UPDATE tokens t
   SET scope_label = ts.label,
       updated_at = now()
  FROM token_scopes ts
 WHERE ts.tenant_id = t.tenant_id
   AND ts.scope = t.scope
   AND ts.scope_id = t.scope_id
   AND t.scope_id IS NOT NULL
   AND t.scope_label IS NULL;
