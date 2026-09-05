-- Two columns that could only ever answer "not reserved".
--
-- `bed_states.reserved_for_patient` and `.reserved_until` are written in
-- exactly two places — assign_bed and the ER admit path — and both set them
-- to NULL. Nothing has ever written a value, and a repository-wide search
-- finds no reader at all: no query, no report, no board, no TV surface.
--
-- Dead is the lesser problem. The names promise an answer, so the next person
-- who writes `WHERE reserved_for_patient IS NULL` to list free beds gets every
-- bed in the hospital including the held ones, from a query that reads as
-- obviously correct. That is the same shape as a safety check that cannot
-- fire: not a missing feature, a confident wrong answer.
--
-- The behaviour they were meant to provide already exists and works. Both
-- handlers, a few lines below the NULL writes, mark the real reservation
-- fulfilled in `bed_reservations` — the table the admission gates actually
-- read, and the one the bed-hold screen now writes.
--
-- Data loss on drop is nil by construction: every row is NULL in both columns
-- because no code path can set them.

ALTER TABLE public.bed_states DROP COLUMN IF EXISTS reserved_for_patient;
ALTER TABLE public.bed_states DROP COLUMN IF EXISTS reserved_until;
