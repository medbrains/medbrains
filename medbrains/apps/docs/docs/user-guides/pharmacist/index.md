---
title: Pharmacist quick guide
sidebar_label: Quick guide
sidebar_position: 0
description: "Quick guide for pharmacists in MedBrains: dispense from the Rx queue, counter sales from the catalogue, buy outside lines, controlled drugs, expiry and returns."
---

# Pharmacist quick guide

**Who:** pharmacists. **Where:** **Pharmacy**. The tabs you see depend on
your role.

## Dispense a prescription

1. Go to **Pharmacy** → **Rx Queue** and search by patient name, UHID or
   doctor.
2. Select **View prescription**. Check each line and its price.
3. Select **Approve & Create Billing Indent** (or **Put on Hold** or
   **Reject**). A changed price needs a review note.
4. Go to **Orders**, find the order and select **Dispense**.
5. Keep the batch on **FEFO (auto)** (first expiry, first out) or pick one,
   and select **Dispense**.

A documented drug allergy stops dispensing until you give an **Override
reason**. When allergy status is unknown, tick that you asked the patient.

## Sell at the counter

1. Go to **POS Counter**.
2. Search for the medicine in **Add medicine**. Pick a **Registered patient**
   or leave it as a walk-in.
3. Select **Take payment**, then **Print receipt** or **Print GST bill**.

:::info Catalogue items only
Every sale line must be an item from the drug catalogue, with its schedule.
There are no free-text items: the screen shows **Not in the catalogue**, and
the server refuses the sale. If you can manage stock, use **Add to
catalogue**; otherwise ask a pharmacist who can.
:::

A Schedule H or H1 drug sold against an outside prescription asks for the
**Prescriber**, **Registration no.** and **Patient's address**.

## Buy outside lines

A doctor or nurse marks a line **Buy outside** on purpose when the hospital
does not stock it. At **Rx Queue** review, you can also tick **Mark buy
outside** on a line that is not in the catalogue. These lines appear in a grey
box, **Buy outside, not dispensed here**. They are never dispensed or billed.

## Controlled drugs (NDPS, Schedule X)

- A Schedule X drug needs the **Retained duplicate prescription**.
- A controlled drug needs a **Witness** (a second pharmacist) and their
  password.
- Record register entries in **NDPS Register** → **Manual Entry**. The
  **H1 register** is kept five years, open to inspection.

## Expiry and batches

Go to **Batch & Expiry**. **Near Expiry** lists stock by **Days Left**.
Expired stock is written off with **Write off expired stock**, naming the
method and the witness.

## Returns

Go to **Returns** and select **Request Return**. Pick the patient and the
dispensed medicine, set the quantity and reason. A reviewer approves it and
chooses **Return to stock** or **Destroy returned item**.
