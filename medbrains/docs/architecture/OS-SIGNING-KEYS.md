# MedBrains signing keys: offline roots, short-lived CI keys, and the compromise runbook

**Status: design and runbook, nothing made yet** (plan X2, #5498). No real key has been generated or
moved. The updater does not yet accept a chain or a revocation list; that code is #5510.

**Why now.** Before any paid update feed opens (RFC-PLATFORM-COMMERCIAL, "Priority before the feed
opens"). In 2008 attackers inside Red Hat's network signed tampered packages with Red Hat's own
signing key. A hospital machine installs whatever our key signs, so whoever holds that key holds
every hospital that trusts it. The rule is: **the key that every machine trusts never touches a
networked computer, and the key a networked computer holds expires within weeks and can be revoked.**

## 1. Every key that signs something we ship

| Key | Signs | Trusted by | Today | Target |
|---|---|---|---|---|
| **OS update root** | Intermediate certificates, revocation lists, new trust anchors | Every OS image (`os/update-keys/root-*.pub`) | Not made; release images refuse every bundle (OS-UPDATES.md) | 3 hardware tokens, offline, 2-of-3 for anchor changes (§2) |
| **OS update intermediate** | Update manifests (`manifest.sig`), weekly `refresh` re-signs | Machines, through the root's certificate | Not made | Ed25519, 30-day certificate, held by the release job only (§3) |
| **Boot signing key** (`OS_PCR_KEY`) | Expected PCR 11 values of the boot file | The disk seal on every machine | Debug throwaways in builds (OS-KEYS.md). **But `OS_PCR_KEY` and `OS_PCR_CERT` have been secrets in the GitHub `release` environment since 2026-11-09**, unused by any workflow on `main`: the key every disk will seal to sits on a networked service | Same custody as the root (§2): a disk is sealed to one public key, so it cannot be short-lived until re-seal is built |
| **Release checksums, container image** | `SHA256SUMS`, the GHCR image | Anyone verifying a release | Sigstore keyless: a certificate valid for minutes, bound to the release workflow's identity, logged in Rekor (`release.yml`) | Keep. Already the "short-lived, CI-held" pattern |
| **npm and PyPI SDKs** | Published packages | Package users | Trusted publishing (OIDC), no stored token (`publish-sdks.yml`) | Keep |
| **Desktop updater** (`TAURI_SIGNING_PRIVATE_KEY`) | Desktop app updates | Every installed desktop app (`tauri.conf.json` `pubkey`) | **A long-lived minisign key in a GitHub secret** (`release` environment). A leak lets anyone sign a desktop update | Add required reviewers to the `release` environment now (it has only a branch rule); Tauri's updater has no chain, so rotation ships a new `pubkey` in a signed update, as for the OS root (§5.3) |
| **Android upload key, Apple distribution** | Store builds | The stores | The Android keystore is in the `release` environment (2026-11-09); Apple not set up | Play App Signing (Google holds the app key; the upload key can be reset); Apple keys in the owner's account only |
| **Licence and subscription issuer** | Licence files, subscription tokens | The updater's feed check, the admin screen | Designed: "Ed25519 in KMS" (RFC-PLATFORM-COMMERCIAL §3) | A key that cannot be exported (KMS), never the update root. A leak forges entitlement, not code |

**Before the first release image:** treat the `OS_PCR_KEY` now in GitHub as a test key. Delete it
from the `release` environment, make the release boot key offline at the first ceremony, and never
let a workflow read it. A boot key on GitHub would let anyone who reads that secret make boot files
that open sealed disks on stolen machines. Add required reviewers to the `release` environment
either way: today any run on an allowed branch can read its secrets.

The update root and the boot key are the two that can take over a machine. The rest of this
document is about them; the desktop key gets the same runbook in §5.

## 2. The root: three hardware tokens, never online

| | |
|---|---|
| Algorithm | Ed25519, as the updater already verifies (`crates/medbrains-os-update/src/manifest.rs`) |
| Where | Generated **on** the token, so no copy exists anywhere else. Three tokens, three independent keys: `root-a`, `root-b`, `root-c` |
| Custody | `root-a`: the owner, in a safe at home or office. `root-b`: a bank safe-deposit box. `root-c`: a second named person, in their safe. Never two in one building |
| Protection | PIN and touch on every signature; 3 wrong PINs block the key, the PUK (different, kept on paper with the token) unblocks it |
| Used on | A dedicated signing laptop that never joins a network (radio removed or disabled in firmware), booting a read-only live system. Files cross in and out on a USB stick, and a person reads each one before it is signed |
| Signs | Intermediate certificates and revocation lists: **any one root**. A new trust anchor set (adding or dropping a root) and revoking a root: **two of three** |
| Every image carries | `os/update-keys/root-a.pub`, `root-b.pub`, `root-c.pub`, and the anchor policy (`threshold` for anchor changes = 2) |

Why three tokens and not a seed on encrypted USB sticks: a seed can be copied without anyone
noticing, and its copies must be destroyed by trust. A key generated on a token cannot be copied at
all; losing one token costs nothing while two remain. Why not one token: losing it would strand
every machine on the last trust anchor.

## 3. The intermediate: what CI holds

| | |
|---|---|
| Key | Ed25519, made on the signing laptop at a ceremony, put into the GitHub environment `release` as a secret, then the stick is wiped. The `release` environment needs the owner's approval for each run and is limited to tags |
| Certificate | `intermediate.json`: `format`, `serial` (increasing integer), `key_id`, `public_key`, `not_before`, `not_after` (30 days later), `purposes` (`os-update`). Signed by one root into `intermediate.sig`, one line per signature (`<root id> <base64>`), the same form as `manifest.sig` |
| Lifetime | 30 days. A new one is issued every 3 weeks, so there is always one week of overlap. A leaked intermediate signs nothing after its `not_after`, even on a machine that never sees a revocation list |
| Signs | Release manifests and the weekly `refresh`. Nothing else: never another certificate |

The bundle gains two pairs of files beside `manifest.json` and `manifest.sig`:
`intermediate.json` + `intermediate.sig`, and `revoked.json` + `revoked.sig`.

## 4. How a machine checks a bundle (the updater change, #5510)

1. `intermediate.sig` verifies against a root in the image, and the certificate's purpose is `os-update`.
2. `revoked.json` verifies against a root, and its `sequence` is **at least** the highest one this
   machine has stored (in `/var`). A higher one is stored. A lower one is refused: an attacker cannot
   serve an old list to undo a revocation.
3. The intermediate is not in `revoked.json`'s `revoked_serials`, and its serial is at or above
   `min_serial`. Raising `min_serial` revokes every older intermediate at once.
4. The manifest's signed `issued` time lies in the certificate's `not_before`..`not_after`, and, when
   the clock is confirmed (NTS, N1.2), now is before `not_after` plus the manifest's 30-day expiry.
5. `manifest.sig` verifies with the intermediate's key. Every existing rule (only forward, floor,
   expiry, hashes, architecture) then applies unchanged.

A refusal says which step failed, on Settings, as refusals do today. The revocation list travels
**in every bundle and every weekly refresh**, so a machine that updates or looks for updates learns
of a revocation without any new channel. This answers OS-UPDATES.md's "no trusted time or channel":
the channel is the signed bundle, freshness is the sequence number, and time is bounded by the
30-day certificate rather than trusted.

**A new trust anchor** (`anchors.json`: the full list of root public keys, a `sequence`) is signed by
two current roots and carried in a bundle. The machine replaces its stored anchors with it only if
the sequence rises and two roots it already trusts signed it. Images built after that carry the new
set from the start.

**Written limits.**
- A machine that never updates, and is never offline-updated by USB, never learns of a revocation.
  A leaked intermediate still expires in 30 days; a leaked root does not. That is why roots are on
  tokens and a root revocation needs two of them.
- The boot signing key cannot move to an intermediate until `disk-setup reseal` to a new key is built
  (OS-UPDATES.md "Rotating `OS_PCR_KEY`"). Until then it is held like a root and never on a networked
  machine: an RSA 2048 key on a fourth PIV slot of `root-a`'s token if `systemd-measure` can sign
  through PKCS#11 (systemd 256 and later take a `--private-key-source`; to be tested), otherwise on the
  signing laptop's encrypted disk with a backup on a second encrypted stick in `root-b`'s
  box. Its rotation follows §5.3.

## 5. Compromise runbook

Anyone who suspects a key is exposed says so to the owner at once; nobody waits to be sure. The
clock starts when the first person suspects it, not when it is confirmed.

### 5.1 Intermediate (or desktop updater key) leaked or suspected

| By | Step |
|---|---|
| **T+15 min** | Delete the secret from the `release` environment (`gh secret delete … --env release`). Disable `release.yml` and `desktop.yml` (`gh workflow disable`). Nothing more can be signed by CI |
| **T+1 h** | Find what it signed: every `manifest.sig` with its key id since `not_before`, from the release channel's history and GitHub's audit log. Any bundle we did not make is the incident's evidence: keep it |
| **T+2 h** | Ceremony on the signing laptop, one root token, two people present: (1) `revoked.json` with `sequence` + 1, the leaked serial in `revoked_serials`, `min_serial` raised past it; (2) a new intermediate key and certificate; (3) the new key into the `release` environment; the stick wiped |
| **T+4 h** | An emergency release: version up, floor up past any version the attacker could have signed, carrying the new revocation list. Published to the channel and as a USB bundle. The weekly refresh carries the list from now on |
| **T+24 h at the latest** | Every customer told (§5.4). A public advisory (GitHub security advisory) with the revoked key id and the version that carries the revocation |
| **T+7 days** | Written review: how it leaked, what it signed, what changed. A row in `docs/DECISIONS.md` under "What went wrong" |

The desktop updater key has no chain: its step 3 is a new minisign key whose public half ships in a
desktop update signed by **the old key**, which is only safe if the old key is not yet in hostile
hands; if it is, the desktop app must be reinstalled from the website, and the notice says so.

### 5.2 One root token lost, stolen or suspected

| By | Step |
|---|---|
| **T+1 h** | The two other tokens are checked: present, sealed bags intact. Their holders are told |
| **T+4 h** | Two-person ceremony with the two good tokens: a new token `root-d` generated; `anchors.json` with `sequence` + 1 listing the two good roots and `root-d`, signed by the two good roots; `revoked.json` revoking every intermediate the lost root ever signed, and a new intermediate signed by a good root |
| **T+8 h** | Emergency release carrying the new anchors and revocation list, floor raised; USB bundle |
| **T+24 h at the latest** | Customers told (§5.4); advisory published |
| **Next release** | `os/update-keys/` updated in the repo, so new images ship without the lost root |

If **two** tokens are lost, the third alone cannot change the anchors, by design. Machines must then be
re-imaged from installation media with a new root set, and the notice says so. This is the price of
a single stolen token being unable to take over the fleet.

### 5.3 Boot signing key (`OS_PCR_KEY`) leaked

A thief can make a boot file that opens disks on machines sealed to that key, given the machine in
hand. Ship an update that re-seals every disk to a new key (`systemd-cryptenroll` with the new
`--tpm2-public-key`, OS-UPDATES.md), signed through the normal chain, and only after that release
signs boot files with the new key. Until re-seal is built, the honest notice is: a stolen machine is
exposed, keep machines physically secured, and set a disk PIN (OS-KEYS.md).

### 5.4 The customer notice (within 24 hours)

Sent by the owner, to every subscription and support contact, by email and on the status page; for
sites with no internet, by phone to the named contact.

> **Subject: MedBrains security notice: update signing key [revoked/replaced] on [date]**
>
> On [date and time, UTC] we found that [our update signing key / one of our root keys] [was
> exposed / may have been exposed]. We revoked it at [time]. Release [version], published at
> [time], carries the revocation; once a machine has it, nothing signed with the old key installs.
>
> What you need to do: apply [version] (Settings → Updates), or for an offline site, the USB bundle
> at [link]. On Settings → Updates, "Last signed list" should show [date] or later.
>
> What we know so far: [what the key signed in the window, whether any bundle we did not make was
> found]. We will write again by [time] with the full review.
>
> Contact: [security address from SECURITY.md], [phone].

Legal duties may be shorter than 24 hours (for example CERT-In's 6-hour incident report in India,
and contract terms with each customer). The owner confirms them with counsel before the feed opens
and adds them to this table.

### 5.5 The drill

Once before the paid feed opens, then every six months, with **test** roots and a test channel,
never the real tokens' real keys:

1. Build two debug images in QEMU and let them install a bundle signed by intermediate serial 1.
2. Declare serial 1 leaked. Run §5.1 by the clock: revoke, issue serial 2, ship the emergency bundle.
3. Check on both machines: a bundle signed by serial 1 is refused with the revocation reason; an old
   revocation list served again is refused; the emergency bundle installs.
4. Run §5.2 with one test token "lost": new anchors signed by the other two install; anchors signed
   by one root are refused.
5. Send the §5.4 notice to an internal address and time it.
6. Record each step's time and anything that did not work, in `docs/DECISIONS.md`. The drill passes
   when the emergency bundle is out within 4 hours and the notice within 24.

Steps 1 to 4 become a QEMU test (`update_cycle`-style) with #5510, so the drill's mechanics also run
in CI; the human part (the people, the ceremony, the notice) is the drill.

## 6. What the owner must buy and do

**Buy:**

| Item | How many | Note |
|---|---|---|
| YubiKey 5 series with firmware **5.7 or later** (Ed25519 in PIV) | 3, plus 1 for drills | Buy from Yubico directly: firmware cannot be upgraded, and reseller stock can be older than 5.7 |
| A small laptop used only for signing | 1 | Any x86-64 laptop that can have Wi-Fi and Bluetooth removed or disabled in firmware; never connected to a network |
| USB sticks for files in and out | 2 | Labelled "in" and "out", wiped after each ceremony |
| Tamper-evident bags | 10 | One per stored token, its PUK sheet, and the laptop; bag numbers written in the log |
| A bank safe-deposit box | 1 | For `root-b` |
| A bound paper logbook | 1 | Every ceremony: date, people, what was signed, bag numbers |

**Do, in this order:**

1. Name the second key holder (`root-c`) and the witnesses. Two people at every ceremony.
2. Now, with no purchase: add the owner as required reviewer on the `release` environment, and
   delete `OS_PCR_KEY` and `OS_PCR_CERT` from it (the release boot key is made offline in step 3).
3. When the tokens arrive: the first ceremony. Generate `root-a`, `root-b`, `root-c` on the tokens,
   set PINs and PUKs, export only the public keys. A pull request adds them to `os/update-keys/` with
   the anchor threshold; nobody else can do this step.
4. Issue intermediate serial 1 and put it in the `release` environment.
5. Merge #5510 (chain and revocation in the updater) and run the drill (§5.5) before the first paid
   release.
6. Confirm the legal notice deadlines with counsel and add them to §5.4.
7. Put the drill in the calendar every six months.
