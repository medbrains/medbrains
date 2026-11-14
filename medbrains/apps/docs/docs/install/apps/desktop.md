---
title: Install the desktop app
sidebar_label: Desktop (Windows, macOS, Linux)
sidebar_position: 4
description: "Install the MedBrains desktop app on Windows, macOS or Linux, get past the unsigned-installer warning safely, and connect it to your hospital's server address."
---

# Install the desktop app

**Who:** IT staff setting up reception, ward and office computers.
**You need:** the hospital server's address (for example
`https://hms.example-hospital.org`), or its hospital QR code, and the installer
for the computer, [verified](/install/verify-a-download/).

The desktop app opens your hospital's MedBrains in its own window and updates
itself. It holds no hospital's address until you give it one.

## Windows 10 and 11

Run `MedBrains_3.33.0_x64-setup-unsigned.exe` (or the `.msi` for managed
deployment: `msiexec /i MedBrains_3.33.0_x64-unsigned.msi /qn`).

The installers are not code-signed yet, so Windows shows **Windows protected
your PC**. Check the file's checksum first, then choose **More info**, then
**Run anyway**.

## macOS

Open `MedBrains_3.33.0_universal-unsigned.dmg` and drag **MedBrains** to
**Applications**. It runs on Intel and Apple silicon.

It is not notarised yet, so the first open is blocked. Open it once, then go
to **System Settings > Privacy & Security** and choose **Open Anyway**.

## Linux

```bash
sudo apt install ./MedBrains_3.33.0_amd64.deb        # Debian, Ubuntu
sudo dnf install ./MedBrains-3.33.0-1.x86_64.rpm     # Fedora, RHEL
chmod +x MedBrains_3.33.0_amd64.AppImage && ./MedBrains_3.33.0_amd64.AppImage   # any distribution
```

## Connect it to the hospital

At first start the app asks which server to open.

1. Type the server address. It must start with `https://`. Or scan the
   hospital QR with the desk's QR scanner, or paste it.
2. Check the address shown. A name read from the QR is marked "not
   verified": the desktop does not check the QR's signature, so confirm the
   address is your hospital's.
3. The app asks the server's `/api/health`. On an answer it opens the sign-in
   page.

To change the server later, choose **Change server** on the sign-in page, or
**Server > Change hospital server…** in the menu.

## Check it worked

The window shows your hospital's sign-in page.

## If it fails

| What you see | What to do |
|---|---|
| The address is refused | It must be `https://`. Plain `http://` is refused |
| The server does not answer | Open the same address in a browser on that computer. If that fails too, it is the network or the server, not the app |
| A certificate error | The server's certificate is not trusted by this computer. Fix the certificate, or install the hospital's root certificate |
| The app does not update itself | It reads `latest.json` from the GitHub release. Allow `github.com` through the proxy, or install new versions by hand |

**Deeper:** [`apps/desktop/README.md`](https://github.com/medbrains/medbrains/blob/main/medbrains/apps/desktop/README.md).
