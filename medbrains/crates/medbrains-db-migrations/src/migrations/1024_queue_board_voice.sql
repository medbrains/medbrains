-- ====================================================================
-- Migration: 1024_queue_board_voice.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- How a queue's waiting-room board shows and speaks a call
-- (RFCs/modules/RFC-MODULE-token-queues.md, P3).
--
-- `board_shows`: a board is public, so it shows the number only unless the
-- hospital opts a queue into initials. The full name never goes to a public
-- screen. The server enforces this for callers who read the board as a
-- display, rather than trusting the screen to hide what it was sent.
--
-- `voice_languages`: the languages a call is spoken in, in order — English
-- first by default; Hindi and Tamil are available.
--
-- `announce_repeat`: how many times each call is spoken (a busy hall misses
-- a single call).

ALTER TABLE queues ADD COLUMN IF NOT EXISTS board_shows text NOT NULL DEFAULT 'number'
    CHECK (board_shows IN ('number', 'initials'));
ALTER TABLE queues ADD COLUMN IF NOT EXISTS voice_languages text[] NOT NULL DEFAULT '{en}'
    CHECK (cardinality(voice_languages) BETWEEN 1 AND 3
           AND voice_languages <@ ARRAY['en', 'hi', 'ta']::text[]);
ALTER TABLE queues ADD COLUMN IF NOT EXISTS announce_repeat smallint NOT NULL DEFAULT 1
    CHECK (announce_repeat BETWEEN 1 AND 3);
