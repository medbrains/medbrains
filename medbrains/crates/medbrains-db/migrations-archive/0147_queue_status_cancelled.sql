-- Migration: 0147_queue_status_cancelled.sql
-- RLS-Posture: not-applicable
-- Adds an enum value only; no table, column or policy is touched.
-- Appointment cancellation after check-in needs a terminal queue state
-- distinct from no_show (audit P1 — billing auto-reversal linkage).
ALTER TYPE public.queue_status ADD VALUE IF NOT EXISTS 'cancelled';
