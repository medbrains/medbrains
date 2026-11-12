---
title: "Security holes in hospital software, and how MedBrains closes them"
description: "Where security holes in hospital software come from, how MedBrains closes them as one system, what we fixed recently, and what is not done yet."
summary: "Most hospital breaches start at a seam: an unpatched part, a shared password, a lost machine or a bad key. MedBrains is one program on one database, with its own operating system and one signed update path, so there are fewer seams, and each layer refuses rather than warns. We publish what we fix. MedBrains has not had an outside penetration test yet, and we say so."
date: 2026-11-12
category: technology
seoTitle: "How MedBrains secures hospital software | MedBrains Blog"
featured: false
tags: ["Data security", "Hospital IT", "Cybersecurity", "Ransomware", "PostgreSQL", "Rust", "Supply chain", "Encryption"]
sources:
  - title: "PostgreSQL 17 documentation. Row Security Policies"
    url: "https://www.postgresql.org/docs/17/ddl-rowsecurity.html"
  - title: "systemd. systemd-cryptenroll, enrolling TPM2 keys for LUKS2 volumes"
    url: "https://www.freedesktop.org/software/systemd/man/latest/systemd-cryptenroll.html"
  - title: "systemd. systemd-boot automatic boot assessment"
    url: "https://systemd.io/AUTOMATIC_BOOT_ASSESSMENT/"
  - title: "IETF RFC 8032. Edwards-Curve Digital Signature Algorithm (EdDSA)"
    url: "https://www.rfc-editor.org/rfc/rfc8032"
  - title: "Sigstore. Cosign, signing and verifying software artefacts"
    url: "https://docs.sigstore.dev/cosign/signing/overview/"
  - title: "CycloneDX. Software bill of materials standard"
    url: "https://cyclonedx.org/"
  - title: "OSV. Open source vulnerability database and scanner"
    url: "https://osv.dev/"
  - title: "Kanidm. Identity management platform"
    url: "https://kanidm.com/"
  - title: "The Rust Reference. The unsafe keyword"
    url: "https://doc.rust-lang.org/reference/unsafe-keyword.html"
faq:
  - q: "Has MedBrains had an independent penetration test?"
    a: "Not yet. Our own threat list puts an outside penetration test before the MedBrains operating system goes live in any hospital, and we will publish when it has happened. Until then, treat our controls as tested by us, not by an independent party."
  - q: "Does MedBrains hold a security certification such as ISO 27001 or SOC 2?"
    a: "No. We hold no security certification today. What we can show is the code itself, which is public, the automated checks that run on every change, and a written list of what is still open."
  - q: "What happens if someone steals a MedBrains machine or its disk?"
    a: "On the MedBrains operating system the data partition is encrypted from first boot and its key is sealed to the machine's TPM chip. A disk taken out and read elsewhere does not open without the recovery key, and that is tested. A whole stolen machine is harder: without a start-up PIN, someone able to alter its system partition can still get in. A PIN closes that today, and a sealed, read-only system partition is the next piece of work."
  - q: "Can our IT team check what is inside MedBrains?"
    a: "Yes. The source code is public, every change on the main branch keeps a software bill of materials in the CycloneDX format, and the release pipeline signs container images and checksums with Sigstore cosign and attaches the bill of materials, so your team can verify what it installs."
  - q: "Does this help with data protection laws?"
    a: "It helps, but no software makes a hospital compliant by itself. Laws such as the EU's GDPR, HIPAA in the United States or India's DPDP Act expect access control, audit trails and breach response. MedBrains provides the controls; the hospital still owns consent, retention and how it responds to an incident."
cover:
  src: ./images/security-holes-in-hospital-software.png
  alt: "Dark navy card with the post title beside a closed blue ring joining five labels, app, data, OS, updates and keys, around a green tick"
---

Hospitals are attacked for a plain reason: they cannot stop. A bank can close a
branch for a day; a ward cannot close. Records are valuable, the pressure to pay
a ransom is high, and the systems are often old, many, and joined by hand.

This post is for owners, administrators and IT heads. It explains where
breaches in hospital software usually start, what we mean when we say MedBrains
is built as one tightly integrated system, and what each layer is there to
stop. Every claim below is about code that is in our public repository today.
Where something is not finished, we say so.

## Where breaches usually start

Very few breaches begin with a clever new technique. Most begin at a seam,
somewhere two parts meet and each assumes the other is guarding the door.

- **A part nobody patched.** A typical hospital system is several products: an
  application, a database, a reporting tool, a print server, an interface
  engine. Each has its own updates, and the one that was missed is the way in.
- **Systems stitched together.** Every interface between two products carries
  a password or key, a network port and a set of assumptions. The more
  products, the more of those there are, and the fewer anyone can list.
- **Shared and default passwords.** One administrator login used by four
  people, or a vendor password that was never changed, turns one leak into
  full control.
- **A lost laptop or a stolen server.** If the disk is not encrypted, whoever
  holds it holds the records. Backups copied to a USB drive are the same
  problem in a smaller box.
- **A bad key.** A signing or encryption key that was cut short, copied into
  the wrong place or left at a published default can look as if it works for
  months. Keys generated by the certificate authority eMudhra were found to be
  weak, and the certificates built on them had to be distrusted.
- **The supply chain.** Software is built from hundreds of open-source pieces.
  A known flaw in one of them, or a tampered build step, reaches every customer
  at once.

## What "tightly integrated" means here

The usual answer to each of those problems is another product: an antivirus, a
patch manager, a key vault, a backup tool. Each closes a gap and adds a seam.

MedBrains goes the other way. It is one compiled program that serves every
module, on one PostgreSQL database. For hospitals that want an appliance, there
is also the MedBrains operating system: a small Linux system we build
ourselves, with the database, the server and its front door on it and nothing
else. It is built directly on Linux with no Docker inside it, so there is no
container layer to patch separately. Updates come down one signed path.

One program, one database, one operating system and one update path means
fewer places where two parts can disagree about who is responsible. It does
not mean nothing can go wrong. It means the list of things to check is short
enough to be checked.

## The layers, and what each one stops

### The database refuses to mix hospitals

Every table that holds a hospital's identifier has PostgreSQL row-level
security switched on. Each request sets its hospital inside its own database
transaction, and the database then refuses to return another hospital's rows,
even if a mistake slips into the application code above it. A check in our
continuous integration fails any change that adds such a table without that
protection.

**What it stops:** one hospital's data showing up in another's screens, through
a bug rather than an attack.

### Every action is checked on the server

Permissions are defined once, in the server's own code, and the list the screens
use is generated from it, never written by hand. The server checks the
permission on each request; hiding a button is a courtesy, not the control.
Repository checks fail a screen that is gated on a permission no server route
enforces.

An authorisation check has three answers, not two: allowed, refused, or
unknown, for when the check itself failed because something was down. Unknown is
treated as refused at the edge, so a fault never quietly grants access. And the
reverse rule matters just as much in a hospital: a list that could not be
checked must never be shown as an empty list, because a blank ward reads as a
fact about the ward. A check in our continuous integration fails code that
turns an authorisation error into a plain "no".

**What it stops:** a user reaching data through a route nobody guarded, and an
outage being mistaken for "no patients".

### Sign-in is hard to guess and hard to reuse

Passwords are stored with Argon2id. Five wrong passwords lock an account for
15 minutes, and every failure is audited. Signing a clinical record needs the
password again within five minutes, so a session left open on a ward computer
cannot sign in a doctor's name. Signed prints carry a QR code that lets an
insurer, court or another hospital check that the record is genuine and
unchanged, without seeing any clinical content.

When a hospital signs staff in through its own identity provider, an email
address finds a local account only if the provider says it verified that
address. On the MedBrains operating system, staff identity runs on Kanidm,
pinned to an exact version, with staff set to sign in with security keys by
default so that guessing a password gets nobody in.

**What it stops:** password guessing, an unattended session signing records, and
a forged or altered printout passing as real.

### The audit trail cannot be edited

Audit records are append-only: the database refuses any change or deletion,
whoever asks. Each hospital's audit log is also hash-chained, every entry linked
to the one before it, so an edit by someone able to switch the database's
protections off still shows when the chain is checked. Password hashes, sign-in
secrets and recovery codes are kept out of the log.

**What it stops:** an insider covering their tracks, and the audit log itself
becoming a place to steal credentials from.

### Keys are checked when they are loaded

This is the newest layer; the section on recent fixes below says how it
came about. Every key
now passes through one place that checks it before use:

- a key's length is checked, and a key made of one repeated byte is refused;
- a private key must produce the public key it is paired with, and a test
  signature is made and verified before the key is trusted;
- the server refuses to start if its sign-in key pair does not match, instead of
  starting and failing every sign-in later;
- one rule decides every key the server uses to seal stored secrets, and the
  development key in our public code is used only on a machine marked as
  development; any other setting, including a typo, is treated as production;
- the signature code is tested against the published test values in RFC 8032,
  the standard for the signatures we use;
- a repository check fails new code that builds keys from raw bytes outside that
  one place.

Separately, production refuses to start with default passwords or with keys
whose values are published in our repository, and the installer generates real
ones.

**What it stops:** a damaged, mismatched or published key being used as if it
were sound.

### The program is written to fail safely

The server is written in Rust, with `unsafe` code forbidden across the whole
workspace. That rules out a family of memory errors behind many serious flaws in
older software. Our build rules also refuse code that could crash the server on
an unexpected value, so an error has to be handled, not ignored.

**What it stops:** whole classes of memory bugs, and crashes that become outages.

### Dependencies are checked on every change

The lockfiles that fix the exact version of every open-source piece are kept in
the repository. On every change, continuous integration runs `cargo audit` and
`cargo deny` for the Rust code and `pnpm audit` for the web code, and these block
a change with a known high-severity flaw. A dependency review blocks a pull
request that adds a high-severity flaw. GitHub's CodeQL analyses the code,
TruffleHog looks for real leaked secrets, and OSV-Scanner, Checkov and zizmor
check the other lockfiles, the infrastructure code and the build workflows
themselves; those three report findings for now and become blocking once their
backlogs are cleared.

The build workflows pin every third-party action to an exact commit, so a
hijacked version tag cannot run code in our builds, and each workflow starts
with read-only access. Each change to the main branch keeps a software bill of
materials. The release pipeline signs container images and checksums with
cosign and attaches the bill of materials and build provenance.

**What it stops:** a known flaw in a dependency reaching a hospital unnoticed,
and a tampered build step.

### Backups are sealed before they leave the machine

The installer sets up a nightly database backup. Before a copy leaves the
machine it is encrypted to a public key whose private half is kept offline, and
without that key file in place the backup refuses to send anything. A restore
drill script proves the backups actually restore.

**What it stops:** a stolen backup being readable, and a backup that was never
tested failing on the day it is needed.

### The operating system protects the disk and its own updates

On the MedBrains operating system, the data partition, which holds the database,
secrets, files and logs, is encrypted with LUKS2. It is created encrypted on
first boot, so no plain copy ever exists. Its key is sealed to the machine's TPM
chip and tied to how the machine starts. A recovery key is shown once, and a
start-up PIN is optional. A machine with no TPM stops and asks rather than
storing patient data unprotected. Each machine makes its own keys on first boot,
so two machines from the same image share no secret.

Updates arrive as whole signed images written to a second slot, never over the
running system. The machine starts the new version on trial, checks that the
database, server and front door are healthy, and goes back to the old version
by itself if they are not. In our virtual-machine tests, tampered and
rolled-back updates are refused. The same signed bundle can arrive on a USB
stick for a hospital with no internet link.

The firewall refuses everything in both directions unless it is listed, and the
database answers only its own machine.

**What it stops:** a disk taken out of the machine being read, an update that
fails leaving the hospital without a system, and a forged update being installed.

## What we fixed recently, and how we found it

Every system has flaws. What matters is how fast they are found and how openly
they are fixed. Two recent examples, without the details an attacker would want.

**Seven dependency alerts, fixed on 11 November 2026.** The most serious was in
`certifi`, the list of trusted certificate authorities used by our Python test
tools. It still trusted intermediate certificates from eMudhra's emSign whose
keys had been generated weak (advisory GHSA-6q48-6c7w-9gw2, rated critical). We
moved to the release that drops them. The same change updated `idna`
(GHSA-65pc-fj4g-8rjx), `node-forge` and `fast-xml-parser` for medium and
low-severity advisories. Two alerts are not fixed yet, and we say so: `glib`,
which arrives through the graphics toolkit on our operating system's screen
and needs a larger toolkit upgrade, and `rsa`, which has no fixed release and
appears only in a test helper for the operating system.

**Our own key handling, fixed on 12 November 2026.** After reading about the
eMudhra weak-key incident, we asked whether our code would notice a damaged
key. Our own review found that it would not: every loader trusted its bytes.
Some modules could also fall back to the development key that is published in
our repository on any machine not set exactly to "production", such as a
staging server or a mistyped setting, and would then seal hospital secrets with
a public key. That is now one rule: anything not explicitly marked as
development is production. Sign-in key pairs and doctors' signing keys are
checked before use, keys from partner systems must be valid points on the
expected curve, and a repository check stops new code handling raw keys. This
was found by our review, not by an incident; the key layer above lists the checks.

**How we find them.** Scanners run on every change: `cargo audit` and
`cargo deny`, `pnpm audit`, OSV-Scanner, CodeQL and a secrets scan, and GitHub's
Dependabot alerts tell us when a new advisory touches something we use.
Security changes get an independent review before they merge; the signing
changes in November were reworked after one. And we read other vendors'
incidents and ask whether the same mistake is in our code, as with eMudhra.

**How a hospital gets the fix.** On the MedBrains operating system, fixes
arrive as signed updates that roll back by themselves if the new version is not
healthy. Our [security release process](https://github.com/medbrains/medbrains/blob/main/medbrains/docs/SECURITY-RELEASE-PROCESS.md)
sets the timelines, critical within 72 hours, and how advisories are
published. If you find a vulnerability, please report it privately as our
[security policy](https://github.com/medbrains/medbrains/blob/main/SECURITY.md)
describes, not in a public issue.

## What we do not claim yet

Honesty about gaps is part of security. Today:

- **No outside penetration test yet.** Our threat list requires one before the
  MedBrains operating system goes live in a hospital.
- **No security certification.** We do not hold ISO 27001, SOC 2 or similar.
- **The operating system is not in a hospital yet.** Its disk encryption and
  signed updates are built and tested in virtual machines.
- **A stolen machine is not fully covered without a PIN.** Someone who can
  alter the system partition of a machine that unlocks by itself can get in.
  A PIN closes that now. Coming next: a sealed, read-only system partition, and
  further hardening of the kernel, services and the TPM against power cuts.
- **The update signing key is not yet held offline on hardware**, and the
  check of each machine's parts list against known flaws is not built.
- **Three scanners report but do not yet block**, as described above.

We keep the full list, with the test that would close each item, in our
public threat document.

## A checklist to use with any vendor

You can ask these of us or of anyone else. A good vendor answers each with
evidence, not a brochure.

1. **How many separate products make up your system,** and who patches each one?
2. **Where is hospital separation enforced:** in the database, or only in the
   application?
3. **Is every permission checked on the server,** and what does a screen show
   when the check itself fails?
4. **Can your audit log be edited** by a database administrator? How would we
   know?
5. **Is the disk encrypted from the first boot,** and who holds the recovery
   key?
6. **Are backups encrypted before they leave the server,** and when did you
   last prove a restore?
7. **How are updates signed, and what happens if one fails half-way?**
8. **What do you do when a key is damaged or does not match?** Warn, or refuse?
9. **Can we see a software bill of materials,** and how fast do you fix a
   critical flaw?
10. **When was your last independent penetration test,** and can we see the
    summary?

## The short version

Most security holes start at a seam between products. MedBrains is one program on one
database, with its own small operating system and one signed update path, so
there are fewer seams to start from. Each layer is built to refuse: the database
refuses the wrong hospital's rows, the server refuses unchecked actions, the
audit log refuses edits, and the key loader refuses a bad key. We have not had
an outside penetration test yet. When we fix a flaw, we say what it was and
how we found it.

If your IT team would like to go through this list against the code itself, book
a demonstration and we will walk them through it.
