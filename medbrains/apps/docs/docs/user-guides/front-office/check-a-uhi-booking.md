---
title: Check in a visit booked through a patient app (UHI)
description: "Check a visit booked through a UHI patient app in MedBrains: find the booking, check the PIN the patient's app shows, then check the patient in at OPD."
sidebar_position: 3
---

# Check in a visit booked through a patient app (UHI)

**Who:** receptionists and front office staff.
**Where:** menu → **UHI requests**.

A patient who booked a visit through a UHI patient app has a 4-digit PIN in
that app. The PIN shows the booking is theirs. MedBrains never shows the PIN;
it only checks the one the patient reads out.

1. Select **All** and find the patient's row. Its state is **Confirmed** and
   **Asked for** names the doctor and time.
2. Select **Check PIN**.
3. Ask the patient to open the booking in their app, and type the 4 digits it
   shows.
4. Select **Check**.
   **Expected:** **The PIN matches**.
5. Select **Done**, then check the patient in at OPD as usual: the visit is
   already in that day's OPD appointments.

## When something goes wrong

- **"That PIN does not match."** Ask the patient to read it again from the
  app. The message says how many tries are left.
- **"Too many wrong PINs."** After five wrong tries the PIN cannot be checked
  any more. Check the patient's identity and the booking by hand (name, phone,
  ABHA address, doctor and time on the row).
- **"Slot held — not confirmed yet."** The app started a booking but has not
  confirmed it. The slot is held for 15 minutes, then **Hold lapsed — the slot
  is free again**. There is no PIN until the app confirms.
- **"Patient reports doctor no-show."** The patient's app told the hospital
  the doctor did not see them. Tell the duty manager so they can rebook the
  patient.
