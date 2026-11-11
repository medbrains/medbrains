# MedBrains OS image (D1)

The appliance image from `RFCs/RFC-HOSPITAL-OS.md` §8b: Debian stable, PostgreSQL 17, the MedBrains
server and web app, and a native desktop on the machine's own screen. Boot it, set it up there, and open
MedBrains from the desktop, with no separate browser. D1 means first bootable, not finished; see
[what is in D1](#what-is-in-d1-and-what-is-not).

## Build

`make os-image` cross-compiles the server and setup service, builds the web app and builds the image.
`medbrains-shell` links against GTK and WebKitGTK, so it is compiled inside the image build by
`mkosi.build.chroot` with Debian's own rustc 1.85. That is why it sits outside the workspace and pins
gtk4 0.10 and webkit6 0.5: the newest gtk4 needs rustc 1.92, and we chose no extra toolchain download
over the newest crate.

```sh
make os-image ARCH=arm64            # server + web app + image
make os-image ARCH=arm64 DEBUG=1    # the same, with a root shell on the serial console
```

The image lands in `/tmp/mb-osimage/out-arm64/medbrains-os_<commit>.raw`. Set `OS_WORK` to move it.
Already have a server binary? `MEDBRAINS_SERVER_BIN=<path> os/build.sh --arch arm64`.

**On Linux, including a CI runner, `build.sh` runs mkosi directly, with no Docker.** It needs root,
and these Debian packages: `mkosi systemd-ukify systemd-repart systemd-boot-efi systemd-container
apt dpkg debian-archive-keyring dosfstools mtools e2fsprogs erofs-utils cpio kmod zstd xz-utils
ca-certificates python3 bubblewrap uidmap`. `install-ukify-splash.sh` adds a small wrapper around
`ukify` on that build machine. We ran this path inside a Linux container with no Docker in it, and it
produced an image; that image was not booted, and it has not been run on a bare Linux host. The images
we tested came from the Mac fallback.

**On a Mac only, the fallback is a privileged Debian container** (`builder.Dockerfile`), because mkosi
needs Linux. Nothing in the image, its services or its Linux build path uses Docker.

`DEBUG=1` is for verification only. **Never ship a debug image**: it gives root to anyone with a
serial cable.

## Boot in QEMU

```sh
brew install qemu
make os-boot FRESH=1    # a brand-new box; `make os-boot` keeps the disk across runs
```

**arm64 under QEMU has no TPM, so a new box stops and asks about it.** Type `STORE UNENCRYPTED` on its
screen to carry on. Debian's arm64 kernel has no driver for the only TPM QEMU can offer there. The sealed
path is tested on x86-64: `MB_OS_TEST_ARCH=x86-64 cargo run -p medbrains-os-test -- <image> disk`.

`os/tests/vm.py` drives it (real input over QMP, screenshots, and a command in the debug shell). QEMU runs headless with its sockets in `/tmp/mb-osimage/vm/`: `vnc.sock` is the screen, `qmp.sock` takes
input, `monitor.sock` takes `screendump`, and `serial.sock` is the shell on debug images. Headless QEMU
only flips the screen while a display is attached, so connect a VNC client or the screen appears
frozen. Set `OS_WEB_PORT` if port 8443 is taken, and `OS_SCREEN_W` / `OS_SCREEN_H` to change its size.

From another computer the same box answers at `https://<address>` with a certificate warning.

## Test an image

`make os-image DEBUG=1`, then `make os-test IMAGE=<image.raw>` boots a fresh machine, makes it a main machine, and checks firewall, kernel hardening, time, memory, disk and the main machine's half of joining (one VM cannot join itself: `tests/two-machines.sh` is the rest). Limits are in `crates/medbrains-os-test/budgets.json`: lower them as numbers improve, and never raise one without a reason in the PR. It needs QEMU, and doesn't run in CI yet.

`cargo run -p medbrains-os-test -- <release image> release` checks a release image from outside, since it has no
shell to check from: SSH does not answer, and its serial port shows no login and runs no command. Set
`MB_OS_TEST_BROWSER=1` to also sign in through a real browser and open Patients (`tests/patients-journey.mjs`;
needs the web app's Playwright on the test computer).

`make os-test-updates IMAGE=<image> BUNDLES=<folder>` proves updates on real QEMU machines: tampered bundles, power cuts, rollback. `os/tests/make-update-bundles.py` makes the folder. `MB_OS_TEST_ARCH=x86-64` on a merged T1 image runs the sealed-disk scenarios instead.

## Boot in UTM

```sh
OS_WORK=/tmp/mb-osimage-shell os/utm-run.sh           # a fresh box, as the VM "MedBrains Dev"
OS_SERIAL=$(os/utm-run.sh --serial) os/tests/vm.py sh 'systemctl is-system-running'
```

This uses Apple Virtualization. UTM's AppleScript creates the VM, then the script quits UTM to set the
keyboard, pointer and display in the bundle's plist, which AppleScript can't reach, so it refuses to run while
another VM is running. There is no QMP here: a debug image has `grim` and `wtype` in the serial shell instead.

## Flash to a Raspberry Pi 5

**Not tested on real hardware.** The image is plain UEFI, and the Pi 5 does not boot UEFI out of the
box. Until the Pi image exists (D2, pi-gen per §8b), the path is community UEFI firmware for the Pi 5
on a small SD card or the EEPROM, with the image on NVMe:

```sh
# from a Linux machine, with the NVMe in a USB enclosure; check the device name first
sudo dd if=medbrains-os_<commit>.raw of=/dev/sdX bs=4M conv=fsync status=progress
```

**NVMe only.** SD cards are unsupported for data (§8a, §8o): a database wears them out, and a worn
card corrupts clinical records. Active cooling is required too. The Debian kernel's Pi 5 support is
partial, so expect gaps; that is what D2 is for.

## What a person sees

1. **Firmware.** The logo of the machine's firmware (TianoCore under QEMU; we don't replace it).
2. **The MedBrains logo**, from the boot file, then a brief dark gap (see [Measured](#measured)).
3. **First boot only: setup,** native screens, each with Back, all operable by keyboard:
   - **Network:** cable state, addresses, whether the gateway and the internet answer, and a plain
     sentence about Wi-Fi. A fixed address undoes itself unless confirmed within 60 seconds.
   - **Time zone:** a searchable list, Asia/Kolkata unless changed.
   - **Updates:** says installing updates is not available in this version.
   - **"What are you doing with this machine?"** "Setting up a new hospital" continues. "Connecting to my
     hospital" looks for main machines; see [Joining a machine](#joining-a-machine).
   - **Three fields:** hospital name, username, password, with the rules shown under each.
   - **Review,** then **Start the main machine**.
   - **Authenticator app:** a QR code and the same secret as text, for an authenticator app on the
     administrator's phone (Google Authenticator, Microsoft Authenticator, FreeOTP), then one 6-digit code from it.
     **Confirm and start** starts the machine. Nothing is final before this. See [One login](#identity-provider-kanidm).
4. **The desktop:** wallpaper in MedBrains blue with a faint grid (no GPU needed), a top bar (hospital name,
   role, clock opening a calendar, firewall state, network, power), a greeting with a plain status sentence,
   a dock, a launcher with search, and machine widgets with real figures (health, network, storage). It
   shows no patient data. Dark by default; Settings offers light and reduced motion.
5. **Apps,** each in its own view with a Home button back to the desktop. MedBrains opens in stated
   stages, with words and a progress bar, and ends in a sentence and **Try again** rather than waiting
   forever. Sign in with what you chose; nothing forces a change. Home keeps the app as it was, and a
   restart signs you out.

**Apps are full-screen views, not movable windows.** While one is open the top bar shows its name with
**Close** (ends its view and frees its memory; the page can ask about unsaved changes first), **Home** (keeps it
running) and **Reload**. The dock marks what is running, and a right click, a long press or the menu key on a
tile offers Open and Close. Keys: Ctrl+W closes, Super or Alt+Home goes home, Alt+Tab or Ctrl+Tab switches
between open apps, F5 reloads. Ctrl+Tab and F5 therefore never reach the page.

**What the status says, and only what is checked.** Firewall on means nftables holds our table. Time
"Verified" means chrony has selected a source using NTS; it reads "Checking" for the first 5 minutes, and
only then "Not confirmed". A failed service is named on screen. Nothing claims disk encryption or verified
boot, because neither exists yet. The Network widget has no internet row: asking would send a request every
poll, so that check runs only on the network screens.

Opening the app from a browser on another computer on the same network stays available once setup has
finished, not before.

### First boot, underneath

1. `medbrains-disk-setup` creates the encrypted data partition with `systemd-repart`, filling the disk and
   sealed to the TPM, then the machine shows a recovery key once and waits for it to be confirmed. A machine
   with no TPM stops and asks instead. See [Data disk](#data-disk).
2. `medbrains-firstboot` generates every secret (JWT keys, ID-fingerprint and provider keys, database
   password), a checksummed PostgreSQL cluster and the certificate for the screen's own front end. None
   of it is in the image, and no password is generated for a person.
3. `medbrains-os-setup` listens on the Unix socket `/run/medbrains-console/setup.sock`, as root, mode 0660
   root:kiosk. A TCP port would let any local user bind it while the service restarts and receive what the
   screen sends. Permissions alone still let in WebKit's helpers, which share the screen's group, so it also checks
   the connecting program with the kernel: root or `/usr/bin/medbrains-shell`, nothing else. A process running as
   the screen's user could still start that program under its own control, so this raises the bar without closing
   the matter. It has no database and no web framework, and every helper it runs has a time limit.
4. **Review** makes the first administrator's Kanidm login (`POST /hospital/admin`, answering the authenticator's
   QR code and secret). **Confirm and start** (`POST /hospital`, with the code) saves it, then writes the three fields into the env as `MEDBRAINS_SEED_*`, the password only as its Argon2 hash, then the role marker
   `/var/lib/medbrains/config/role-main`, then starts `medbrains-main.target`.
2. `medbrains-os-setup` listens on `127.0.0.1:3100`, as root, with a token only the screen's group can
   read (`/run/medbrains-console/setup-token`). It has no database and no web framework.
3. `medbrains-agent` starts, listening for main machines. It offers nothing.
4. **Review** starts `medbrains-firstboot`, which generates every secret (JWT keys, ID-fingerprint and
   provider keys, database password), a checksummed PostgreSQL cluster and the certificate for the
   screen's own front end. None of it is in the image, no password is generated for a person, and a
   machine that becomes a node never holds any of it. Review then writes the three fields into the env as
   `MEDBRAINS_SEED_*`, then the role marker `/var/lib/medbrains/config/role-main`, then starts
   `medbrains-main.target`.
5. `medbrains-db-init` creates the database roles. `medbrains-server` runs migrations and the seed as the
   owner, then serves as `medbrains_app`, which row level security applies to.
6. `medbrains-console-status` removes all the seed lines once the server answers, and exits.

**Nothing listens before setup.** A condition on the target alone does not do it, because systemd still
starts what a skipped unit wants, and we measured 443 answering that way. So the server, database roles,
PostgreSQL and `medbrains-front` each carry the role condition themselves, and `tests/check-units.sh` fails if one
drifts. Before setup, `ss` shows TCP only on loopback, and the only firewall opening for a service is
UDP 5353, for finding a main machine.

**A power cut during setup** cannot leave a half-made hospital. The env is replaced in one step, the marker
comes last, and the seed creates the hospital and administrator in one transaction. It used to create the
hospital first, and a failure in between left a hospital nobody could sign in to.

## Network menu

An icon in the top bar shows the link really in use and opens one panel, the same one first boot and Settings
show. `network.rs` builds it, and `medbrains-os-setup` does the work, over its socket like everything else it
does.

- **Ethernet:** each wired link with its state, address and speed. With more than one, **Use this link** gives
  it a lower route metric, on the data partition. The others stay up, so this can't cut the machine off.
- **Fixed address:** on tmpfs until confirmed, so a mistake or a power cut undoes it. The timer is only in memory,
  so if the service restarts while one waits, it undoes it at start. Keep with nothing waiting is refused.
- **Wi-Fi:** on or off, the list with signal and lock, a password, the true result, Forget. The panel tells no
  card, software not answering, off and nothing in range apart, so a fault can't read as an empty list. Enterprise
  (802.1X) and hidden networks aren't available yet.

**iwd, not wpa_supplicant,** because it costs less, measured on the same VM: 3 MB of memory against 11 MB
(1.7 MB PSS against 5.4 MB), and 2.8 MB of disk against 5.1 MB before shared libraries. It is started by a udev
rule only when a card appears, so a wired machine pays only for the disk. networkd does the addressing, as on a
cable. `wireless-regdb` is added for regulatory data.

**Passwords** go from the screen to the service over its socket, into `/var/lib/iwd/<name>.psk`, mode 0600, on the
data partition, written in one step because iwd refused a file it caught half written. A password that fails is
removed. It never appears on a command line, which is why this drives iwd over D-Bus with a file rather than
`iwctl --passphrase`, nor in a log. The data partition is encrypted (T1).

**What has been proved:** the whole path with `mac80211_hwsim` and `hostapd`, on the debug image in QEMU. **No real
card has been tried, and real cards need firmware the image doesn't carry,** such as `firmware-iwlwifi`; add it once
the hardware is known (H2). DHCP over Wi-Fi is unproved too: the test network has no DHCP server.

## Restart and power off

The menu asks first, then says what happened. A refusal stays in the menu with a next step and the real reason
goes to the journal. Once accepted, the screen says so, and if the machine is somehow still on after 2 minutes it
says to use the power button. A restart took 17 seconds from click to desktop on an idle VM, and the machine went
down in about a second. **The sentence only shows until the shutdown ends the screen,** within half a second even
with the unit ordered to outlast the server, so a slow server stop would be a dark screen. Why it ends so early is
still open.

**Under Apple Virtualization a guest's restart stops the VM.** Not our behaviour, and nothing in the guest can
change it. Apple's API has no reset event, only [`guestDidStop`](https://developer.apple.com/documentation/virtualization/vzvirtualmachinedelegate/guestdidstop(_:)),
and [UTM's handler](https://github.com/utmapp/UTM/blob/main/Services/UTMAppleVirtualMachine.swift) sets the VM to stopped
and doesn't start it again. Press play in UTM. This is read from their sources, not seen by test here.

**Debug images** used to take 90 seconds more to restart, on a black screen: the serial shell's bash ignores
SIGTERM, so the final shutdown waited for it. Release images never had this.

## Network

`/etc/nftables.conf` is default deny in both directions, and opens the same things on every machine: inbound
5353 (finding a main machine); outbound address, names, time, 7844 and 7845 (a node reaching its main machine),
and 443 to any address until Control can hold an allowlist. **Only a main machine** adds inbound 80, 443, 9443 (identity provider), 123
(time for the LAN), 7844 (iroh) and 7845 ("who are you?" for a typed address), from
`usr/lib/medbrains/main-machine.nft`, and only it announces `medbrains.local` and serves time.
Time (`usr/lib/medbrains/time-role`): a main machine uses NTS sources plus India's NIC (`samay1/samay2.nic.in`) and
NPL (`time.nplindia.org`) servers for CERT-In direction (i); those have no NTS, so chrony uses them only while they
agree with the authenticated ones. A node still takes time only from its main machine, through the agent's relay.
Analysers and PACS have no outbound path until the device network gateway (task N4.2). A file that does not
parse fails the build. Time is `chrony` with NTS, and keeps serving the LAN with the internet gone.

## Identity provider (Kanidm)

[Kanidm](https://github.com/kanidm/kanidm) v1.12.0 (MPL-2.0) proves who someone is, so MedBrains can trust it over
OIDC. **What they may do stays in MedBrains** (RFC-AUTHZ). **Local sign-in stays and stays the default**: nothing
signs in through Kanidm until an administrator adds it under SSO settings. The owner chose it over FerrisKey because
it can restrict sign-in to approved key models; see `docs/DECISIONS.md`.

| What | How |
|---|---|
| Build | `build-kanidm.sh` compiles one release with zigbuild, pinned by commit, by the source's SHA-256 and by the SHA-256 of `Cargo.lock`, from a vendored copy with `--frozen`. A changed upstream stops the build (`tests/kanidm-pin-test.sh`). Debian's OpenSSL debs are pinned too. No Docker, no upstream image. Its UI is server-rendered, so there is no JavaScript build |
| Runs as | `kanidmd.service`, its own user, hardened, on `127.0.0.1:8444`. `IPAddressDeny=any` except localhost, so it cannot call out. It speaks only TLS, so the front reaches it over TLS and trusts that one certificate. It makes its own certificate on first start (`kanidm-tls`), because setup starts it before first boot |
| Reached at | `https://idm.medbrains.local:9443`, through `medbrains-front` (the `identity` site in `front.toml`; its certificates come from `front-certs`, under `/var/lib/medbrains-front/idp/`). **A name of its own:** its session cookies go to its whole domain and browsers send cookies to every port of a name, so `medbrains.local` would hand them to the app. A hospital's LAN has to resolve this name; `medbrains.local` is the only one announced today |
| Data | Its own SQLite store, its keys and its backups, all in `/var/lib/kanidm`. No PostgreSQL connection |
| Closed | LDAP is off. At the front, 404 for SCIM, which has crashed it twice through its filter parser, for upstream sign-in, which has no setting to turn off, and for RADIUS. We use none of them |
| Secrets | No generated admin password: `kanidmd scripting recover-account admin`, as root on the machine, is the way in. Control's API token is in `/var/lib/medbrains/config/idp-control-token`, for root |
| Domain | `domain` in `/etc/kanidm/server.toml` binds every registered key. **Changing it later makes everyone enrol again** |

**To connect it:** recover `idm_admin`, make a group and an OAuth2 client with the redirect
`https://medbrains.local/api/auth/sso/callback`, give the group a scope map of `openid email profile`, a claim map
for `medbrains_groups`, then add the provider and group mappings in MedBrains' SSO settings.
`tests/kanidm-acceptance.py` does all of it. Control does not do this yet.

**One login.** The username and password chosen at setup are the same login for MedBrains and Identity, and in Identity
it also needs an authenticator app's code (TOTP), because the first administrator is in `mb_it_admins` and the SSO callback
refuses an administrator outside it (`sso_error=admin_group`). Setup gives the login to `kanidm-first-admin` on stdin, never
in arguments, a file or a log, in two steps through Kanidm's own credential-update API, so Kanidm's own checks decide:
- `begin` (Review's button) makes the person, adds them to `mb_it_admins` **before** any credential exists, so Kanidm's `mfa`
  rule refuses to save the password alone, sets the password and asks Kanidm for a TOTP (`totpgenerate`). Its status goes
  to the setup service on stdout only; the service turns the secret into the `otpauth:` URI's QR code and the secret in groups
  of four, answers the screen, and wipes its copies. The credential-update session waits in `/run/medbrains-kanidm`
  (root, 0600, tmpfs); it is not the secret, which Kanidm keeps in memory.
- `finish` (**Confirm and start**) sends the code (`totpverify`), saves password and code as one credential, removes the
  session, then grants `idm_people_on_boarding` and `idm_service_desk`. A wrong code answers "That code did not match" and the
  same QR code stays good. An app that ignores the SHA-256 Kanidm asks for (Google Authenticator, Authy) still works: its SHA-1
  code proves the phone, so setup accepts it. After 15 minutes, or a Kanidm restart, the step has expired: Back, then Start
  again gives a new QR code. Starting again also clears any credential an abandoned attempt left.
All of this happens before the role marker: if it fails, setup says so, nothing is left and it can be tried again.
Release images have no default password and no test account. That admin can add staff and reset their passwords; it is
not an `idm_admins` member.

**The password rule, measured.** Kanidm has **no setting** that loosens this, and we do not patch it. A password with no second
step needs 15 characters (`PW_SFA_MIN_LENGTH_NIST`; setting `auth_password_minimum_length` to 1 changed nothing, measured), its strength check
at the top score (zxcvbn 4), not holding the username or address, and not on its banned list. MedBrains' own rule adds a
capital, a small letter, a number and a symbol. No rotation is forced. The setup screen checks all of this before submitting.
Taken: `Blue-River-Walks-At-7!`, `My dog Rocky eats 3 apples`, `Sunflower ward 7 is bright`. Refused: `Test@1234`, `Nurse@2026`,
`Password@1234567`, `P@ssw0rd1234567!`. **So a short memorable password does not work; a short phrase does.** Kanidm alone takes
`blue river test`, 15 characters; setup refuses that one for MedBrains' rule, while local sign-in remains. Names Kanidm keeps
for itself (`admin`, `idm_admin`, `anonymous`) cannot be chosen as the username.

**Signing in to MedBrains through Kanidm.** `kanidm-setup` adds Kanidm as a provider, with a public client and PKCE, so there
is no client secret to keep. The sign-in page offers it, on the machine's screen and in browsers. New people get MedBrains'
least role until an administrator gives them one, and MedBrains keeps no password for them. **Local sign-in stays,** so the
first administrator still has a second copy of the same password in MedBrains until local sign-in is switched off; a reset in
Kanidm does not change that copy. That is the part not yet done.

**Second step for IT.** `mb_it_admins` needs a password with a one-time code, or a key: Kanidm's `mfa` policy, per group. A hospital can
set approved key models on any group as well. Staff stay on passwords.
**Kanidm checks this rule when a credential is saved, not at sign-in** (a TODO in its `authsession/mod.rs`). So joining the group
does not stop a password the person already has; we measured that. To move someone in: add them, then clear their password
(`DELETE /v1/person/<name>/_attr/primary_credential`, as `idm_admin`), then give them a reset link. Kanidm then refuses to save a
password alone, and once a code is saved a password alone no longer signs in. All of it measured with a one-time code; a key
was not tried on this path. There is no screen for this yet, and nothing notices a member who still has a password alone.

**Set on first start** by `kanidm-setup`, and checked on every start:
- **Control's service account (`mb_control`) holds `idm_people_on_boarding`, `idm_service_desk` and `idm_oauth2_admins`,
  and no others.** The check fails, as a failed unit, if it ever holds anything else. `idm_people_admins` is the one
  to watch: it may reset people in `idm_admins`, by design, so it reaches administrator; we did that on a test machine.
- **Control disables people instead of deleting them,** by setting `account_expire`. Only `idm_people_admins` can delete.
- **Control can read every OAuth2 client's secret,** because `idm_oauth2_admins` can. Treat its token as holding them.

**Resets and recovery.**
- A member of staff who forgets: IT runs `kanidm-reset-password <username>` on the machine, or Control asks the API for
  `/v1/person/<username>/_credential/_update_intent/3600`. Either gives a link for that person to choose a new password.
  There is no button for this on a screen yet.
- The administrator who forgets: as root on the machine, `kanidmd scripting recover-account <username>`, which prints a new
  password once, then change it on Identity's Credentials page.
- **The administrator who loses the phone** with the authenticator: sign in to MedBrains with the setup password on its own
  form, the break-glass below, audited as `break_glass_password_login`. In Identity, as root on the machine,
  `kanidmd scripting recover-account <username>` replaces the whole credential, the lost phone's code included, with a
  password printed once. Sign in to Identity with it and add a new authenticator on its Credentials page at once: Kanidm
  checks `mb_it_admins`' rule only when a credential is saved (see Second step for IT), so until then that password alone
  signs in. A release image has no root shell, so the same gap as a forgotten password applies. **A release image has no root shell, so this needs a button in
  Settings or in Control that does not exist yet.** Until then a release machine's forgotten administrator is unrecoverable.

**Hardware keys.** To allow only approved models, an administrator sets a list of makers' CAs and AAGUIDs on a group:
`kanidm group account-policy webauthn-attestation-ca-list <group> <file>` and `credential-type-minimum <group>
attested_passkey`. The check repeats at every sign-in, so removing a model stops keys already enrolled.
`tests/kanidm-softkey` proves this over the network with software authenticators that sign real attestation. **No
physical key and no real maker's list has been tried**: `fido-mds-tool` makes those lists from the FIDO Alliance's data.

**Measured** in QEMU (debug image of `main`, HTML console showing, idle, host under heavy load; two boots each way,
three samples each): whole machine 891 MB without it, 900 MB with it, so about **9 MB**, between 3 and 14. That
understates it, because `MemAvailable` counts file pages it can drop. Its own PSS is 30.5 MB, of which 9 MB is heap
and 21 MB the mapped binary. After the acceptance run
it is 76 to 90 MB, about 50 to 63 MB of that its own heap. It adds no database connections. Image: 50 MB more on the
system partition (binary 48 MB, UI 2 MB), 13 MB of the binary after `zstd -19`.

**Keys at rest.** Its signing keys and password hashes sit in the database without a seal, in `kanidm.db` and in backups:
we took three EC private keys out of a backup and openssl read them with no passphrase. It has no key-encryption
setting, and its TPM support is not compiled in. So **a release image refuses to run it on an unencrypted disk**:
`require-encrypted-data` runs first and wants `/var/lib/kanidm` on dm-crypt and a sealed record from `disk-setup`. A
machine that chose `STORE UNENCRYPTED` gets local sign-in and no identity provider. A debug image, marked at build, may
run it anyway. **A backup copied off the machine is not protected by this:** anyone with one can forge a token for any user.
Until the disk encryption branch is merged, a release image finishes setup with local sign-in only, and says so in its log.

**Backup.** `[online_backup]` writes a gzip file to `/var/lib/kanidm/backups` every day and keeps 7. `kanidmd database
restore`, with the service stopped, brought back a deleted person, their password and the signing keys. Restore goes
by the file's name: a gzip file not named `.gz` fails with a JSON error. Back up `server.toml` too. It must be restored
into the same Kanidm version.

**Upgrades.** `kanidm-upgrade --from-bin OLD --to-bin NEW` moves one minor version and refuses anything else. It stops
the service, backs up, starts the new version, and if that will not come up it puts the same files back and runs the old
version again. A machine further behind runs it once per minor. Kanidm releases a minor every quarter and supports each
for 4 months, so a machine that misses two needs the binaries in between: `build-kanidm.sh --version` builds them.

**Published crashes.** The deeply nested SCIM filter and LDAP filter were fired at 1.12.0 directly on loopback, unauthenticated
(`tests/kanidm-attacks.py`), and it stayed up. Both are fixed upstream: 1.12.0 contains commit `8b9f733706` for SCIM, and
`d092e62e72` for the upstream subject check.

**Known limits**
- **Lockout.** Kanidm counts wrong passwords per account, whoever sends them and from any address, with a wait of 1 to 10
  seconds after each up to 100. It has no setting for this. At 100 in a UTC day it locks until midnight, so we carry one patch
  (`patches/kanidm-softlock-no-day-long-lock.patch`): from 100 the wait is one minute, doubling every 25 wrong passwords to
  at most 15 minutes. A day then allows about 270 guesses per account (about 200 in the first six and a half hours, then
  one per 15 minutes), against 8,640 with the earlier fixed 10 seconds. The password check is not touched.
  **The trade, stated plainly:** a stranger who keeps guessing once every 15 minutes keeps that person waiting up to 15
  minutes at a time, for as long as they keep it up, from any address. Nothing stops both guessing and that; restarting
  Kanidm clears the count, and IT can give the person a new username. The front also limits one address on each sign-in
  path (`limits` in `front.toml`): 30 at once, regaining 15 a minute. The screen counts as one address, 127.0.0.1. A limit
  per username at the front was considered and not built: Kanidm's own count is already per username across addresses,
  so a second one would only make the same wait sooner.
- **Open:** the sign-in page says "Invalid username" for a name that does not exist, so usernames can be listed. Neither
  its config nor our CSS can change this, because the next page differs, not only the words. It has no limit by address
  either; the firewall's 50 connections a second is the only ceiling.
- **On the machine's own screen, a hardware key does not work.** The Identity tile opens Kanidm's pages (the shell allows
  its one exact origin, and first boot adds its certificate to what the screen trusts), but WebKitGTK has no WebAuthn:
  `navigator.credentials` and `PublicKeyCredential` are undefined there (`tests/webauthn-probe.html`). Staff sign in with a password, so this does
  not stop them. The screen keeps Add Passkey in view, by the owner's decision that keys are core, and says under it to use a browser on a computer or phone; its sign-in page hides the Passkey choice, with the same line. A browser on another device needs that name published and this
  machine's certificate installed; neither is arranged yet.
- A debug image has a marked account for tests, `debug.test`, whose password is in `os/debug/kanidm-debug-account` and meets the same rule.
  A release image has neither the account nor the script.
- Kanidm does not take sign-ins from an upstream directory in this image; that route is closed at the front. A hospital
  with Entra or Okta points MedBrains' own SSO settings at it instead (`tests/sso-entra-fixture.py`, a fixture of Entra's
  shape). **Real Entra and Okta are unverified, and need an account from the owner.** MedBrains' SAML sign-in is not
  built: the settings accept a SAML provider and the sign-in refuses it. Over 200 groups, Entra sends none, so that person
  gets least privilege, not their role.
- Ten advisories were published between April and August 2026, one critical; no third-party audit could be found, and
  the project is run by volunteers, mostly one person. Against 1.12.0 (checked 2026-11-07, `gh api
  repos/kanidm/kanidm/security-advisories`): **fixed** in the tree we build: the SCIM filter overflow (2pm5, high; the depth check
  now runs before the recursion, `proto/src/scim_v1/mod.rs`), the nested LDAP filter (qcrp, high; `ldap3_lber` 0.9 bounds
  depth at 128), the set-modification DB write (xxwr, critical, fixed from 1.10.2), passkey-partial HTML injection (gpxg),
  client-secret timing (53hj), SCIM stack exhaustion (r5fr), image validators before authorisation (84jc). **Not applicable,
  and fixed anyway:** RADIUS module logging secrets (j4gj; no RADIUS, `/ui/radius*` closed) and the upstream-login subject check
  (x8cg; upstream login unused, its landing closed). **Accepted limit, low:** the OAuch scan (hh34): the referrer policy is
  `origin` not `no-referrer`, and a short PKCE verifier is probably accepted; `frame-ancestors 'none'` is set (measured), and our
  client sends a 48-byte verifier. The two highs with no patched version listed were fired at the image: kanidmd stayed up
  (`tests/kanidm-attacks.py`, SCIM to depth 30,000 answered 400 or 414, LDAP to depth 50,000), and LDAP and SCIM stay closed
  to the network: LDAP has no listener, kanidmd binds 127.0.0.1 with `IPAddressAllow=localhost`, and the front refuses `/scim/*`.

**When Kanidm stops** (T3.2, `tests/kanidm-outage-test.py`). Killed with SIGKILL, systemd starts it again in about 6 seconds
(`Restart=on-failure`, at most 5 times in 10 minutes). Staff already signed in keep working throughout: MedBrains' own session
does not ask Kanidm again until it is renewed. A new sign-in through Kanidm goes back to MedBrains' sign-in page, which says
"The sign-in service is not answering…" with what to do; calls to Kanidm give up after 10 seconds instead of hanging. While it is
down only the first administrator can sign in, by MedBrains' local form.

**The break-glass: the setup administrator's password.** An account linked to Kanidm signs in through Kanidm only. Linking it
(`set_link`) keeps its local password, but only for step-up inside a session (signing a record): MedBrains' password form
refuses any account with a Kanidm link, saying to use "Sign in with MedBrains account", and says so only once the password
is proven, so a guess does not learn which accounts are linked. A leaver disabled in Kanidm therefore cannot get a session;
the leftover password opens none. One account is the exception: the
setup administrator, the hospital's first account, made by the seed from the password typed at setup (`start_main_machine`
hashes it; the seed stores the hash) and still a `super_admin` (`SETUP_ADMIN_SQL` in `medbrains-server-core/src/os_identity.rs`).
It keeps that password beside its link, so a Kanidm outage cannot lock the hospital out. Each use is audited as
`break_glass_password_login`, not `login`, so every one is found by one action; it still needs its MFA code when MFA is on.
Relinking it keeps the password; changing its role away from `super_admin` ends the exception. No setting names another
account, and the SSO-only policy (`password_login_disabled`) never blocks it.

**Administrators through Kanidm.** An administrator's account (a bypass role, or any `admin.*` power) links only to a Kanidm
person in `mb_it_admins`, and signs in through Kanidm only while that person is still in it, read from the token's groups or
the directory at every sign-in; when the directory cannot be read, the sign-in stops and says so. Only an administrator (a
bypass role) links or unlinks an account, or creates or deletes a directory-group mapping, and mappings never grant an
administrator role.

**Emergency sign-in, designed and not built** (for an independent review before any of it ships; revised after the first review).
The problem: Kanidm is down for longer than a shift change, and a nurse who was not signed in must chart. The design:
- **Turned on by people, never by an outage alone.** An outage could be caused from the LAN (flooding the front, or anything that
  makes the server's check fail), so a failed check only offers IT the switch. IT turns emergency sign-in on from a signed-in
  session, or a second named person approves it. The server confirms the outage itself by asking Kanidm directly on loopback
  (`127.0.0.1:8444`), never through the front, so a flood on 9443 cannot fake one. It turns off by itself when that answers again.
- **A named person, not a shared account.** IT names a few people per ward in advance (a new permission, defined in Rust first). Each
  gets single-use codes, shown once when made, stored as argon2 hashes, kept in a register: who holds which code, when it was made,
  used and revoked. Every unused code of a person is revoked when their emergency session ends.
- **Capped.** At most one emergency session per person per day, and at most 4 hours each, not renewable; when Kanidm is back the
  session ends after 15 minutes' grace.
- **Narrow.** The person's own role, minus anything administrative: no user, role, permission or export change.
- **Audited and flagged.** Start, end and every write carry an emergency mark in the audit log; IT is told at once through the existing
  break-glass notice; every screen shows "Emergency sign-in, ends at HH:MM"; each session becomes a review item afterwards
  (`audit.break_glass.review`).
- **Slowed, not locked.** Wrong codes for a name get a time-boxed backoff that doubles to at most 15 minutes, never a lockout,
  because a lockout during an outage is the harm this exists to prevent. The front's per-address limit applies as well.
Open for the reviewer: whether a code or a second person's approval should be the proof at sign-in itself, not only at switch-on.

**Who is linked to which MedBrains account.** A provider's verified email finds an existing account only when its
`link_by_email` is on (migration 1406, Admin → Single sign-on), and it is off by default and for the OS's own Kanidm: anyone who
may make a Kanidm person can give it any address, and Kanidm calls every primary address verified. Whatever it says, an email
never claims a `super_admin` or `hospital_admin` account. The first administrator is linked at setup by its Kanidm UUID
(`kanidm-first-admin` records it; `kanidm-setup` links it). **Existing staff are linked by hand:** Admin → Users → Link to
sign-in, by an administrator: the server requires a bypass role as well as `admin.users.link_identity`, whatever a role or
override grants, because whoever controls the Kanidm person controls the account. An administrator's account (a bypass role or any `admin.*` power) links, whoever links it, only to a Kanidm person in
`mb_it_admins`, the group that must use a second step, as the directory's `memberof` says; a directory that does not answer,
or does not show `memberof`, refuses. It searches Kanidm's people by name, display name or mail through a read-only directory account
(`mb_directory`, in `idm_account_mail_read`, its token readable by the server alone), always on Kanidm's loopback listener
(`https://idm.medbrains.local:8444`, pinned in the server, never read from the provider row), shows each person's UUID and any account
already linked to them, and links or unlinks, audited as `sso_link` and `sso_unlink`. A new account from a sign-in is named after
the Kanidm name; if that name is reserved (`admin`, `root`, and those with digits after them) or an account already has it, no
account is made and the sign-in page says to ask IT to link it, so no look-alike grows beside an existing account. The new-staff
notice names the Kanidm person and its UUID.

**The Kanidm provider row is the OS's.** `kanidm-setup` writes the `kanidm` row in `identity_providers`; the admin API refuses to
create, change or delete it (Admin → Single sign-on shows it as set up by the OS). Sign-in through it ignores the row's discovery
URL, client and secret: the server reads discovery on loopback, holds the issuer to `https://idm.medbrains.local:9443/oauth2/openid/medbrains`
and the client to `medbrains`, and makes its token and key calls on loopback too. It trusts Kanidm's own certificate for that,
which `front-certs` adds to the server's trust file (`idp-front.pem`). Other providers are added, changed and removed with
`admin.sso.providers.manage`, by administrators only: the server requires a bypass role as well.

**Signing out.** Every sign-in through the OS's Kanidm asks for a fresh login (`prompt=login`), on the screen and in
browsers. On the screen, when the MedBrains view comes back to its sign-in page it forgets every cookie, Kanidm's session among
them, so the next person is asked to sign in. Kanidm 1.12 has no way for MedBrains to end its session (no OIDC end-session), so
on a shared computer's browser the next person is asked to re-enter the previous person's password, and cannot pass; they use
Kanidm's own Sign out first. Kanidm's session on the server expires on its own.

**A passkey while the password is slowed.** Kanidm counts wrong guesses per credential, so a stranger slowing someone's password
does not touch their passkey: it still signs in at once (tested, `tests/kanidm-passkey-lock.js`). A one-time code is part of the
password credential and is slowed with it. A crash or restart of Kanidm clears every count, because they are kept in memory.

**What the LAN reaches on 9443.** Only `/ui`, `/pkg`, `/oauth2`, `/v1/auth`, `/v1/reauth` and `/status` (`lan_paths` in
`front.toml`); the rest of `/v1`, raw and admin among it, answers 404 except to this machine. The port takes 128 connections,
16 per address, and keeps 32 for this machine (`reserved_for_machine`): the screen and the server's own calls to Kanidm.
Kanidm restarts however it ends, at most 30 times an hour; past that it fails, and the screen's health card names it. Its
certificate on 9443 is signed by this machine's name-constrained authority, so a LAN browser that trusts the authority trusts
the port. The screen signs in on its own name, `screen.medbrains.local`, which only this machine resolves.

**Memory, signed in on the screen** (`tests/memory-split.sh`, PSS from smaps, QEMU arm64 with 4 GB, one sample each,
2026-11-07; MedBrains open and signed in through Kanidm). With `GSK_RENDERER=cairo`, the image's setting: 1,194 MB across
all processes. WebKit's page processes 428 (the MedBrains page 222, of which 165 is anonymous memory, where the JavaScript
heap, DOM, decoded images and caches all live and smaps cannot tell them apart, 46 the engine's code, 9 malloc, 6 drawing
buffers; four idle page processes 40 to 76 each), the server 210, Postgres 192, the shell 125, the compositor 81, WebKit's
network process 41, kanidmd 36, the front 9. With `ngl`: 1,375 MB; the shell grows to 272, because without a GPU Mesa draws
in software, and everything else moves by under 20. Cairo stays.

**Kanidm's look.** Every page Kanidm draws (sign-in, password change, people, groups, both themes) is dressed through the one
stylesheet it loads after its own, so its templates are not patched. `kanidm-tokens.py` prints the design system's `--mb-*` tokens
for its light and dark themes from `packages/design-system`, and the build refuses tokens that miss WCAG 2.2 AA; `kanidm-override.css`
uses only those, with square corners, bottom-rule fields, IBM Plex from the web app and a 2px focus outline.

## Linux hardening

Task T1.1, all with settings Linux already has, adopted from Kicksecure's
[security-misc](https://github.com/Kicksecure/security-misc) (Debian-based, read at commit `9535bf8`) and the CIS
Debian benchmark where they fit an appliance. Every entry carries a one-line reason in its file:

- **Kernel command line** (`mkosi.conf`, `mkosi.conf.d/x86-64.conf`): `lockdown=confidentiality` (not even root reads
  kernel memory or loads unsigned kernel code), `module.sig_enforce=1`, `init_on_alloc=1 init_on_free=1`, `slab_nomerge`,
  `page_alloc.shuffle=1`, `randomize_kstack_offset=on`, `kfence.sample_interval=100`, `debugfs=off`,
  `efi_pstore.pstore_disable=1`, `proc_mem.force_override=ptrace`, `random.trust_cpu=off random.trust_bootloader=off`,
  strict IOMMU, and `systemd.getty_auto=no`. On x86-64 also `vsyscall=none ia32_emulation=0 iommu=force erst_disable tsx=off`.
- **sysctls** (`/etc/sysctl.d/90-medbrains.conf`): kernel pointers, dmesg, perf, BPF, kexec, ptrace, SysRq,
  userfaultfd, TIOCSTI and core dumps closed; protected links, FIFOs and files; an end host's network settings
  (no redirects, forwarding, source routes or kernel router advertisements; reverse-path filter; martians logged).
- **Kernel modules** (`/etc/modprobe.d/medbrains-blocklist.conf`): rare protocols, CAN, unused and network file
  systems, FireWire and Thunderbolt (DMA, X6), Bluetooth (OS-THREATS H16), RNDIS, GNSS, floppy and CD.
- **systemd sandboxing** on every MedBrains unit, measured with `systemd-analyze security` (below) and held under
  a per-unit ceiling in `crates/medbrains-os-test/budgets.json`.
- **No login anywhere** (X6): no SSH server; every getty, serial getty, autovt, container getty and
  `debug-shell.service` masked; root and the database account have no login; plain banners. A debug image keeps its own root shell on the serial port.

**What we did not take from Kicksecure, and why:**

| Setting | Why not |
|---|---|
| `mitigations=auto,nosmt` and the per-flaw `=force` flags | `nosmt` halves the CPUs of a hospital's only server; it runs only our signed code, no tenants or guest VMs. Debian's `mitigations=auto` stays. `tsx=off` is taken: it costs nothing |
| `slab_debug=FZ` | Debug checks on every allocation cost measurable speed; `init_on_free`, `slab_nomerge` and KFENCE cover most of it |
| `kernel.unprivileged_userns_clone=0`, `user.max_user_namespaces=0` | WebKit's sandbox (bubblewrap) needs user namespaces; without them the web view runs unsandboxed, a bigger hole |
| `kernel.yama.ptrace_scope=3` | Setup reads which program opened its socket, which needs `CAP_SYS_PTRACE`; 2 still refuses every other trace |
| `kernel.io_uring_disabled=2` | We use 1 with a group (977) so a service can be allowed it where it measurably helps; none is today |
| `net.ipv4.icmp_echo_ignore_all=1` | IT staff find the machine with ping; broadcast pings are still ignored |
| `net.ipv4.tcp_timestamps=0` | Hurts throughput and PAWS on busy links; the uptime it leaks is not secret on a LAN appliance |
| `net.ipv4.conf.*.arp_ignore=2` | Ignores conflict probes sent from 0.0.0.0, so another device could take this machine's address unseen; 1 is used |
| `kernel.panic=-1`, `oops=panic` | `panic=10` restarts a dead kernel so a bad update uses up its boot tries (U1) |
| `usb-storage` off | USB sticks carry signed updates (OS-UPDATES.md); they mount read-only, `noexec,nosuid,nodev` |

**Units whose score stays high, and why.** The disk units (`medbrains-disk-*`) run before `/var` exists, create
the data partition, load `dm-crypt`, talk to the TPM and ask a person for keys on tty1. They keep systemd's
defaults: with a sandbox, the recovery message after a power cut during PIN setup never appeared (TPM test on
x86-64), so it was reverted. The updater (`medbrains-os-update@`, `medbrains-update-*`)
writes a whole system partition and the boot partition and mounts the other slot or a USB stick. A read-only
system, a device list or a capability limit would break the job, and a broken updater cannot be fixed by an
update. They get every setting that cannot get in the way. `cage-console` keeps the gaps WebKit's own sandbox needs
(see its unit). All are still below their ceiling, which a test enforces.

### AppArmor

AppArmor is the kernel's active security module, and each MedBrains service runs under its own profile in
enforce mode (`/etc/apparmor.d/`): `medbrains-server`, `medbrains-front`, `medbrains-agent`, `medbrains-os-setup`,
`kanidmd` and `medbrains-postgres`. Each profile lists what its service reads and writes and the programs it may
run; none may run a program from `/tmp`, `/var` or a USB stick. Setup is root, so its profile is the wall
that matters: it reads the system but writes only its unit's paths. Debian's own `chronyd` profile gets a
local rule for the folder our time sources live in. The suite checks each service's label and that AppArmor
refused nothing during the run.

Not profiled, and why: the updater (it writes whole partitions; a path list cannot narrow that, its bundles are
signed instead), the screen (`cage`, the shell and WebKit, whose own bubblewrap sandbox would need a profile
per helper; systemd confines the unit), and the short root scripts (`firstboot`, `db-init`, `disk-setup`),
which systemd sandboxes.

### Hardening report

`os/tests/cis-check.sh` checks a running machine against the CIS Debian Linux Level 2 (Server) benchmark,
numbered as in CIS Debian Linux 12 v1.1.0, and prints PASS, FAIL or LIMIT per check. Debug images carry it as
`/usr/lib/medbrains/cis-check`; `medbrains-os-test` runs it, saves the report (`MB_OS_TEST_CIS_REPORT`, or
`cis-report.txt` in the temporary folder) and fails on any FAIL. It is not a certified CIS-CAT run.

**Why not OpenSCAP:** Debian's `ssg-debian` (0.1.76 in trixie) has no CIS profile, only ANSSI and "standard",
and targets Debian 11 and 12, so every rule reads "not applicable" on trixie.

**Accepted limits** (each a LIMIT line in the report):

| Benchmark | Limit and reason |
|---|---|
| 1.1.1.9 usb-storage off | USB sticks carry signed updates; they mount read-only, `noexec,nosuid,nodev` |
| 1.1.2.3, 1.1.2.5 to 1.1.2.7 separate `/home`, `/var/tmp`, `/var/log`, `/var/log/audit` | One encrypted data partition by design (§8k); nobody has a home; journald's size limits keep logs bounded |
| 1.2 apt repositories and keys | The image has no apt sources: software changes only through signed A/B bundles |
| 2.1.20 no web server | The MedBrains front is the product, and the only listener a stranger reaches |
| 3.1.2 wireless off | Some wards connect over Wi-Fi; iwd starts only when a card exists |
| 5.2.1 sudo installed | Nobody logs in; services drop privilege through systemd |
| 5.3, 5.4.1, 5.4.3 password quality, ageing, shell timeout | No account here has a usable password or a shell; staff sign in through Kanidm, with its own strength check and lockout |
| 6.1 AIDE | The root partition becomes dm-verity sealed (T1, separate work): a changed file stops the boot |
| 6.3 auditd and its syscall rules | Each audited syscall is a flash write nobody on site reads; who opened which record is MedBrains' own audit log, and AppArmor denials reach the journal |

### What the hardening costs

Measured on the same QEMU machine (arm64, 4 vCPUs, 4 GB, debug image), main before this work (one run)
against main with T1.1, AppArmor and the support console (two runs):

| | Before | After |
|---|---|---|
| Boot to running (`systemd-analyze time`) | 32.6 s (kernel 0.40 s, user space 24.8 s) | 35.0 s and 32.2 s (kernel 0.50 to 0.58 s, user space 27.2 and 24.3 s) |
| Whole machine used at rest | 774 MB | 831 MB and 814 MB (budget 850) |
| System disk used | 1,288 MB | 1,291 MB (budget 1,300) |
| Server after a page load | 221 MB | 230 MB |
| A crashed screen back | 3 s of black | under 0.7 s |

The two runs after differ as much as before and after do, so the boot cost is within run-to-run noise here;
the memory difference (40 to 57 MB) is likely real and not yet attributed. More runs would settle both.

### Support console

Release images have no login anywhere, so a machine that does not finish starting explains itself on tty2:
**Ctrl+Alt+F2** shows `boot-health` (issue #5383), what is still starting, the slowest steps of this boot,
and for each failed service a reason in hospital words ("Database did not start") with its unit name underneath
and its last 10 log lines. It only shows: no keyboard input reaches it and it runs no shell; every read is
bounded. **Ctrl+Alt+F1** goes back. When something has failed, the desktop's sentence ends "Press Ctrl+Alt+F2
for details". `cage -s` allows the switch; the other consoles are empty. Accepted: anyone at the screen can read
a failed service's last log lines, which can include user names, never a database value (the database log holds
none, see above).

## Apps on the desktop

A tile exists only if `/usr/share/medbrains/apps/<id>.json` does and fits this machine's role. A missing,
damaged or refused file loses its own tile, logged in the journal, and nothing else.

```json
{ "id": "medbrains", "name": "MedBrains", "icon": "/usr/share/medbrains/shell/logo.svg",
  "url": "https://127.0.0.1:8443/", "role": "main", "unit": "medbrains-server.service",
  "health": "http://127.0.0.1:3000/api/health", "accent": true }
```

| Field | Required | Rule |
|---|---|---|
| `id` | yes | Lowercase letters, digits, dashes; must match the file name |
| `name` | yes | Up to 40 characters |
| `icon` | yes | A theme icon's name, or a file under `/usr/share/medbrains/` |
| `url` | yes, except Settings | `https://127.0.0.1[:port]/…`. Anything else is refused |
| `role` | yes | `main` or `any` |
| `unit` | no | Its tile says so when this isn't running |
| `health` | no | `http://127.0.0.1:port/path`, asked before opening. Without it, opening waits for `unit` |
| `accent` | no | Draws the tile in the brand colour |

Each app gets its own WebKit view and ephemeral session, so apps cannot read each other's storage. Its
navigation limit is built from its own URL's origin plus WebSockets to the same host, and is default deny. A view costs about 400 MB, so it is
made only when first opened, and stays until a restart.

## High-density screens

`cage` has no scale option, but it speaks wlr-output-management, so the shell asks `wlr-randr` for one at
start: 2 at 180 PPI or more, 1.5 at 140 or more, and 2 for a width of 2880 or more when the screen reports no
size. Scale never leaves less than 1280 logical pixels, so 1366x768 and 1280x800 stay at 1. Under UTM the
softness came from the host upscaling a 1920x1200 guest on a Retina Mac, which nothing in the guest can fix;
`utm-run.sh` gives the guest 2880x1800 real pixels instead.

## Joining a machine

**What a person does** (OS-SETUP-AND-TRUST §8): on the new machine, choose "Connecting to my hospital", give
it a name and a type (workstation or display), and pick the main machine from the list, or type its address.
The screen shows six digits. On the main machine, in MedBrains, **Admin > Machines** lists the machine, and
Approve asks for those digits. It then shows six other digits, which the person types on the new machine.
Each side has proved itself to a person, and only then does the machine join.

**What a node is:** `medbrains-node.target`, with the screen, the agent and the setup service. No PostgreSQL,
server or front, and no secrets but its own key. Its endpoint answers no protocol and its firewall opens no
service. `medbrains-agent` listens on `127.0.0.1:8443`, the address the screen already loads, and carries each
connection over iroh to the main machine's loopback front end. TLS ends at the main machine, so the agent
cannot read what it carries, and the screen's one trusted certificate is the main machine's, delivered on approval.

| Rule | How |
|---|---|
| A key alone grants nothing | Anyone may speak the join protocol, which only files a request. A tunnel needs a live key on the roster, decided by `medbrains-edge`'s `admit` |
| A fake main machine is caught | Anyone can answer "approved", so that alone is believed by nothing. The node saves no certificate and opens no tunnel until a person types the second code from the hospital's own Machines screen. Both codes cover both keys and a nonce from each side, the node committing to its nonce first, so neither can be steered; keys alone fall to about a second of grinding |
| Approval cannot be clicked through | The code is on the machine's own screen only, never in the list. The server compares what a person typed. Three wrong codes refuse the request on the main machine, and three wrong second codes throw the join away on the node; each is said plainly, and the main machine's are audited |
| Requests run out | 10 minutes |
| A stranger cannot stop a machine joining | The list never refuses. One address holds at most 3 waiting (its oldest goes first) and 3 conversations, and starts at most 10 a minute. At 20 waiting, the most crowded address gives way, oldest first, so a real machine's one request goes only when more than 20 addresses are flooding. Machines shows what was pushed out, from which address, and a machine pushed out is told to ask again. mDNS noise cannot push out an address a person typed |
| Time | A node's chrony asks the main machine's chrony, over iroh, so the key authenticates it and removal ends it. A main machine with only its own clock answers stratum 10, and both machines then say "Time not confirmed" on the top bar |
| Guessing a code | Six digits are one in a million per try, but tries repeat: someone holding a node on one code can start handshakes with the real main machine and leave quietly on a miss. Those are counted across all addresses, and Machines warns about them. At 60 in ten minutes joining pauses and Machines says so, keeping a guesser near six in a hundred thousand. A win admits only the guesser's key, since the second code still protects the node. An approval whose machine never connects ends after an hour |
| Flood at the door | Each new connection must prove its address, then gets a place: at most 16 per address, 120 a minute, 128 in all. Past that it is refused before any handshake work, so machines already connected keep their service |
| Tenant | From the hospital this box serves, through admission. The join frames have no such field and refuse unknown ones |
| Removal | The key leaves the roster at once; the agent asks every 2 seconds and closes that machine's open connection. If the server stops answering for 30 s the agent can't know who was removed, so it closes every session and admits nobody until it hears again, as a fault and not a refusal |
| One way onto the roster | The roster holds only keys from a claimed join request, so device-management rights can't add one |
| Telling machines apart | Each machine's connections reach the front end from its own `127.x.y.z`, derived from its key. So sign-in limits are per machine, the audit log records that address, and Machines shows which machine holds it |
| No outside party | No relay, no outside lookup, no UPnP (`portmapper_config` is off; iroh's default would ask the router for a port) |

Approved machines are `paired_devices` rows with `device_node_keys` rows, and requests are
`device_pairing_requests` rows, so there are no new tables (migration 1405 adds five columns). The server
never touches iroh: `medbrains-agent --main` asks it over loopback, with a token in a file only the agent reads.

**Measured** (two debug-image VMs in QEMU on one Mac, 4 vCPUs and 4 GB each, one run; `tests/two-machines.sh`,
a socket netdev that carries multicast. No hardware):

| | Node | Main machine |
|---|---|---|
| Whole machine used, desktop after a reboot (`MemTotal - MemAvailable`) | **300 MB** | 518 MB |
| The same, signed in, app open | 732 MB | 2,763 MB, of which most is the server after sign-ins |
| Agent, PSS | 13 MB | 15 MB |
| `/var` used | 31 MB | 229 MB |
| Listening beyond loopback | UDP 5353 and the agent's two outbound sockets, which the firewall does not open | 80, 443, 123, 5353, 7844, 7845 |

The agent binary is 16.3 MB stripped. By symbol size, iroh, its QUIC and networking are about 3.6 MB and crypto
about 1.9 MB, so iroh costs about 5.5 MB; this is approximate, because generic code is attributed to its caller.

From clicking the main machine to the tunnel answering: 17 s, including a browser robot signing in and typing the
code. A person walking across a building is the slow part. Removal ended access 1 to 2 s after the database recorded
it, with both clocks in step; the agent asks every 2 s, so this can reach about 2 s. With the agent's sync broken on
purpose first, access still ended, 30 s after the sync broke (19 s after the removal), and stayed ended when the sync
came back.

Flooding the main machine with 1,200 connections from one address: 120 got through the door in the minute, the rest
were refused. The agent peaked at 17 MB PSS with no restart, and a node's probes answered 88 of 88 throughout. A flood
from many addresses, and real guessing through to the pause, were tested in-process only. As another user, or even
root, connecting to the front end from a machine's `127.x.y.z` is refused; only the agent may.

Seven wrong sign-ins from a node answered `401` five times and then `429`, while the main machine's own screen kept
getting `401`; the audit log records the node's own address, `127.148.222.63`, which Machines shows for that machine.

**A main machine whose address changes** (changed through the setup service, since the wire has no DHCP server):

| Case | Result |
|---|---|
| Node signed in, mDNS working | Back with no action after 6 to 15 s (36 s before the idle timeout was shortened). The top bar says "Cannot reach the main machine" from its next poll, within about 10 s, and the signed-in page stays |
| Saved address stale, agent restarted, mDNS working | Back within about 1 s |
| Saved address stale, agent restarted, mDNS blocked by the firewall | Stays down and says so, for as long as it lasts |
| The same, with the new address typed in Settings > Main machine | Back about 1 s after pressing the button; a wrong address says "Nothing answered at that address" |

Discovery worked over the virtual wire on a LAN with no gateway, once two things were fixed: multicast needs a
route (`80-wired.network` and the fixed-address file add one), and the discovery library joins its group once, so
mDNS restarts when the machine's addresses change. **It has not been tried on a real hospital network**, where
multicast may be blocked; that is why the typed address exists, and it was proved with mDNS blocked by the firewall.

**Node pairing is class A** (`docs/OS-PRINCIPLES.md` §7). Its failure table:

| What fails | Effect | How we know | What the machine does |
|---|---|---|---|
| Fake main machine answers | Node would send its screen and passwords there | It says "approved", but the real Machines screen has no digits for this machine, or different ones | The node trusts nothing until the second code matches; three wrong throws the join away |
| Flood of requests | A real request could be crowded out | Machines lists what went | Per-address limits; the oldest goes; the machine pushed out is told to ask again |
| Server down during a join | Request cannot be filed | The node shows it could not reach the main machine | Grants nothing; a person asks again |
| Power cut after approval, before the role is written | Setup not finished | Agent has the approval on disk | Asking again finishes without a new request |
| Main machine unreachable | Node cannot work | "Cannot reach the main machine" on the top bar, over the app too | No offline path; the connection is dialled again when the screen next asks |
| Main machine's address changes | The saved address is dead | An idle path is noticed within 8 s | Dials by key; mDNS says where that key is now, and the saved address is only a first guess |
| Server stops answering the agent | A removal cannot be heard | Agent logs it, the screen says it cannot reach the main machine | After 30 s closes every session and admits nobody, as a fault |
| A crash during first start | Some of its files are missing | Each file is checked by itself on the next start | Rebuilt from what exists, including the agent's token from the env |
| Something else holds the clock's port | It could set this machine's clock | The bind fails, and the port is below 1024 anyway | The agent stops and systemd restarts it; the screen says time is not confirmed |
| The record of what it joined is damaged | It cannot tell where its main machine is | The agent reads it at start, as a fault and not as "never joined" | Stops, and the screen says it can't reach the agent, rather than offering to join again |
| Node has no time source | Certificates and audit at risk | "Time not confirmed" on the top bar | Keeps working, and says so |
| Node key file readable by others | It may have been copied | The agent checks its mode at start | Refuses to start |

**Requirements and the tests that prove them:** a fake main machine gets nothing, `a_fake_main_machine_gets_nothing_without_the_second_code`; removal cannot fail open, `a_silent_server_ends_every_session_and_admits_nobody`; strangers cost little, `strangers_cause_at_most_one_sync_a_second`; one way onto the roster, `a_machine_key_cannot_be_registered_around_approval`; a key alone grants nothing, `an_unapproved_key_is_refused_a_tunnel`; tenant from admission,
`the_tenant_comes_from_admission_never_from_a_claim`; codes, `code::tests`; a stranger cannot block a join, `one_address_flooding_cannot_block_or_push_out_another`
and `one_address_cannot_take_the_places_of_others`; duties separate, `each_duty_needs_its_own_permission`; removal, `an_approved_key_reaches_the_front_end_and_removal_ends_it_at_once`.

**Limits:**
- The machine key is a file (mode 0600), not in a TPM, until SEC3. Anyone who can read the data partition can
  copy it. Removing the machine ends the copy too.
- A display gets the same desktop as a workstation; the board is not built, nor is the §8a place or swap flow.
- Someone using more than 20 addresses on the LAN at once can still push out a real request. The machine says so and can ask again, and Machines shows every address. The full answer is at the network (N4).
- A guesser can pause joining for ten minutes at a time while it keeps going. That is a choice: a hospital briefly unable to add a machine, with the screen saying why, over a stranger's guesses running on.
- **The tenant IP allowlist** (`allowed_ips`) sees a machine's `127.x.y.z`, not its LAN address, so with an allowlist set, anyone but an administrator on a node or on the main machine's own screen is refused. Add `127.0.0.0/8`, or each machine's address from Machines to allow only that one. It is left as a setting on purpose: an automatic exception would quietly widen a rule someone set to narrow access.
- With the sign-in limit per machine, a person guessing from a node is held by the account lockout, as before, and by that machine's own limit, not everyone's.
- Machines behind one NAT share one address, so a fourth waiting at once pushes out the first.
- The node's time is as good as chrony's estimate over the iroh path. Measure on real hardware before relying on it for anything finer than certificates and audit.
- A node that cannot reach the main machine cannot work: there is no offline path (OS-EDGE-NODES).
- mDNS uses one network interface, the one with the best multicast route. A machine on two LANs finds main
  machines on that one only.
- On a network that blocks multicast, a node cannot follow a main machine whose address changes by itself. **Settings > Main machine** takes the new address, and only if the key it joined still answers there; anything else is refused, and the saved address stays.
- A node stays passively listening on mDNS after joining, so it can find a main machine whose address changed.

## How the screen works

- `cage` is the Wayland kiosk compositor. `medbrains-shell` (Rust, GTK 4, no libadwaita) runs inside it as
  the unprivileged `kiosk` user, in one full-screen window. If it crashes, `cage` ends and the unit restarts.
- The shell asks `medbrains-os-setup` once at start whether the machine is set up, and every 10 seconds for
  the desktop's figures and each app's unit state. That poll stays on the machine. Only the network screen, and only while it is on
  screen, pings the gateway and makes one request to the internet.
- WebKitGTK is loaded only when MedBrains is first opened, so the desktop does not pay for it.

**Its look comes from the design system.** `src/style.css` holds layout, shape and motion only: Carbon's sharp
corners, the 8px grid, 48px controls, a 2px focus ring and transitions of at most 240 ms, all off when Settings
asks for reduced motion. Every colour is a `@mb_*` name from `src/theme-light.css` and `src/theme-dark.css`,
which `os/shell-tokens.py` writes from the web app's generated colours (`colors.generated.ts`), along with the
crab mascot in `assets/crab.svg`. Change a colour in the design system, run `os/shell-tokens.py`, commit both.
`os/shell-tokens.py --check` (`make check-shell-theme`, and the image build) fails if the files have drifted or if
any text pair the stylesheet draws falls below WCAG 2.2 AA in either scheme. Fonts are IBM Plex Sans and Mono and
Archivo Expanded SemiBold, a static instance (width 125, weight 600) of the web app's Archivo variable font, all
under the SIL Open Font License (`fonts/OFL.txt`, `fonts/OFL-Archivo.txt`).

**Staying on this machine.** MedBrains loads from `https://127.0.0.1:8443`, a loopback-only front end with a
self-signed certificate, the only certificate the kiosk trusts, so there is no warning. There is no address
bar. Each app's content filter blocks everything except its origin, `blob:` and `data:`; if it cannot be
compiled, the app does not open at all. Navigation off the machine is
refused before the filter, so a person stays where they were, and new windows are refused. `cage` blocks
switching to another console. Nothing on the screen runs a shell.

**What a session keeps.** The view's session is ephemeral: nothing a page stores reaches the disk, and a
restart signs you out.

**No terminal on staff machines (owner's decision).** Release images have no terminal program, no debug shell, a
locked root account and no shell on the serial port. Tried on the release image's screen, in setup, on the desktop and
in the app: Ctrl+Shift+I and D (GTK's inspector, turned off in code), Ctrl+Shift+C, F12, Ctrl+Alt+F3, Ctrl+Alt+T.
None opens anything. Ctrl+Alt+F2 opens the [support console](#support-console), which only shows. The app's right-click menu has Back, Forward, Stop and Reload, with no Inspect.

**Limits we chose or could not avoid:**
- **`cage` does not show a second window.** A dialog window stayed invisible and its modal grab blocked all
  input, so the power question lives inside its menu, and the file chooser is refused. **Uploads, downloads
  and printing do not work on this screen.** The anatomy model's CDN stays blocked too.
- **No lock or switch person.** Anyone at the screen can use a signed-in session until a restart.
- **A page keeps the time zone it opened with** until a restart, if the zone is changed later in Settings.
- **If the server stops** while MedBrains is open, the front's plain sentence shows in the view and the desktop
  names the service. The old automatic return to a status page is gone.
- **The hospital's name on the desktop** is the one given at setup; renaming it in MedBrains doesn't update it.
- **The top bar says "Time not confirmed"** in red until chrony has a real time source, including for a moment after
  every boot, and always on a network with no time server. Its time zone is UTC, with no way to change it.
- **If the server stops** while MedBrains is open, the front's plain sentence shows in the view and the health
  widget says so. The old automatic return to a status page is gone.
- A password forgotten after setup has no recovery path on the appliance (§8k, later).
- Sign-in is limited per address, and everyone at the screen is one address (`127.0.0.1`).
- Anybody on the network can lock the administrator out for 15 minutes with 5 wrong passwords.

**Web app items to fix elsewhere, not changed here:**
- The sign-in page says "For Indian hospitals" and that data "is kept in India", which is not true of
  every appliance.
- The app shows "Test cases" and asks to verify `admin@medbrains.localhost`, which cannot receive mail.

## The front

`medbrains-front` (`crates/medbrains-proxy/src/front`, Pingora) is what a stranger on the LAN can reach
without signing in. Its rules are in `/usr/lib/medbrains/front.toml`, plain and checked at start: an
unknown key stops the service rather than being ignored.

| Port | What |
|---|---|
| 80 | Redirects to HTTPS, only ever to a name of this machine or the address the request arrived on. Up to 256 connections, 32 from one address |
| 443 | The LAN, IPv4 and IPv6, up to 4,096 connections and 1,024 from one address or IPv6 /64. A loopback client other than 127.0.0.1 or ::1 is refused, so a local program cannot pass as a node |
| 127.0.0.1:8443 | The screen and node tunnels, with its own 1,024, so a LAN flood leaves the screen working. The server is told the machine's own name here, never `127.0.0.1:8443` |

The limit per address stops accidents, not attackers: a PC can claim more addresses, so the total and
the screen's own port are what hold under an attack. An IPv6 /64 counts as one address, often a whole
ward's VLAN, and a terminal server is one address for all its users, hence 1,024. A main machine
accepts no router advertisements, so nobody on the LAN can hand it more /64s. Sign-in throttling is the
server's job: the front can limit a path (`[[sites.limits]]`), and the shipped site uses none.

**Certificates.** `front-certs` runs as root before the front starts, and once a minute. `ca/` holds this
machine's own authority, made here, root only. Name constraints limit it to `.local`, `.internal`, `.lan`,
`.intranet`, `.home.arpa`, `localhost`, the host name, names in `/var/lib/medbrains/config/front-names` at first
boot, and private and unique-local addresses, so a stolen key cannot sign for any other site, even on a PC that
trusts it. `lan/` holds one certificate covering what this machine answers to within those limits. Nothing a
client sends creates a certificate: a made-up name gets the same one and a browser warning. The front restarts
when a fixed or DHCP address changes, not when `ip` lists the same ones in another order. `lan` is a link to
a versioned folder, swapped with one rename. A DHCP server cannot rename the machine (`UseHostname=no`),
and a kernel name no certificate can hold becomes `medbrains`. IPv6 addresses learned from a router advertisement are left out, because
anyone on the LAN can send one; those clients use `medbrains.local`. A bad line in `front-names` is skipped, a
failed renewal keeps the valid certificate in place, and a key that does not match its certificate is replaced.
To use a hospital root (T2), replace `ca/ca.pem` and `ca/ca.key` with a CA it signed and remove `ca/permitted`.
If no usable certificate can be made the unit fails, visibly, and nothing falls back to plain HTTP.

**What gets refused before Pingora parses it** (`head.rs`): anything two parsers could read two ways. Both
`Content-Length` and `Transfer-Encoding`, a repeated or non-numeric length, any encoding but `chunked`, a bare
LF or CR, a folded header, a second `Host`, an absolute target, an upgrade to anything but WebSocket, TRACE and
CONNECT. No browser sends these. An upgrade counts only as a GET with no body. Heads are limited to 16 KB and 10 seconds once started.

**What the server is told.** The front removes every forwarding header a client sent and sets its own, with
one address in `X-Forwarded-For`. A `Host` outside the known names becomes `medbrains.local` before the server
sees it, because the server builds links from it.

**HTTP/1.1 only.** Nothing here needs HTTP/2: a LAN has no latency to save, and it is where a proxy's worst
flaws have been. Compression is the server's job: it already speaks zstd, gzip and brotli.

**Against Caddy, measured 2026-11-05.** Same VM, same image and server; Debian's Caddy 2.6.2 with the old
Caddyfile, as root and with no sandbox. Alternating rounds on a host at load about 10.

| | `medbrains-front` | Caddy |
|---|---|---|
| Binary | 8.4 MB | 38.3 MB |
| Memory (PSS) idle / after a page / 200 held TLS connections | 6.9 / 9.6 / 11.8 MB | 39 / 46 / 52 MB |
| Each held TLS connection | 11 KB | 34 KB |
| Requests a second, reused connections | 9,900 to 12,000, about 70% of direct | 4,300 to 5,200, about 50% of direct; HTTP/1.1 only the same |
| New TLS connections a second | 819 to 1,873 | 992 to 1,282; 1,109 to 1,432 HTTP/1.1 only: no clear winner across rounds |
| A 1.09 MB file over loopback | 274 MB/s | 17 MB/s |
| Cold load of the sign-in page in Chromium, median of each round | 314, 397, 434 ms | 240, 251, 301 ms with HTTP/2; 553, 570 ms HTTP/1.1 only |
| On the wire, same file: zstd / gzip | 308 / 328 KB | 308 / 328 KB, from the server in both |

Caddy with HTTP/2 wins the cold page load by about 130 ms, because a browser opens only six HTTP/1.1
connections to a host. That is the price of HTTP/1.1 only, paid once per browser cache. Against Caddy on HTTP/1.1,
the front is faster.

Under a flood of every port at once (real unit limits; the per-address limit and firewall meter off for the
test), with 4,096 connections each holding a nearly full 15.5 KB head and 256 on port 80, the front peaked at
197 MB against `MemoryMax=512M`, and the screen's port answered in 2 to 3 ms. It keeps that memory until
restarted: bounded, not returned.

Adding a site, such as the identity provider, is a `[[sites]]` block: `upstream_tls` for a back end with its own
certificate, `only_hosts`, `block_paths` (matched after decoding, so `/%73cim/` is `/scim/`) and
`[[sites.limits]]` for a rate per address on a path. `os/tests/front-attacks.py` attacks all of it.

## Printing

**Off in D1.** When it is added, the path is `rustenberg`, MedBrains' own Gotenberg-compatible service,
not Gotenberg. rustenberg drives Chromium on the host, so a machine that prints needs Chromium, which
bears on the engine comparison below.

### What can fail during first boot

The failure table the flight rules ask for (`docs/OS-PRINCIPLES.md` section 7). "Tested" means on a QEMU VM;
"reasoned" means from the code only.

| What fails | Effect | How we notice | What the machine does next | Evidence |
|---|---|---|---|---|
| Power cut before Review | Nothing has changed but the network and time zone | Next boot has no role marker | Setup starts again; the three fields are retyped | tested for the marker; reasoned for the cut |
| Power cut while the env is written | Old env or new, whole (`write_atomically`) | Next boot reads one or the other | No marker, so setup starts again; a repeat replaces any old seed lines | unit test for the replacement; cut reasoned |
| Power cut between the env and the marker | Seed lines sit in the env, unused. They hold a hash, never the password | Next start finds seed lines and no marker | Removes them, and setup starts again | tested with the lines placed by hand |
| Power cut after the marker, before seeding finishes | Hospital and administrator are one transaction | Next boot has the marker | The server retries; the env's lines are still there | transaction in code; cut reasoned |
| The services can't be asked to start | Setup would be a dead end | `systemctl` fails | Env and marker are taken back, the screen says try again | reasoned |
| The server never answers | The seed lines stay in the env, because the server still needs them. They hold a hash, as the database would | `console-status` keeps waiting | The desktop names the failed service. The hash stays until it answers | reasoned |
| The setup service doesn't answer | No setup can start | The screen can't connect | "Starting…", then says so after 30 s, retrying | unit test for the words |
| The setup service restarts with an address waiting | Its timer is lost | Live and saved differ at start | Undoes the address at start | tested |
| A helper hangs | One request would hold the only thread | Time limit in `child.rs` | Killed; the answer says it's unknown | unit test |
| The marker can't be read | Not knowing isn't "not set up" | `try_exists` errors | Refuses setup, says restart | reasoned |
| `ip` doesn't answer | "No links" would read as no card | Service reports a fault | "Network unknown" on screen | unit test for the words |

## Disk layout (§8k)

| Partition | Size | Holds |
|---|---|---|
| EFI | 512 MB | systemd-boot, the boot file (kernel, initrd, logo) |
| root A | 2 GB | the system (`/`), ext4, named `medbrains_<version>` |
| root B | 2 GB | named `_empty` until the first update writes it (`docs/architecture/OS-UPDATES.md`) |
| data | not in the image; made at first boot, fills the disk | `/var`, encrypted: PostgreSQL, files, logs, backups, secrets |

The PostgreSQL configuration and `/etc/medbrains` are symlinks into `/var`, so reinstalling the system
partitions keeps the data. The system partition holds a copy of the image's `/var`, with no secrets in it,
to start the data partition from.

### Data disk

Task T1, disk half. Every key, what happens if it is lost or stolen, and the failure table are in
[`docs/architecture/OS-KEYS.md`](../docs/architecture/OS-KEYS.md).

| Situation | What the screen does |
|---|---|
| First boot, TPM works | Prepares the disk, shows the recovery key once, and waits until its last group is typed back. Then asks: start by itself (Enter), or a PIN at every start |
| Every later boot | Nothing, opens with no typing; or the PIN, if one was chosen |
| Disk copied to another machine, board or TPM changed, or the signed boot file changed | Asks for the recovery key, and after 20 seconds says in plain words why. `/var` stays locked and no service starts |
| First boot, no TPM | Stops. Nothing is stored until someone types `OFF` or `STORE UNENCRYPTED`. The choice is recorded in `/var/lib/medbrains/config/disk-protection`. The top bar then says "This disk is not encrypted" |

**What this protects:** a disk that has left the machine. **What it does not, without a PIN:** a stolen machine, from someone
who changes its system partition and boots it, since nothing verifies that partition. A PIN closes that today; Secure Boot and
verity are the rest of T1. Any new boot file needs a re-seal until then.

## What is in D1, and what is not

| Item | State |
|---|---|
| Debian trixie arm64, from one command | in |
| Server, PostgreSQL 17, TLS front, the app on the screen | in |
| Hardened units, watchdog, journald limits, crash-safe PostgreSQL | in |
| SSH | not installed |
| amd64 image | config present, not built or booted |
| dm-verity read-only root | **not in D1**, SEC3. Root is writable ext4, so a changed system file is not detected. Blockers: `/etc/machine-id` on a read-only root, and mkosi's verity partitions |
| LUKS data partition | **in**, sealed to the TPM with a recovery key; see [Data disk](#data-disk). Secure Boot and the boot editor lock are not |
| A/B updates and rollback | in: `docs/architecture/OS-UPDATES.md`, including its failure table. No release key exists, so a release image refuses every bundle |
| Recovery partition and boot menu | D4. A failed boot shows systemd's own messages and that the root account is locked |
| Trusted TLS for other computers | D2. The machine's own CA means a browser warning on first visit, until a hospital trusts it or brings its own root (T2) |
| Backups and TLS in setup | D2 (§8s). Hospital name, first administrator and network are in |
| Nightly backups, health screen | D2. `/var/backups/medbrains` exists, no timer runs |
| Clinic compile profile (SM2) | later; today's binary has all modules |
| Signed images, SBOM | SEC1 |
| `medbrains-bridge`, separate worker process | none: the server runs its workers in-process, and the bridge arrives with its first device |
| Orthanc, rustenberg, SpiceDB, mail | off (§8a clinic profile) |

## Files

- `mkosi.conf`, `mkosi.conf.d/`: packages and image settings.
- `mkosi.repart/`: build-time partitions. `mkosi.extra/usr/lib/medbrains/repart/`: the data partition, made at first boot by `disk-setup`.
- `update-keys/`: public keys that may sign updates. None yet.
- `mkosi.extra/`: units, first-boot scripts, journald, watchdog, network and the TLS front (`medbrains-front`).
- `mkosi.postinst.chroot`: removes the baked PostgreSQL cluster, enables units.
- `mkosi.build.chroot`: compiles `crates/medbrains-shell` and installs its fonts.
- `tests/`: `check-units.sh` and `console-status.sh` run alone; `vm.py` drives a booted debug image with real input;
  `two-machines.sh` boots a main machine and a node on one LAN; `nodes-screen.mjs` drives the Machines page.
- `tests/cis-check.sh`: the CIS-style hardening report (X16). `tests/patients-journey.mjs`: sign in and open Patients in a real browser.
- `mkosi.splash.bmp`, `ukify-splash.py`, `install-ukify-splash.sh`: the boot logo.
- `build.sh`: runs mkosi. `builder.Dockerfile`: the Mac fallback. `qemu-run.sh`: boot it.
- `build-kanidm.sh`: compiles the identity provider from its pinned release. `kanidm-override.css`: its colours.
- `tests/kanidm-acceptance.py`, `tests/kanidm-softkey`: the owner's acceptance test and the hardware key test, against a booted debug image.
- `tests/kanidm-one-login-test.py`, `tests/kanidm-limit-test.py`: one login from setup, and the limit by address.
- `tests/kanidm-attacks.py`, `tests/kanidm-upgrade-test.py`, `tests/sso-entra-fixture.py`: the published crashes, a real upgrade and the Entra-shaped sign-in, each against a booted debug image.
- `tests/kanidm-pin-test.sh`, `tests/kanidm-disk-guard-test.sh`: the build's pins and the encryption guard, with no VM.
- `tests/webauthn-probe.html`, `tests/webauthn-probe.js`: what a browser offers for hardware keys, shown on the page. Copy them to a test VM's `/usr/share/kanidm/ui/hpkg/` and open `/pkg/webauthn-probe.html`.

## Measured

**Everything after the first table below predates the native shell** and describes cage + cog (WPE). It
stays as the baseline; memory is compared here.

**Native shell against WPE** (same VM: 1280x800, 4 vCPUs, 4 GB, software rendering, debug image)

| State | Whole machine used (`MemTotal - MemAvailable`) | Server PSS | Screen PSS |
|---|---|---|---|
| Before setup, Network screen | 294 MB | none running | 177 MB (cage 113 + shell 63) |
| Desktop, MedBrains never opened (WPE: status page, 834 MB) | **635 MB** | 162 MB | 185 MB (cage 113 + shell 72) |
| Signed in, Patients open (WPE: 2,331 MB) | **1,215 MB** | 212 MB | 643 MB, of which the page's WebProcess 320 MB (WPE: 673 and 412) |
| After Close | **783 MB** | 212 MB | 253 MB (cage 89 + shell 164). All WebKit processes gone |

The web figures are one run each, sampled seconds after the page settled, so treat them as similar rather
than better. These include the route table fix (PR #5221), which took the signed-in server from about 1,150 MB to
209 MB; the 512 MB target is still not met. Close frees about 430 MB; the shell keeps about 90 MB of it.

Everything here was **measured in QEMU on an Apple-silicon Mac** (HVF, 4 vCPUs, 4 GB RAM, no GPU, so
software rendering, on a host often under heavy load from other work). None of it is a Raspberry Pi
number, and the RFC's Pi targets stay unproven.

**Image**

| What | Value |
|---|---|
| Compressed image (`zstd -19`) | **478 MB** (target ≤ 1 GB: met for the download) |
| Raw image | 5.5 GB, mostly the reserved slot and free space; 4.3 GB of it on the Mac's disk |
| System partition used | 1,158 MB (the ≤ 1 GB target for what is installed: not met) |
| Largest parts | server binary 88 MB, libLLVM 116 MB (for software GL), kernel modules 128 MB, WPE WebKit 111 MB, PostgreSQL 45 MB, web app 26 MB |
| Data partition after first boot | 216 MB, of which PostgreSQL 188 MB |

**Boot, release image, first boot** (one run, sampled every 0.1 s or so)

| Moment | Seconds from power on |
|---|---|
| Firmware logo, progress bar | 0 to 5.8 |
| MedBrains logo on screen | 5.84, for about 0.1 s |
| Dark gap (firmware handoff to the first page), cursor appears at 12.6 | 5.95 to 13.2: **7.3 s** |
| Starting page | 13.2 |
| First sign-in details | 23.1 |

Normal boot, after a reset: firmware handoff at 5.6 s, **sign-in page at 14.9 s, about 9 s later**.
`systemd-analyze` on a first boot: firmware 5.5 s, loader 0.2 s, kernel 0.4 s, initrd 1.7 s, userspace
6.5 s; the server is listening 12.8 s after the kernel starts, with all migrations and the seed.

**The gap we could not remove.** The kernel's graphics driver resets the display as it takes over, so
the logo lasts about 0.1 s and the screen is dark for about 7 s (with QEMU's own "Display output is not
active" for about a second, which a real monitor won't show). Plymouth would be the way to cover it;
it needs a package and more initrd, and we did not add it. The first paint after that gap can have one
incomplete tile until the page next updates, a few seconds later.

**A failed boot stays visible.** With the data disk's label broken on purpose, the screen showed the timed
out device, every dependent service, "You are in emergency mode" and "the root account is locked", not
a hanging logo. It is honest and not friendly; the recovery path is D4.

**The flicker** (fixed)

| Check | Result |
|---|---|
| Nothing changing: 14 `screendump`s, 5 s apart, about 65 s, across several status runs | **all 14 images identical**, on both debug and release images |
| Stop the server, then start it (3024x1900) | the outage is shown, and recovery. Only this box changes: x 340 to 1706, y 654 to 956 of 3024x1900, the state and sentence |
| While the outage holds | no change at all between samples |
| Layout at 1280x800 and 3024x1900 | fills and centres at both, no scrollbar |

CPU and memory (PSS) on the status page: cage 0.3% and 74 MB, cog 0.1% and 61 MB, WPEWebProcess 0.4% and
162 MB, network process 39 MB. Before the fix we recorded only resident memory, not CPU: cage 117 MB,
cog 122 MB, WPEWebProcess 215 MB, network 61 MB. Those overlap through shared pages, so they don't
compare with PSS, and the fix is proven by the identical images above rather than by these figures.

**Sign-in, through the screen, with real input** (QEMU `usb-kbd` and `usb-tablet`, no API)

| Step | Result |
|---|---|
| Fresh boot, first sign-in details shown, with the hospital code | pass |
| Pointer click on Continue | pass (sign-in page, about 2 s to first paint) |
| Alt+Left back to the details, and Continue again | pass |
| Hospital code typed, pointer click on Continue | pass |
| Wrong password, pointer click on Sign In | "unauthorized" shown, `failed_login_attempts` 1 |
| Right password, pointer click on Sign In | forced change screen, counter back to 0 |
| Change password, pointer click | back to sign-in; password file gone, `must_change_password` false |
| Sign in by **Enter** with the new password | dashboard |
| Pointer click on Patients | opens, no 5xx |
| Reboot | sign-in page, no password anywhere, `systemctl --failed` empty, data kept |
| `select code, name from tenants` on a fresh boot | `DEFAULT\|My Hospital`; root location `MAIN\|Main Campus`; a full data dump has no line with the client's name |
| Release image, password read off the screen, pointer only | same result |

**Outage behaviour** (server killed from inside the app, timed from the kill)

| Case | Result |
|---|---|
| Down 12 s | stays in the app the whole time; the app shows its own error and retry, and carries on |
| Down 50 s | status page by 29 s, saying "Not answering"; back in the app at 100 s (flapping back-off of 40 s, since this was the third return in 10 minutes), still signed in |
| Front end up, server down | no longer opens a blank page |

**Guessing the 8-character password** (loopback, from the box)

| Check | Result |
|---|---|
| 8 wrong logins in a row | `401 401 401 401 401 429 429 429`: 5 per minute per address |
| After them | `failed_login_attempts` 5, account locked; 13 min 57 s left when checked |
| While locked | wrong attempts answered 400 in each later minute. The right password during a lock was not tried; the server checks the lock before the password |
| Worst case | about 5 guesses per 15 minutes per account, against about 40 bits |

**Security scores** (`systemd-analyze security`; lower is better). Long-running services are all "OK";
the two run-once setup units are not, which falls short of SEC5's rule and is left open.

| Unit | Score |
|---|---|
| `medbrains-server` | 1.1 OK |
| `postgresql@17-main` | 1.7 OK |
| `medbrains-console-status` | 2.8 OK |
| `cage-console` | 4.8 OK |
| `medbrains-firstboot`, `medbrains-db-init` | 6.5 MEDIUM: run once, as root, to create secrets and the database |

The screen unit scores highest of the running services because WebKit's own sandbox needs what we would
otherwise take away.

**Data disk cost** (arm64 QEMU, one VM each, host otherwise in use, so small differences mean little). This is the
no-TPM path, because arm64 QEMU has no usable TPM: it spends about 2 s on an argon2id slot with an empty key, which a
sealed disk does not. The sealed path's own time was seen only under x86-64 emulation (service CPU 1.8 s), which says
nothing about real TPMs.

| | Before | After |
|---|---|---|
| Normal cold boot, firmware to `graphical.target`, 2 runs | 11.0, 15.8 s | 12.3, 12.7 s |
| `systemd-cryptsetup` | none | 2.0 to 2.4 s |
| Memory used 90 s after the server answers (MemTotal - MemAvailable) | 711 MB | 722 MB, one sample |

Sequential `dd` throughput gave 1.2 GB/s write and 8.0 GB/s read before and 2.1 and 2.8 GB/s after: host cache dominates,
so it shows nothing about encryption. Real flash is unmeasured. One cold boot in four took about 73 s in userspace on
**both** images; not caused by encryption, cause open (`docs/DECISIONS.md`).

**Hardware safety:** `RuntimeWatchdogUSec=30s` on `/dev/watchdog0` (QEMU's i6300ESB). PostgreSQL shows
`fsync` on, `full_page_writes` on and `data_checksums` on. The journal was 8 MB, capped at 256 MB.

**Whole-system memory: the ≤ 512 MB target is not met.** Measured and not fixed.

| State | `free` used | Server PSS | Screen PSS (cage + cog + WebKit) |
|---|---|---|---|
| Fresh boot, status page | 834 MB | 219 MB | 336 MB |
| Signed in, Patients open | 2,331 MB | 1,127 MB | 673 MB, of which the page's WebProcess 412 MB |

The server grows from about 220 MB to about 1.1 GB when someone signs in; why is open. On a Pi 5 the GPU
would replace llvmpipe, so the screen should cost less, but that is not measured. WebProcess CPU stayed
about 20 to 37% of one core while the app sat idle, from its animations under software rendering, with
cage at about 15%.

**How WPE WebKit runs the real app:** it renders the sign-in page, dashboard and Patients correctly, in
both layout and fonts, and input works after the two fixes in the build record. Sign-in page paint about
2 s from Continue. Dashboard about 2 s to most of the page. It feels fine in QEMU for those screens, but
only those few screens were opened. Two defects were on its side and both blocked sign-in: a crash on
typing (a missing Debian dependency) and clicks that did nothing (a Debian cog bug we had to patch).

**Engine comparison, for the owner's decision** (nothing swapped)

| | WPE only (today) | Chromium only | Both (screen WPE, printing Chromium) |
|---|---|---|---|
| Debian installed size | 118 MB (`libwpewebkit` + `cog`) | 388 MB (`chromium` + `chromium-common`) | 506 MB |
| System partition used | about 1.2 GB | not built; about 1.5 GB if WPE and its plugin went | 1.57 GB (measured with both installed) |
| Memory at the sign-in page (PSS) | about 523 MB (3024x1900, cog + network + WebProcess) | 469 MB (1280x800, headless, all processes) | not measured together; roughly the sum while printing |
| Tested with the real app | yes, keyboard and mouse | loaded headless only: no screen, input or sandbox test | no |
| Printing | needs rustenberg + Chromium | the same Chromium could serve both, if rustenberg shares it | yes |

The two memory figures are not like for like, because the display sizes and modes differ. They say the
engines are in the same range at the sign-in page, not which is lighter. Chromium was run with
`--no-sandbox` in that test only, and its compositor costs are not in its figure.

## Build record (D1)

How D1 was built, kept so nobody has to rediscover it.

### Choices

| Decision | Chosen | Why | Rejected, and why |
|---|---|---|---|
| Image builder | mkosi 25 | one declarative config; handles packages, boot file and partitions | debootstrap + hand scripts (we would own the partitioning and boot code); pi-gen (Pi only, D2) |
| Build host | mkosi directly on Linux; a container only on a Mac | owner rule: no Docker in the OS, its services or its build path | Docker everywhere |
| Debian release | trixie (13) | current stable; ships PostgreSQL 17, cage and cog as ordinary packages | bookworm (PostgreSQL 15; would need PGDG) |
| Boot | systemd-boot + unified kernel image | one file holding kernel, initrd, command line and logo; the path SEC3 needs | GRUB (more moving parts, nothing gained) |
| Boot logo | a `.splash` section in the boot file | no package in the image | Plymouth (a package and more initrd). It would cover the dark gap, so it may still be worth it |
| Server binary | cross-compiled with `cargo zigbuild` for glibc 2.36 | the project's only cross path; no published release exists to reuse | building inside the container (slow, and against project law) |
| TLS | `medbrains-front` (Pingora, from `crates/medbrains-proxy`): the machine's own CA for the network, a fixed certificate for the screen, both made on first boot | production refuses `SECURE_COOKIES=false` and the server has no TLS of its own, so even the LAN needs HTTPS. The front is ours, in Rust, with HTTP/1.1 only and limits of its own | Caddy, removed in N2.1: Debian's build carries old Go and HTTP/2 code it will not rebuild; relaxing the production check |
| Screen trust | the kiosk's certificate store holds one certificate, bound in by its unit | no warning, and no other site is trusted | `--ignore-tls-errors` |
| Screen navigation | cog driven over D-Bus (`cogctl`), page opens the app itself | same window, no restart, so no flash | restarting cog to change page; an iframe (the server forbids framing) |
| Status file | a script file on tmpfs, plus a direct probe | no file-access flag, and no heartbeat writes; the probe stops a stale file saying "Ready" | `fetch(file://)` (WebKit refuses it); a meta refresh (repainted the whole page: the flicker) |
| First admin | seeded, one-time, shown on the screen, forced change | the existing installer's path | the onboarding wizard (refused on any server holding a tenant, and the seed always creates one) |
| Default names | "My Hospital", "Main Campus", UHID prefix `MB-` in the seed | the seed held a client's name, address, phone and acronym, on every new install | a per-appliance rename (it would still ship for everyone else) |
| Database owner | `medbrains` role, `SUPERUSER` | migration 0984 runs `ALTER ROLE ... BYPASSRLS`; the compose install has the same owner. Requests use `medbrains_app`. Dropping superuser after migrations is follow-up work | a non-superuser owner (migrations fail) |
| PostgreSQL cluster | created at first boot; config symlinked into `/var` | each box gets its own system identifier; reinstalling the system keeps the data; data checksums on | cluster baked into the image |
| Writable root | ext4 in D1 | a read-only root needs an answer for `/etc/machine-id` first: a transient one changes the DHCP identity and journal directory on every boot | dm-verity in D1 (SEC3) |
| Screen engine | WPE WebKit, in D1 | the RFC's first choice. Numbers are above; the choice is open and goes to the owner | swapping engines silently |

### Failures

| What happened | Cause | Fix |
|---|---|---|
| A shell command containing `cargo zigbuild` was blocked by the repo's pre-command hook while a build ran | the hook matches command text, including text inside a heredoc | wrote `build.sh` with a file tool |
| Firmware dropped to the UEFI shell: `failed to load Boot0001 ... Not Found`; no `FS0:` | a 256 MB FAT32 ESP has fewer than 65,525 clusters at 4 KB, so the firmware's FAT driver treats it as FAT16. mkfs warned about it | ESP raised to 512 MB |
| `--autologin yes` gave a login prompt on the serial port, and a getty drop-in looped: `login` exited every 10 seconds | mkosi 25 autologin covers `hvc0` and `tty1`, not ARM's `ttyAMA0`. The loop was not diagnosed; the debug shell made it unnecessary | `--debug` passes `systemd.debug_shell=ttyAMA0` on the kernel command line |
| A debug-shell symlink in the extra tree did nothing | mkosi applies presets after the extra tree, and they rewrite enablement | use the kernel command line |
| Reading the disk offline showed a directory named `env` and "Bad message" | the VM had been killed, and the mount used `ro,noload`, which skips the ext4 journal. A false alarm | mount read-write on a disposable copy so the journal replays |
| `postgresql@17-main: Could not change user id` | Debian's unit starts as root and setuid()s down; the empty `CapabilityBoundingSet=` removes that | `User=postgres` in the drop-in |
| PostgreSQL: `could not open .../conf.d/10-medbrains.conf: Permission denied` | the first-boot script runs under `UMask=0077` as root | `chown` the file to `postgres` |
| `pg_receivewal@17-main` failed on every boot | mkosi applies presets to the image and Debian's enable anything not listed, so unwanted templates were on | `10-medbrains.preset` disables them |
| Black screen; `cage: Unable to open Wayland socket: Invalid argument`; `strace` showed `EACCES` on `/run/user/987/wayland-*.lock` | `ProtectHome=yes` hides `/run/user` too. Changing `ProtectSystem` made no difference, which pointed away from it | removed `ProtectHome` from the screen unit, added `ReadWritePaths=/run/user` |
| `cage -D` exited 1 and sent the diagnosis the wrong way | cage 0.2.0 has no `-D`; `strace` showed the usage error | no flag |
| `systemctl restart cage-console` hung for 90 seconds | the stop waited out the default timeout on a stuck cage | `TimeoutStopSec=5s` |
| cage exited 133; cog: `bwrap: Can't open source /etc: Function not implemented` | `RestrictSUIDSGID=yes` installs a seccomp filter that answers `openat2` with `ENOSYS`, and Debian's bubblewrap uses `openat2`. Found with `strace -f` | removed that setting from the screen unit. WebKit's own sandbox stays on: turning it off was refused by the tool's safety check, and fixing the cause is better anyway |
| Next: `bwrap: Can't mount proc on /proc: Operation not permitted` | `ProtectKernelTunables`, `ProtectKernelLogs` and `ProtectHostname` each stop a fresh `/proc` mount in WebKit's sandbox. Proven by adding them back one at a time | removed those three from the screen unit, so its score is worse than the others. We kept WebKit's sandbox and gave these up |
| A page that had rendered sat half-drawn | headless QEMU flips virtio-gpu only when a display asks: every `screendump` advanced it one frame | attach a VNC client in tests; a real display is not affected |
| **Black 64 px rectangles on screen**, in random places, staying until the next paint. The owner saw them too | llvmpipe rasterises in threads with 64 px tiles, and a frame could be presented before all of them finished. Not a cursor, and not the compositor: `WLR_SCENE_DEBUG_DAMAGE=rerender` did not help, `LP_NUM_THREADS=0` did. A real GPU driver does not use llvmpipe | `LP_NUM_THREADS=0` in the screen unit. One incomplete first paint at boot remains, until the page's next update |
| **The screen flickered** every 15 seconds | a meta refresh reloaded the whole page, the page carried a minute clock, the timer ran its commands regardless, and a full-screen gradient made every repaint touch every pixel | the page is written once and changes only differing text; no clock; flat colour; the status file changes only on change. Scales with `clamp()` |
| **Flat background with nothing on it**, until a reboot. The owner saw it | first, the filter failed to compile (`^(blob\|data):`: "Disjunctions are not supported yet") so nothing was allowed. Then, the health probe trusted the front end: it answers 502 with the server down, and to a `no-cors` fetch that looks like success, so the page opened an empty 502 | separate filter rules; the page probes the server too; the front's 502 has a sentence in it, so it is never blank |
| Returning to the app after an outage painted nothing, in one test | seen with WebKit's page cache on, before the 502 cause above was found, so the cache may not have been at fault | `--enable-page-cache=false` stays; it also saves memory |
| **Typing in the app reset the page**: fields emptied, and the sign-in step fell back to the hospital code. This is what the owner hit when they could not sign in | `GStreamer element appsink not found`, then `g_signal_connect_data` on a null element, then "Renderer process terminated", on the first keystroke in a real form; cog restarted the page. Found by logging cog's output on a keystroke. Why a keystroke reaches GStreamer was not traced | added `gstreamer1.0-plugins-base` and `-good`. A plain test page never crashed, which is why it looked like a form bug |
| **A pointer click did nothing**: the button took focus, and the press and release reached the page, but no `click` fired. Enter worked, which hid it | a bug in Debian's cog 0.18.4: its Wayland plugin passes Linux button codes (272) to WebKit, which expects 1, 2 and 3, and sends no button on release. The conversion in its source is commented out with "@FIXME: what is this for?". A logging test page showed `pointerdown`, `mousedown`, `pointerup`, `mouseup` and no `click` | `patches/cog-0.18.4-wl-pointer-button.patch`, rebuilt by `mkosi.build.chroot`. Worth sending upstream, and evidence for the engine question: basic clicks were broken in Debian stable |
| The first sign-in details could be skipped: the app opened while they should have been showing | a race: the status file said "no first sign-in" while the server was still starting | the file says `pending` until the answer is known |
| `mkosi.build.chroot` failed three ways: `Invalid argument` on the workspace, `BUILDDIR: unbound`, and `ln: /etc/resolv.conf: busy` | mkosi's overlay cannot sit on Docker's overlay; `BUILDDIR` is unset without a build directory; network access binds `resolv.conf` during scripts | an anonymous volume for `/var/tmp`; `mktemp -d`; ship the symlink in the extra tree |
| An `exec` loop made the build hang for 12 minutes | the splash wrapper replaced `/usr/bin/ukify`, and `/usr/lib/systemd/ukify` is a symlink to it | the real script moves to `ukify.real` |
| `Failed to sync ESP file system: Input/output error`, once | the host disk was nearly full from other work (under 15 GB free). A retry passed | none; watch the guard's disk warning |
| A shared host: `curl` on port 8444 answered 200 from somebody else's VM, and `:8443` timed out | another session's QEMU on the same machine held those ports | `OS_WEB_PORT`. We never touched that VM |
| Tests sent a wrong password twice by accident, and typed text doubled once | the app's error message moves the fields below it, so a click at a fixed spot missed; under heavy host load keys repeated | a harness fault, not a product one. Layouts re-read and keys held for less time. It does show the lockout counting real failures |
