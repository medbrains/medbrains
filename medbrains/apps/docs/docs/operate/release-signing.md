---
title: How MedBrains releases are signed
sidebar_label: Release signing
sidebar_position: 3
description: "What signs MedBrains releases: Sigstore for checksums and images, the boot key, the 2-of-3 offline update roots, the key ceremony and compromise runbook."
---

# How MedBrains releases are signed

**Who:** hospital security teams who want to know what they trust, and the
MedBrains maintainers who hold the keys.

A hospital machine installs whatever our keys sign. So the rule is: **the key
every machine trusts never touches a networked computer, and the key a
networked computer holds expires within weeks and can be revoked.**

## What is signed today

| What | How | You check it with |
|---|---|---|
| `SHA256SUMS`, which covers every release file | Sigstore keyless signing in `release.yml`: a certificate valid for minutes, bound to the workflow and tag, logged publicly in Rekor. No long-lived key exists to steal | `cosign verify-blob` ([verify a download](/install/verify-a-download/)) |
| Every release file | GitHub build provenance (`actions/attest-build-provenance`) | `gh attestation verify <file> --repo medbrains/medbrains` |
| The container image | Sigstore, the same way | `cosign verify ghcr.io/medbrains/medbrains:<version>` |
| OS boot file (PCR 11) | `OS_PCR_KEY` / `OS_PCR_CERT` (RSA 2048) through `systemd-measure`. A file built without it is named `-unsigned` | the disk seal does it at every start |
| Secure Boot | `OS_SB_KEY` / `OS_SB_CERT`. **Not used yet**: release images ship without Secure Boot | — |
| OS update bundles | one Ed25519 key per `os/update-keys/<id>.pub`. **No release update key exists yet**, so release images refuse every bundle | the updater on the machine |
| Desktop app updates | Tauri updater key (`pubkey` in `tauri.conf.json`) | the desktop app |
| Android and Apple store builds | store signing keys | the stores |

## The update roots (designed, not yet made)

When OS updates open, they will be signed by a chain:

- **Three root keys**, `root-a`, `root-b` and `root-c`: Ed25519, generated on
  YubiKey 5 tokens (firmware 5.7 or later), each held by a different named
  person in a different building. PIN and touch for every signature. **Any two
  of three** must sign: machines ship `root-*.pub` and `threshold=2`.
- **An intermediate key** in a protected GitHub environment that needs the
  owner's approval per run. Its certificate lasts 30 days and is reissued
  every 3 weeks. It signs update manifests only.
- **A revocation list**, `revoked.json`, travels inside every bundle.

## The key ceremony

Two people at every ceremony. Roots are used only on an air-gapped laptop
running a read-only live system; files move by USB stick.

1. Name the `root-c` holder and the witnesses.
2. Check that CI holds no long-lived key.
3. Generate the three roots on the tokens. Set each PIN and PUK. Seal each PUK
   in its own bag with a different holder. Export only the public keys, and
   add them to `os/update-keys/` by pull request.
4. Issue intermediate certificate serial 1, signed by two roots.
5. Run the compromise drill (below). Repeat it every six months.

## Compromise runbook

| What leaked or was lost | Within | Do this |
|---|---|---|
| **The intermediate** (or the desktop updater key) | 15 minutes | Delete the secret (`gh secret delete … --env <name>`) and disable `release.yml` and `desktop.yml` (`gh workflow disable`) |
| | 2 hours | Two roots revoke it and issue a new intermediate |
| | 4 hours | Emergency release with the revocation floor raised |
| | 24 hours | Notify every hospital and publish an advisory |
| | 7 days | Written review |
| **One root token** | | Make `root-d`; the two good roots sign a new `anchors.json`; raise `min_serial`. Two roots lost means re-imaging every machine |
| **The boot signing key** (`OS_PCR_KEY`) | | Re-sealing every disk to a new key is **not built yet**. Until it is, keep machines physically secure and set a disk PIN |
| **The desktop updater key** | | Ship a new `pubkey` in an update signed by the old key. If an attacker holds the old key, users must reinstall |

**Deeper:** [OS signing keys](https://github.com/medbrains/medbrains/blob/main/medbrains/docs/architecture/OS-SIGNING-KEYS.md)
and the [security release process](https://github.com/medbrains/medbrains/blob/main/medbrains/docs/SECURITY-RELEASE-PROCESS.md).
