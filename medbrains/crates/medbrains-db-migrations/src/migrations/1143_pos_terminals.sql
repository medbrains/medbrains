-- ====================================================================
-- Migration: 1143_pos_terminals.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: payment_terminals.counter_id
-- ====================================================================
-- Card machines at every counter (#4874). A terminal was bound to its
-- counter by a free-text label nothing else knew; it is now bound to the
-- counter's station, so the billing and pharmacy counters find the machine
-- in front of them. A machine is reached either through its provider's
-- cloud (Pine Labs Plutus, Razorpay POS) or through the site bridge on the
-- counter PC it is wired to (USB / serial / Bluetooth), and the screen says
-- whether it was last seen answering.
--
-- Existing labels move to the station whose code or name they match; a
-- label no station carries becomes a billing-counter station of that name,
-- so no terminal loses its counter.

ALTER TABLE public.payment_terminals
    ADD COLUMN station_id uuid REFERENCES public.stations(id),
    ADD COLUMN connection text NOT NULL DEFAULT 'cloud'
        CHECK (connection IN ('cloud', 'bridge')),
    -- Bridge terminals: which device adapter the bridge drives it with, and
    -- where it is plugged in (COM3, /dev/ttyUSB0, a Bluetooth address).
    ADD COLUMN adapter text,
    ADD COLUMN device_address text,
    ADD COLUMN last_seen_at timestamptz,
    ADD COLUMN last_status text CHECK (last_status IN ('online', 'offline')),
    ADD COLUMN last_error text,
    ADD COLUMN retired_at timestamptz,
    ADD CONSTRAINT payment_terminals_bridge_adapter
        CHECK (connection <> 'bridge' OR adapter IS NOT NULL);

UPDATE public.payment_terminals t
   SET station_id = s.id
  FROM public.stations s
 WHERE t.counter_id IS NOT NULL
   AND s.tenant_id = t.tenant_id
   AND s.deleted_at IS NULL
   AND (lower(s.code) = lower(btrim(t.counter_id)) OR lower(s.name) = lower(btrim(t.counter_id)));

INSERT INTO public.stations (tenant_id, code, name, station_type)
SELECT DISTINCT ON (tenant_id, code) tenant_id, code, label, 'billing_counter'
  FROM (SELECT tenant_id, btrim(counter_id) AS label,
               upper(btrim(regexp_replace(btrim(counter_id), '[^A-Za-z0-9]+', '-', 'g'), '-')) AS code
          FROM public.payment_terminals
         WHERE station_id IS NULL AND counter_id ~ '[A-Za-z0-9]') unmatched
 ORDER BY tenant_id, code, label
ON CONFLICT (tenant_id, code) DO NOTHING;

UPDATE public.payment_terminals t
   SET station_id = s.id
  FROM public.stations s
 WHERE t.station_id IS NULL
   AND t.counter_id ~ '[A-Za-z0-9]'
   AND s.tenant_id = t.tenant_id
   AND s.code = upper(btrim(regexp_replace(btrim(t.counter_id), '[^A-Za-z0-9]+', '-', 'g'), '-'));

ALTER TABLE public.payment_terminals DROP COLUMN counter_id;

CREATE INDEX idx_payment_terminals_station
    ON public.payment_terminals (tenant_id, station_id) WHERE is_active;

-- The machine a card sale ran on, and the approval it came back with.
ALTER TABLE public.payment_gateway_transactions
    ADD COLUMN terminal_id uuid REFERENCES public.payment_terminals(id),
    ADD COLUMN card_auth_code text;

-- A machine runs one sale at a time; the counter looks for the open one.
CREATE UNIQUE INDEX uq_pgt_terminal_open
    ON public.payment_gateway_transactions (terminal_id)
    WHERE terminal_id IS NOT NULL AND status IN ('pending_gateway', 'created');
