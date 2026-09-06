-- A component cannot be held pending investigation.
--
-- `blood_bag_status` runs collected -> processing -> tested -> available ->
-- reserved -> crossmatched -> issued -> transfused, with returned, expired
-- and discarded as ends. There is no state for "stop, we are investigating",
-- so when a transfusion reaction is reported the other components from the
-- same donation stay `available` and can be issued to the next patient while
-- the investigation is still open.
--
-- That is the whole point of haemovigilance: a reaction implicates the
-- donation, not only the bag that caused it. Discarding them is wrong too —
-- the investigation may clear them, and discarding destroys the evidence it
-- needs.

ALTER TYPE public.blood_bag_status ADD VALUE IF NOT EXISTS 'quarantined';
