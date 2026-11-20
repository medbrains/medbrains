---
title: Register a campus on ABDM's Health Facility Registry
sidebar_label: ABDM facility registry (HFR)
sidebar_position: 2
description: "How a hospital registers or updates each campus on ABDM HFR from Settings → Facilities, who has to sign in, and what happens after submission."
---

# Register a campus on HFR

Each campus has its own HFR facility ID. Register or update it from
**Settings → Facilities**, with the HFR button on the campus row. You need the
`abdm.hfr.register` permission and the hospital's ABDM keys.

## Before you start

- The **facility manager's HPR ID and password.** They save the details and
  submit them.
- A **verifier's HPR ID and password**: a second registered professional who
  confirms the submission.
- The campus's address, coordinates, ownership, system of medicine, facility
  type, working hours and bed counts.

MedBrains never stores an HPR password. It is sent once, encrypted, to HPR,
and the sign-in lasts 15 minutes.

## The steps

1. **Search HFR.** Search by the HFR ID if the campus already has one, or by
   name, ownership and state. If HFR already lists the campus, choose
   **This is our campus — link it**. Register only when HFR lists nothing that
   matches: a second record cannot be merged later.
2. **Basic information.** The facility manager signs in to HPR, then fills
   the form. Dropdowns come from HFR's own lists. The first save gives the
   campus a **tracking ID**.
3. **Additional information.** Health programme IDs the campus holds (all
   optional).
4. **Detailed information.** For each system of medicine, the specialities
   offered, then bed and chair counts. The two totals are worked out for you.
5. **Submit.** The facility manager and the verifier are both signed in; then
   **Submit to HFR**.

Each step is saved on HFR under the tracking ID, so you can close the window
and carry on later from the same button.

## After submission

NHA or the state reviews the campus; that is normal, not a failure. HFR
issues the facility ID after approval, or straight away if it can. The
campus then shows **submitted** in Settings → Facilities.

To change the details later, open the same button: the flow starts at basic
information with the kept tracking ID, and ends with **Resubmit to HFR**.
