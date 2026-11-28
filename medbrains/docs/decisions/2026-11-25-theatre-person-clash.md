---
date: 2026-11-25
title: A theatre booking is refused when its surgeon or anaesthetist is already in another case
status: proposed
area: clinical-safety
---

## What

Creating or moving a theatre booking checks the room, the primary surgeon, the anaesthetist and
any assistant surgeons recorded by user id against every other live (not cancelled, not postponed, not deleted)
booking whose time overlaps, in any theatre. Times are compared as instants (half-open
`timestamptz` ranges), never by `scheduled_date`, so a case running past midnight clashes with the
next morning and back-to-back cases do not clash. The room and each person are locked in one
sorted order before the check. The refusal names the clash: "Dr X is already in Theatre 2 from
15 Dec 10:00 to 15 Dec 12:30", in the hospital's time zone. A booking that ends before it starts
is refused. The booking form now shows the server's message instead of "Failed to create booking".

## Why

Only the room was checked, only on the same `scheduled_date`, and only on create: a surgeon could
be booked in two theatres at once, a case crossing midnight was never checked against the next
day, and a reschedule was not checked at all.

## Rejected

- A database exclusion constraint: people live in three columns (one a JSON array), and the
  refusal must say who and where, which a constraint violation cannot.
- Locking per room and date (the old key): a case crossing midnight spans two dates, so two
  bookings could race past each other.
- Checking assistants named in free text: they cannot be matched to a person; only user ids are.
