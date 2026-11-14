---
title: Install the Android staff app
sidebar_label: Android staff app
sidebar_position: 5
description: "Install the MedBrains staff app on Android phones and bind each phone to your hospital by scanning a signed QR code printed from Devices, then Hospital binding."
---

# Install the Android staff app

**Who:** IT staff giving phones to doctors, nurses and other staff.
**You need:** Android phones, `medbrains-staff-android.apk`
([verified](/install/verify-a-download/)), and an administrator with the
`devices.binding.issue` permission.

A phone is bound to one hospital by a QR code that the hospital signs. The app
checks the signature, the expiry, and that the server uses `https://` with the
expected security key, so a fake code cannot point a phone at another server.

## 1. Print a hospital QR

1. In MedBrains, go to **Devices > Hospital binding**.
2. Give the code a **Label** (for example "Ward phones, November"), choose how
   long it is **Valid for**, and how many **Devices it may bind**.
3. Select **Generate QR**, then print it or show it on screen.

Anyone who can see **Hospital binding** (`devices.binding.list`) sees the
codes issued and who issued them. Revoke a code there once the phones are set
up (`devices.binding.revoke`).

## 2. Install the app

Copy the APK to the phone, or download it on the phone, and open it. Android
asks you to allow installs from your browser or file manager: allow it for
that app only.

For many phones, use your mobile device management tool to push the APK. A
Play Store bundle (`medbrains-staff-android.aab`) is on the release page for
hospitals that publish through a managed Play account.

## 3. Bind the phone

1. Open **MedBrains**.
2. Select **Scan hospital QR** and point the camera at the printed code.
3. The app shows the hospital's name. The person then signs in.

## Check it worked

The app shows **Forget *your hospital* on this device** in its settings, and
the person can sign in with their own account.

## If it fails

| What you see | What to do |
|---|---|
| Android will not install it | Allow installs from that browser or file manager. If it still fails, the file is damaged: check it against `SHA256SUMS` |
| "This hospital code has expired. Ask for a new one." | Generate a new QR |
| "Could not reach the hospital server, or its security key did not match." | The phone is not on a network that reaches the server, or the server's certificate changed since the code was made. Generate a new code on the right server |
| The code is refused at once | It was revoked or has bound its maximum number of devices |

To move a phone to another hospital, choose **Forget** in the app and scan the
new hospital's code.
