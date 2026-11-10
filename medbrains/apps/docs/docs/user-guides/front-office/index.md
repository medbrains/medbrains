---
title: Front office quick guide
sidebar_label: Quick guide
sidebar_position: 0
description: "Quick guide for hospital receptionists in MedBrains: find a patient, register, start an OPD visit, book and check in appointments, call tokens and print cards."
---

# Front office quick guide

**Who:** receptionists and front-office staff.

## Find a patient

1. Go to **Patients**.
2. Type in **Search by UHID, name, or phone...**.
3. Select the row to open the patient.

If **No patients found** shows, check the spelling or try the phone number
before you register someone new.

## Register a new patient

Go to **Patients** → **Register Patient**. See
[register a patient](/user-guides/front-office/register-a-patient/).

## Start an OPD visit for a returning patient

Go to **OPD Queue** → **New visit**. See
[start an OPD visit](/user-guides/front-office/start-an-opd-visit/).

## Book an appointment

1. Go to **Appointments** and select **Book Appointment**.
2. Fill **Patient**, **Department**, **Doctor**, **Date** and **Appointment
   Type**. **Reason for Visit** is optional.
3. Select **Select Time Slot**, pick a time, then **Confirm Booking**.

If **No available slots for this doctor on the selected date.** shows, try
another date or doctor.

## Check in an appointment

1. In **Appointments**, find the booking for today.
2. Select **Check in to OPD**. The patient gets a token: **Token &lt;n&gt; —
   the number the board will call.**

Check-in works only on the appointment day. The same row has **Reschedule
appointment**, **Mark appointment as no-show** and **Cancel appointment**.

## Call tokens

1. Go to **Token Console**.
2. Choose the **Module** and **Department**, and set **Counter / room**.
3. Select **Call next**. **Call again**, **No-show** and **Hold** are on each
   row.

:::warning
"The queue could not be read" is a fault, not an empty waiting room. Do not
send anyone away; the screen retries by itself.
:::

## Print the patient card

Open the patient and select **Print patient card**. If the browser blocks it,
allow pop-ups for MedBrains and try again.

:::note
The **Edit** button on the patient page is built from a shared label we could
not confirm in the code. It opens the **Edit patient** page, where you change
the details and select **Save**.
:::
