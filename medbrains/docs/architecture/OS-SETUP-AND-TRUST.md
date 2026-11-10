# MedBrains OS: setup, machines and trust

Status: PROPOSED, 2026-11-04. Extends RFC-HOSPITAL-OS §8b, §8j, §8k, §8r and §8s. Section 6 depends on
an owner decision that is still open.

## 1. The problem

The first image boots into the cloud sign-in page and asks for a hospital code. That is the wrong
model for a machine a hospital owns. Reading the code found three deeper faults:

1. **The wizard cannot run.** The server seeds a hospital on every empty database before it listens,
   so `/api/onboarding/status` never reports `needs_setup` on a new box.
2. **Every machine is built as a server.** The image starts PostgreSQL and the server on every boot. A
   workstation or display should run neither, or cheap nodes are impossible.
3. **Setup needs network safety.** A new box must not let the first person on the network finish
   setup and become administrator.

## 2. How real systems do this

| System | Idea we take |
|---|---|
| Windows setup, macOS Setup Assistant | A few plain screens once; the machine then knows who it belongs to |
| Windows Autopilot, Apple Business Manager, ChromeOS enrolment | A machine registered at purchase joins the right organisation by itself |
| Red Hat Enterprise Linux | Open code; a subscription pays for updates and support, not the right to run |
| systemd (`cryptenroll`, `creds`) | Disk and service secrets sealed to the TPM, with no custom crypto |
| FIDO Device Onboard, BRSKI (RFC 8995) | Standards for proving who owns a new machine; evaluate before inventing one |

## 3. One rule above the rest

**Who controls a machine is separate from who paid for it.** The hospital holds the keys that control
its machines and data. MedBrains signs software and licences, and holds nothing that can reach a
hospital, stop a machine or read a record (§8r rule 1).

## 4. Pieces

```
                 ┌───────────────── same on every machine ─────────────────┐
 Hardware        │ TPM (or passphrase)   disk   screen   network            │
 Linux + systemd │ verified /usr   encrypted /var   networkd                │
 OS services     │ medbrains-setup   medbrains-agent   cage + WPE           │
                 └───────────────────────────┬─────────────────────────────┘
                              role chosen once at first boot
                 ┌───────────────────────────┴─────────────────────────────┐
   Administrator │ PostgreSQL  medbrains-server  Pingora hospital root key │
                 ├─────────────────────────────────────────────────────────┤
     Workstation │ screen → agent → administrator. No database, no server. │
         Display │ same, showing a board; no patient records stored        │
     Ward backup │ encrypted local copy (last: hardest and riskiest)       │
                 └─────────────────────────────────────────────────────────┘
```

| Piece | Job | Status |
|---|---|---|
| `medbrains-setup` | Runs the first-boot steps. Small Rust service; no database; refuses all network clients | New |
| Setup screen | Static pages in the existing console, no React, so it stays light on any hardware | Extends the console |
| `medbrains-admin.target`, `medbrains-node.target` | systemd targets. The role picks one; everything else stays off | New |
| `medbrains-agent` | On each node: holds the machine identity, gives the screen a local authenticated path to the administrator, reports inventory, checks signed commands | New; replaces the need for client certificates in WPE, which is untested |
| Machine join | Node asks, administrator approves | Extends `medbrains-device-pairing`, which is admin-first and tied to a user today |
| Hospital details | Three fields at setup; the existing 15-step wizard (`pages/onboarding`) becomes an optional checklist on the home screen | Exists; needs fault 1 fixed |
| Nodes screen | Waiting machines, then every machine; grows into fleet (§8r) | New |

## 5. First boot

```
Logo → Network → Time → Updates → Activate → This machine is…
                                               ├ Administrator → three fields → review → home screen
                                               └ Node → find hospital → show code → approved → choose type
```

- **Resumable.** Each step saves to `/var/lib/medbrains/setup/state.json` before moving on, so a power
  cut returns to the same step. Every step is safe to repeat.
- **Never blocked by the internet.** No internet is a valid answer on every screen.
- **Physical presence is the trust.** Setup listens only on the machine itself. A machine with no
  screen shows a one-time code on its serial console.
- **Nothing is reachable early.** On an administrator machine the Pingora front (`medbrains-front`) binds to loopback until the first
  administrator exists. This closes fault 3.
- **You choose the first password.** No generated password appears on screen, and the forced-change
  panel from D1 is retired.

**Server changes:** an appliance flag stops the hospital seed, leaving technical baseline only, so
`needs_setup` is true (fault 1). The flag also makes the sign-in-options endpoint return the one
hospital, so `login.tsx` skips its code step. Cloud installs are unchanged.

**The main question, in plain words:**

```
┌ Welcome to MedBrains ───────────────────────────────┐
│ What are you doing with this machine?               │
│                                                     │
│  ▸ Setting up a new hospital                        │
│    This becomes the main machine.                   │
│                                                     │
│  ▸ Connecting to my hospital                        │
│    Found: City Hospital main machine  (recommended) │
│                                                     │
│ [ Back ]                                            │
└─────────────────────────────────────────────────────┘
```

It comes right after the network step, because finding an existing main machine needs the network. With
a cable, nothing is asked first, so this is the first question most people see. People see "main
machine" and "connect", never "administrator", "node" or "edge".

**Connecting** then asks only what kind of machine this is (workstation, display, ward backup) and
shows the code to approve. It never asks for hospital details, which come from the main machine.

## 5a. Almost nothing to fill in, and mistakes are easy to undo

**What a person actually enters:**

| Step | Input needed |
|---|---|
| Network | Nothing on a cable; Wi-Fi name and password otherwise |
| Time | Nothing, unless the clock cannot be trusted |
| Updates | One tap: Now or Later |
| Activate | A code, or Skip |
| "Setting up a new hospital, or connecting to one?" | One tap |
| Administrator | **Hospital name, username, password: three fields**, then enrol an authenticator app (TOTP); the first administrator's group requires the second step |
| Recovery key | Confirm it is saved |
| Node | Check the code matches, tap the type |

Country, departments, beds, numbering and modules start from defaults and are changed later in
Settings. Nothing clinical or billing goes live until the checklist item for it is done.

**Undoing a mistake depends on how far you are:**

| When | How | Asks for |
|---|---|---|
| During setup | **Back** on every screen; nothing is final until Review | Nothing |
| A typing mistake after setup | Edit it in Settings: name, network, address | Administrator sign-in |
| Finished, no patient data yet | **Start over**: back to the first screen in under a minute | Administrator sign-in on the machine's own screen |
| Password forgotten | Reset using the recovery key | Recovery key, at the machine |
| Wrong machine joined | Remove it from Nodes; on the node, **Reset this machine** | Administrator approval |
| Patient data exists | **Factory reset** only, never one click | See below |

**Start over** is offered only while the database holds no clinical records, and the server checks
that itself. **Factory reset** needs someone at the machine, a current backup or a recorded choice to
go without, the hospital's name typed in full, and a second person's approval (§8r: wipe needs two).
Medical records have legal retention duties, so the screen says so first. A network user can never
start either one.

**How reset works:** destroy the disk key, which makes the data unreadable at once, recreate the data
partition, and reboot to the logo. The read-only system in `/usr` is untouched, so no reinstall is
needed. A node holds no patient data, so resetting it is one step; ward backup follows the factory rule.

## 5b. After setup: sign in to the machine, then a home screen of apps

MedBrains is one app on the OS, not the OS itself (§0: the OS hosts many applications). So the machine
signs people in, and apps never show their own sign-in.

```
Logo → OS sign-in → Home screen → tap an app → app is already signed in
                     MedBrains · PACS · hospital's own apps · Machine settings
```

| Piece | Job | Status |
|---|---|---|
| OS sign-in screen | One sign-in for the machine: password, then badge or SSO; replaces the app's login on the appliance | New; uses the kernel's identity |
| Home screen (`medbrains-home`) | Apps this person may use, plus status, machine settings and lock | New; §0 lists the entry as not built |
| App launcher | One app full screen at a time, switched like a tablet, each in its own WebKit view | New; the compositor must change, because `cage` shows one window |
| Single sign-on to apps | The OS holds the session and gives each app a token through the existing OAuth path | Extends the vendor apps OAuth |

**Rules:**
- **The kernel decides who you are,** on the administrator machine. The home screen is a view, not a
  second account system, so the home screen shows only apps the person's role allows.
- **Shared machines come first.** Hospital workstations are shared, so lock is fast, switching person
  takes seconds, and signing out closes every app and clears its data. An idle lock is on by default.
- **Never touch a running patient task on lock.** A locked app stays as it was for the same person, and
  closes for a different one. Unsaved clinical work is kept as a draft for that person only.
- **No general desktop.** No GNOME, file manager or free windows (§8b): each adds size, attack surface
  and things to manage. Split view for two apps can come later if real work needs it.
- **Purpose-built machines skip it.** A Display goes straight to its board with no person signed in, and
  a kiosk to its one app.
- **Apps cannot read each other.** Each view has separate storage and only the data its grants allow.

**Not proven:** memory with several WebKit views open is unmeasured and may be the limit on cheap nodes,
so open apps may have to be closed in the background. The compositor is not chosen yet.

## 6. Licence and activation (owner decision open)

The design below assumes the model recommended to the owner: the OS is free under Apache-2.0, and
hospitals pay for hardware, support and the setup and fleet service. Apache-2.0 code can have any
check removed, so a licence can only ever unlock services, not enforce the right to run.

```json
{ "hospital": "…", "machine_key_hash": "…", "services": ["support", "fleet-service"],
  "issued": "2026-11-04", "expires": "2027-11-04", "signature": "…" }
```

- A licence is a signed document, not a secret. It sits on the data partition. The binding comes from
  the machine key in the TPM.
- **Online:** enter a code, and only then does the machine contact MedBrains. **Offline:** carry a
  request file out on USB and bring the signed licence back.
- **Skip is allowed.** The machine runs without one.
- No background check-ins (§8j: nothing leaves an install unless the hospital turns it on). The
  licence holds no remote switch.

| When expired or missing | Result |
|---|---|
| Patient care, records, sign-in, backups, export | **Never affected** |
| Security fixes | **Always available** |
| Support and paid services | Stop, with plain notice to administrators only |

## 7. Keys: where each one lives

| Key | Lives in | Held by | Can | Cannot |
|---|---|---|---|---|
| Release key | Offline | MedBrains | Sign OS images | Reach any machine or data |
| Licence key | Offline, separate from release | MedBrains | Sign licences | Sign software; affect a running machine |
| Hospital root key | Administrator, sealed to TPM; encrypted backup | Hospital | Approve machines, sign fleet commands | Be read by MedBrains |
| Machine key | Created inside that machine's TPM; never leaves | That machine | Prove it is that machine | Move to another machine |
| Disk key | Sealed to TPM (`systemd-cryptenroll`), plus recovery key | Machine and hospital | Unlock the disk if the boot chain is unchanged | Unlock in other hardware |
| Service secrets (JWT, database) | `systemd-creds`, sealed to TPM | Machine | Start services | Be read from a copied disk |

**The hospital root key is created in software and then sealed,** because a key created inside a TPM
cannot be backed up, and losing it would strand every node. The encrypted backup and the disk recovery
key are shown once and must be confirmed saved. MedBrains keeps no copy, so **a lost recovery key
cannot be rescued by us.**

**No TPM (Raspberry Pi 5 has none built in):** use an add-on TPM module, or a passphrase at boot. The
screen states the weaker protection plainly. TPM sealing only protects against tampering once verified
boot exists, so updates need signed policies (`systemd-measure`) to avoid locking out after each update.

### Key card at the main machine

**Owner direction, 2026-11-04:** the main machine is the parent of the hospital, controlled with a key
card. A card is an NFC FIDO2 credential with a PIN, so a found card alone opens nothing.

The card gives **control of the system, not all patient data.** System administrators run machines and
policies. Reading a record still needs a clinical reason under RFC-AUTHZ, and break-glass is audited.
One all-powerful card would be the single theft that loses a hospital.

| Card | Can | Needs |
|---|---|---|
| System owner | Approve machines, change policies, updates, restore | Card + PIN |
| Second owner (a spare in a safe) | The same; replaces a lost card | Card + PIN; use raises an alert |
| Two owners together | Wipe, factory reset, new root key | Both cards at the machine |
| Staff | Sign in and fast switching on workstations | Card, plus PIN by hospital policy |

A lost card is cancelled from the console at once, and the recovery key stays the last resort (§7).

### Hardware keys (USB or NFC security keys, using FIDO2)

A TPM protects a machine. A hardware key protects a **person**, and a stolen password alone then gets
nobody in. Passkey sign-in is not built; `step_up.rs` lists it as a follow-up.

| Use | Who | Rule |
|---|---|---|
| OS sign-in | Administrators | **Required** once they have enrolled a key; a password alone is refused |
| Dangerous approvals: machine join, remote support, factory reset | Approvers | Key touch per approval, tying it to a named person who is present |
| Fast sign-in on shared machines | Clinical staff | Optional tap of a badge or key; a tap alone is enough only with a short lock timeout set by the hospital |
| Hospital root key backup | Hospital IT | A key can unlock the backup instead of a typed passphrase |

- **Always enrol two.** Keys get lost, so setup asks for a spare, and the recovery key remains the last
  resort. Lost key: an administrator removes it at once, with audit.
- **Never required to start.** A hospital with no keys still sets up with a password, and the screen
  recommends buying them. Keys belong in the hardware kit as an option, for administrators first.
- **Not a licence dongle.** A hardware key proves a person, never a right to run the software (§6).
- **Patient care has a way through.** If a clinician's key is lost in an emergency, the hospital's
  break-glass rules apply, and they are audited. Nobody is locked out of a patient by a missing key.

## 8. A node joins

```
Node                              Administrator                 Person
 find: network discovery, QR or address ─────▶
 send: public machine key ──────────────────▶ list as waiting
 show: short code            ◀── same code ──▶ show code        checks they match, approves
                             ◀── signed certificate from hospital root ── audited
 agent starts; role and type fixed
```

- The matching code proves both sides, so a fake administrator on the network is caught. A code alone
  sent one way would not prove that.
- Removal takes effect at once on the server. An offline machine learns on reconnecting, so ward
  backup needs a stated offline limit (§8s).
- **Later, pre-registration:** a machine's identity is tied to a hospital's public key at sale, so it
  joins without the code step but still awaits approval. It gives MedBrains no control.

**Permissions, defined in Rust first:** view machines; approve a machine; remove a machine; view
licence; manage licence. Separate grants, none reused from device pairing unless it truly fits.

### Owner direction, 2026-11-04: find, ask, approve, over iroh

A new machine finds the hospital's main machine on the network and asks to join; a person approves it on
the main machine. iroh carries it, because `medbrains-edge` already has it, with admission and a roster.

```
Node: "Connecting to my hospital"              Main machine: Nodes screen
  finds main machines nearby (iroh mDNS)
  person picks one, chooses a type
  sends a join request with its node key ───▶  "Reception PC wants to join"
  shows a 6-digit code                         shows the same code; person checks it
                                     ◀───────  Approve: key added to the roster, audited
  connected: the screen reaches the main machine through the local agent, over iroh
```

| Why iroh helps | Rule we need with it |
|---|---|
| The key is the identity: no certificate authority for a node | A key alone grants nothing: only an approved key is admitted (existing rule) |
| Encrypted by default | Fixed UDP port, with a firewall rule; none today |
| Finds machines on the LAN with no setup | Mismatch of codes stops a fake main machine; discovery shows names, never data |
| Reaches another site with no open inbound port | **No public relay by default:** run the relay on the hospital's main machine, because a hospital must not depend on outside servers |

**Unknown until tested:** speed through the local agent, whether multicast is blocked on real hospital
networks (fallback: type the address or scan a QR code), and iroh's size in the node image. Revocation
for an offline node stays limited by the roster's 16-hour ceiling (OS-EDGE-NODES).

## 8a. Moving, swapping and replacing machines

**The workspace belongs to the place and the person, not to the box.** Reception 1 keeps its printer,
queue, display and app list whichever machine sits there, using the existing `stations` and location
hierarchy. A person's work lives on the main machine, so it follows them to any screen.

| Situation | What people do | What happens |
|---|---|---|
| **A person moves to another screen** | Lock here, sign in there | Same apps and work; a saved draft is offered, and the first screen closes that person's session |
| **Machine moved** (reception to ward) | Unplug, carry, plug in | It reconnects by its own identity, with no setup. It asks a signed-in administrator to confirm the new place |
| **Two machines swapped** | Swap them, then pick "Swap places" in Nodes | Each takes the other's place settings |
| **Dead or old machine replaced** | New machine: Connect, code, then "Replaces Reception 1?" | Inherits the place; the old machine's access ends at once |
| **Machine retired** | Remove in Nodes, then Reset this machine | Access ends; the machine returns to the first screen |

- **Nothing is lost.** A workstation or display holds no patient records, so moving or replacing one
  costs nothing.
- **A machine cannot move itself.** A new network suggests it moved, but only a person with the
  permission confirms the new place, and that is audited. Until then it keeps working, and place-based
  items such as the printer and queue say "place not confirmed" instead of guessing.
- **Ward backup is the exception.** It holds encrypted records, so moving it requires a sync first, and
  replacing it starts a new copy.

## 8b. Fitting into how hospitals' IT already works

Corporate IT is usually separate products stitched together: a directory, a device manager, a security
agent, and for hospitals a badge product. MedBrains ships one working default for each and connects to
the hospital's existing product where it has one.

| Job | Common products | Works alone with | Connects to |
|---|---|---|---|
| Who people are | Okta, Entra ID, Active Directory | Kernel identity | OIDC, SAML (exist); SCIM (to build, §9); LDAP or Kerberos only if a real hospital needs it |
| Sign-in at the machine | Okta Device Access, macOS Platform SSO | OS sign-in (§5b) | The hospital's directory, through the main machine |
| Managing machines | Intune, Jamf | Nodes and fleet (§8r) | Not planned; these machines are managed here |
| Security agent and console | Trellix Agent and ePO, CrowdStrike | `medbrains-agent` and security screen (§8r) | SIEM export; a third-party agent is not tested |
| Finding weaknesses | Rapid7, Tenable | Version and known-flaw report per machine, from the signed image's parts list | Allow an authorised scanner; export the list |
| Badge tap, fast switching | Imprivata | OS sign-in with badge or key | Not planned |

**One sign-in path:** screen → main machine → kernel identity → (optional) hospital directory. A node
never talks to the directory itself, so a hospital connects it once, in one place.

**Patient care must survive a directory outage.** A cloud directory or internet outage must not stop a
night shift signing in. After a successful online sign-in, the main machine keeps a salted hash, so that
person can sign in locally for a period the hospital sets. The trade-off is real: someone removed during
an outage keeps access until the directory returns, so the limit is short by default and every such
sign-in is audited and flagged.

**The agent checks in, as Trellix's does.** It calls out on a schedule, reports, collects policies and
enforces them locally, so it keeps working offline and needs no open inbound port. An urgent command
arrives through the same outbound connection. Each is signed by the hospital root (§7, §8r).

**Finding weaknesses is simpler on this OS, not unnecessary.** Every machine runs a known, signed image,
so its parts list answers "which machines have this flaw?" without scanning. That only covers what we
ship: misconfiguration, the hospital's own apps and the rest of its network still need a scanner. An
independent penetration test also has to come from outside, never from us marking our own work.

**What we do differently, and why:**
- **Nothing runs in the Linux kernel.** Security products that do can take machines down with a bad
  update. Ours run as normal services, and updates roll out in rings (§8r).
- **Bought together, not stitched.** A person's access, machine and session are one record, so leaving
  the hospital ends all three at once.
- **Still not a replacement claim.** We do not match a large vendor's threat research or certifications
  (§8r). Some auditors will still ask for a named product.

## 8c. MedBrains Control: everything built in, run from one web console

**Owner direction, 2026-11-04: all of it is built in and controlled from the web.** A hospital buys
nothing else to run its machines and security. Connecting to other products (§8b) stays optional.

Control is an OS app, separate from the MedBrains hospital app. It opens in a browser on the hospital's
network, or from the home screen, and every action needs its own permission.

| Section | What IT does there | Replaces the need for |
|---|---|---|
| **Machines** | Approve, name, place, move, swap, retire; health and versions | Intune, Jamf |
| **People and sign-in** | Accounts, groups, badges, hardware keys, who is signed in where | Okta, Imprivata |
| **Policies** | Lock timeout, USB, allowed apps, by group or ward | Group Policy, ePO policies |
| **Protection** | Intrusion alerts; isolate a machine; malware scan of uploads | Trellix |
| **Weaknesses** | Known flaws per machine, exposed services, what to fix first | Rapid7 |
| **Updates** | Rings, maintenance windows, rollback, USB bundles | Update tools |
| **Remote support** | Ask, approve, see or control a screen, or run approved actions | Remote support tools |
| **Audit and reports** | Who did what, evidence for inspectors, export | SIEM reports |

**Central identity and device management are one system.** MedBrains is the hospital's identity source
(Okta, Entra) and device manager (Intune, Jamf) in one place. Every machine and person is one record.

| Device or app | How it is managed | Depends on |
|---|---|---|
| MedBrains OS machines | `medbrains-agent`: full control | Only us. First, and the strongest |
| Other software in the hospital | Signs in with MedBrains through OIDC, then SAML | New: an identity provider with user sign-in and ID tokens. Connected apps have only an app token endpoint today |
| Android phones and tablets | Android Enterprise | Google's enrolment rules |
| iPhones, iPads, Macs | Apple's MDM protocol | A push certificate from Apple, per hospital; Apple sets what is allowed |
| Existing Windows PCs | Windows' built-in MDM protocol | Microsoft's protocol; less control than on our OS |

Phones and other vendors' systems are limited by what those vendors allow, so the promise is "managed
from one place", never "the same control everywhere". They come after our own machines (§8r M6).

**Who you are versus what you may do.** Authentication proves the person. Authorization (RBAC, groups,
per-record rules) stays entirely in MedBrains under RFC-AUTHZ, and no identity product decides it.

**Choosing the identity provider (decided: Kanidm, chosen on security over FerrisKey; see OS-BUILD-PLAN T3). The table records the comparison:**

| Option | For | Against |
|---|---|---|
| Keycloak | Most complete, including SAML | Java; about 1 GB idle per Red Hat's guide, double the whole appliance target. Not shipped |
| Rauthy (second candidate) | Rust, Apache-2.0, passkeys, OIDC, independent audit, Postgres optional; project states about 40 MB | Pre-1.0; one person wrote 94% of its commits; no SAML seen; a second account store to reconcile |
| FerrisKey (owner's first choice 2026-11-04, then rejected on security) | Rust, Apache-2.0, Postgres and SQLx like ours, full web admin and admin API, OIDC, SAML provider, LDAP federation, WebAuthn, webhooks, five named maintainers | Pre-1.0 (v0.10), started 2025; recent critical and high advisories; no third-party audit seen; rate limiting and key-card allow-listing still open; images only, so we build it ourselves (no Docker in the OS); its built-in RBAC stays unused |
| Ory Hydra + Kratos | Mature, modular, Apache-2.0, widely used | Go, two services; memory unmeasured |
| **Kanidm (chosen)** | Largest community of the three (5,530 stars, 156 contributors, two main maintainers), v1.x. Rust, MPL-2.0, passkeys, OIDC, LDAPS, RADIUS, TPM offline Unix sign-in | Admin mainly by command line, against our web-only goal; own database; recent critical and unauthenticated crash advisories; no SAML seen |
| Torii | Rust library, MIT | Its README says not production-ready and not audited. Rejected for now |
| Build our own | One binary, one account store | Identity protocols are easy to get subtly wrong; needs conformance testing and an outside audit |

**Plan:** Kanidm is the identity provider (`feature/os-kanidm`, T3). `medbrains-sso-login` trusts any OIDC
provider and maps its groups to roles. Kanidm's command-line admin is covered by an Identity app in the
launcher (T3.1). When a node joins, it wipes any Kanidm data it holds, so only the administrator machine
keeps the account store. If Kanidm fails its acceptance tests, build our own on `webauthn-rs` and
`openidconnect-rs`, with conformance tests and an audit first.
SAML is added only when a real hospital app needs it.

**Built on one agent and one console.** `medbrains-agent` does the work on every machine, so nodes do not
carry a separate tool per job. Open parts (§8r: osquery, `wayvnc`, ClamAV) run inside it only where they
fit the size budgets.

**The console is the most dangerous thing we ship, so:**
- It is never open to the internet by default. Reaching it from outside needs the VPN path (§8r).
- Sign-in needs a hardware key for dangerous sections; a password alone is view-only.
- Isolate, remote control and wipe are separate grants; wipe needs two people; all are audited.
- MedBrains support gets in only through the same approval, for a set time, with the hospital watching.
  There is no standing vendor access and no master login.
- It runs on the main machine only, and it is off the path of patient care. If Control fails, machines
  keep working and keep enforcing their last policies.

**Limits:** this is a large build, and it will not match a large vendor's threat research at the start.
Public feeds and open rules come first. Each section ships only when it works end to end.

## 9. When things go wrong

| Failure | What happens |
|---|---|
| Power cut during setup | Resumes at the saved step |
| No internet | All steps continue; updates and activation offer USB |
| Disk moved to other hardware | Will not unlock without the recovery key |
| Board or TPM replaced | Recovery key unlocks; machine gets a new identity; licence re-issued |
| Administrator machine dies | New machine, restore backup and root key; nodes still trust the same root |
| Second administrator by accident | Setup finds the existing one and recommends joining |
| Fake administrator on the network | Codes do not match; nobody should approve |
| Licence forged or copied | Signature or machine binding fails; only paid services are refused |
| Recovery key lost and disk locked | Restore from backup on a new machine; the disk stays unreadable by design |

## 10. Build order

| Step | Delivers | Ends on |
|---|---|---|
| **S0** | Appliance flag: no hospital code at sign-in | Box signs in directly |
| **S1** | `medbrains-setup`, network, time, role, three-field administrator, Back and Start over (§8s B1) | Blank box to dashboard with three fields; Start over returns to the first screen |
| **S2** | Role targets; a node starts no database or server; measure its memory | Workstation memory measured against the administrator's |
| **S2b** | OS sign-in, home screen, MedBrains opening as an app, lock and switch person | Sign in once, tap MedBrains, already signed in |
| **S3** | TPM: disk, service secrets, machine key, recovery key | Copied disk refuses to open |
| **S3b** | Hardware keys: administrator sign-in, then key-touch approvals | Password alone refused for an enrolled administrator |
| **S3c** | OS sign-in through the hospital's directory, offline sign-in limit, SCIM | Directory down; a recent user still signs in, and it is audited |
| **S4** | Join, agent, Nodes screen (§8s B2) | Second VM joins and works |
| **S4b** | Move, swap and replace in Nodes, using `stations` | Machine moved; place confirmed; printer and queue follow |
| **S4c** | Control console: Machines and Audit first, then Policies, Updates, Remote support, Protection, Weaknesses | Each section works from a browser on a test fleet |
| **S5** | Activate, once the owner decides §6 | Licence works online and by USB |
| **S6** | Updates through setup, after A/B (D4) | Update and rollback from the screen |
| **S7** | Display, ward backup, pre-registration | One at a time |

## 11. Not proven yet

- Real hardware: all of this has run only in QEMU.
- Node memory: the split should cut it sharply, but WebKit's share is unmeasured.
- The agent's local path with WPE, and TPM flows on Debian trixie: designed, not run.
- FIDO Device Onboard or BRSKI: candidates, not evaluated.
- Whether a Pi 5 add-on TPM belongs in the hardware kit: a cost decision.
