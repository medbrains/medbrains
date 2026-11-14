---
title: First boot, the recovery key and the authenticator
sidebar_label: First boot and recovery key
sidebar_position: 3
description: "First start of MedBrains OS: save the disk recovery key, set the network and time zone, create the hospital and first admin, then scan the QR code."
---

# First boot, the recovery key and the authenticator

**Who:** the person who will be the hospital's first administrator.
**You need:** the machine installed (see [install MedBrains OS](/install/os/)),
paper and a pen, and a phone with an authenticator app (Google
Authenticator, Microsoft Authenticator or FreeOTP).

The first time the box starts, it sets itself up on its own screen. Every step
has **Back**, and everything works from the keyboard. Nothing is final until
the last step.

## 0. The data disk and its recovery key

Before anything is stored, the machine encrypts the patient-data part of its
disk with the TPM security chip.

1. It shows a **recovery key** once: 64 letters in 8 groups. Write it on
   paper. Never photograph it or type it into another computer.
2. It asks you to type one group back, to prove you saved it.
3. It asks whether to start by itself (press **Enter**, the default) or to ask
   for a **PIN** at every start. A PIN also protects a stolen machine; without
   one, the encryption protects a disk taken out of the machine.

Keep the paper in a locked place away from the machine. It is the only way in
if the disk is moved, the board or TPM is changed, or a firmware update
changes the boot settings. See [recovery](/operate/recovery/) and
[keys and secrets](/operate/keys/).

### If the machine has no security chip

A machine without a working TPM stops before storing anything and asks what
to do.

![The no-TPM question on a black screen](/img/os/no-tpm-question.webp "The machine stops and explains before it stores any data.")

- **Recommended:** type `OFF` and press Enter. Turn on the TPM in the
  firmware settings, or fit a TPM 2.0 module, and start again.
- To carry on **without encryption**, type `STORE UNENCRYPTED` and press
  Enter. Do this only if your hospital accepts that anyone who takes or copies
  the disk can read every patient record. The choice is recorded, and the top
  bar then always says **This disk is not encrypted**.

## 1. Network

The screen shows the cable, the address, and whether the local network and
the internet answer. On a cable there is nothing to do; no internet is fine.
Select **Continue**.

![The network step of first boot](/img/os/setup-network.webp "Network: on a cable there is nothing to do.")

A **fixed address** undoes itself unless you confirm it within 60 seconds, so
a mistake cannot cut the machine off.

## 2. Time zone and updates

Choose the time zone (Asia/Kolkata unless you change it). The updates step
says that installing updates is not available in this version.

## 3. What this machine is for

Choose **Setting up a new hospital**. (To add a ward PC to a hospital that
already has a main box, choose **Connecting to my hospital**: see
[join a ward PC](/admin/join-a-machine/).)

## 4. Hospital and administrator

Enter the **hospital name**, your **username** and a **password**. The rules
are shown under each field. Then check the **Review** and select **Start the
main machine**.

![The review step](/img/os/setup-review.webp "Review: check the hospital name and username before starting.")

## 5. Your authenticator app

Your login needs a second step. Install an authenticator app on your phone if
you have none.

1. Scan the QR code with the app. If you cannot scan it, type the key shown
   under it into the app.
2. Type the 6 digits the app shows.
3. Select **Confirm and start**.

![The authenticator step, with the QR code hidden](/img/os/setup-authenticator.webp "Authenticator: scan the code, then type the 6 digits. The code is blurred here.")

You will need this app each time you sign in as this administrator. Keep the
phone safe.

## When something goes wrong

- **"That code did not match."** Type the 6 digits the app shows now. If it
  keeps failing, check that the machine's clock is right. The same QR code
  stays good.
- **Too long on this step.** After 15 minutes the step expires. Select
  **Back**, then start again for a new QR code.
- **A power cut during setup** leaves nothing half made. Setup simply starts
  again.

When setup finishes, the desktop opens: the hospital name, the machine's
health, network and storage, and a dock with **MedBrains**.

![The desktop after setup](/img/os/desktop.webp "The desktop shows machine health, network and storage, never patient data.")

## Next

[Sign in to MedBrains](/admin/sign-in/).
