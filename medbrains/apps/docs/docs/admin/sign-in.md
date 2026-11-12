---
title: Sign in to MedBrains on the box
sidebar_position: 4
description: "Sign in to MedBrains on the hospital OS box through the Identity service, using your username, password and authenticator code, and what to do if it is down."
---

# Sign in to MedBrains on the box

The box has its own identity service, **Identity**, which proves who you are.
What you may do once signed in is still decided by your role in MedBrains.

## Sign in

1. On the desktop, select **MedBrains** in the dock. It opens in stages, with
   words and a progress bar.
2. On the sign-in page, type your **Username** and select **Begin**.
3. Type your password, then the 6-digit code from your authenticator app.

![The Identity sign-in page inside MedBrains](/img/os/identity-sign-in.webp "Identity asks for your username first.")

The dashboard opens.

![The MedBrains dashboard after signing in](/img/os/signed-in.webp "Signed in: the menu shows what your role can use.")

:::note
The screens after **Begin** belong to the Identity service. Their exact
wording was not checked against the code for this page.
:::

## Moving around the box

- **Home** keeps MedBrains open and goes back to the desktop.
- **Close** ends the app's view and frees its memory.
- **Reload** reloads the page. A restart signs you out.

## When something goes wrong

- **"The sign-in service is not answering…"** Identity restarts by itself
  within seconds. Staff already signed in keep working. While it is down,
  only the first administrator can sign in, with the password chosen at setup.
- **Forgotten password.** Ask IT to issue a reset link for you. There is no
  button for this on a screen yet.
- **Lost authenticator phone (first administrator).** Sign in to MedBrains
  with your setup password on its own form, then ask IT to replace the
  authenticator. Every such sign-in is audited.
