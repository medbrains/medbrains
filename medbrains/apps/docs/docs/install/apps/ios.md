---
title: iPhone apps
sidebar_position: 6
description: "The status of the MedBrains iPhone apps: the release carries unsigned Xcode archives for developers to sign, and how to sign one for your own devices."
---

# iPhone apps

**Who:** developers and IT teams with an Apple Developer account.
**You need:** a Mac with Xcode, an Apple Developer Program membership, and
`medbrains-staff-ios-unsigned.xcarchive.zip` or
`medbrains-patient-ios-unsigned.xcarchive.zip`
([verified](/install/verify-a-download/)).

The iPhone apps are not in the App Store yet. The release carries them as
**unsigned Xcode archives**, for a team to sign with its own certificate.
Staff phones bind to a hospital with the same signed QR code as Android (see
[Android staff app](/install/apps/android/)).

## Sign an archive for your devices

```bash
ditto -x -k medbrains-staff-ios-unsigned.xcarchive.zip .
open *.xcarchive                               # opens in Xcode's Organizer
```

In Xcode's **Organizer**, select the archive, then **Distribute App**. Choose
**Release Testing** or **Enterprise** (for your own devices) or **TestFlight
& App Store**, and sign with your team. Xcode creates the app's provisioning
profile.

## Check it worked

The app installs on a registered iPhone and offers **Scan hospital QR**.

## If it fails

| What you see | What to do |
|---|---|
| "No accounts with App Store Connect access" | Add your Apple ID under **Xcode > Settings > Accounts** |
| A bundle ID conflict | The ID is MedBrains'. Change it in the project and archive it yourself from source (`apps/ios`) |

**Deeper:** the CI signing secrets that produce a signed `.ipa` are listed in
[CI/CD reference](/developer/reference/ci-cd/).
