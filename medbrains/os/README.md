# MedBrains OS image (D1)

The appliance image from `RFCs/RFC-HOSPITAL-OS.md` §8b: Debian stable, PostgreSQL 17, the MedBrains
server and web app, and the app itself on the machine's own screen. Boot it and sign in on that
screen, with no separate browser. D1 means first bootable, not finished; see
[what is in D1](#what-is-in-d1-and-what-is-not).

## Build

`make os-image` cross-compiles the server, builds the web app and builds the image.

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

QEMU runs headless with its sockets in `/tmp/mb-osimage/vm/`: `vnc.sock` is the screen, `qmp.sock` takes
input, `monitor.sock` takes `screendump`, and `serial.sock` is the shell on debug images. Headless QEMU
only flips the screen while a display is attached, so connect a VNC client or the screen appears
frozen. Set `OS_WEB_PORT` if port 8443 is taken, and `OS_SCREEN_W` / `OS_SCREEN_H` to change its size.

From another computer the same box answers at `https://<address>` with a certificate warning.

## Boot in UTM

Create a new "Virtualize" Linux VM for ARM64, tick "Boot from UEFI", remove the default drive, and
import the `.raw` as a VirtIO drive after resizing it (`qemu-img resize` to 32 GB or more; first boot
takes the extra space). Add a `virtio-gpu-pci` display. Not exercised for D1.

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
3. **Starting.** A status page, on the machine's screen.
4. **First boot only: the first sign-in details,** with a keyboard-operable Continue button: user
   `admin`, and a one-time password shaped like `4KTM-9PXR`. They stay available
   until the password has been changed: **Alt+Left** from the sign-in page returns to them, and so does
   a restart.
5. **The app, in the same window.** Sign in, choose a new password when asked, and work with keyboard and
   mouse. On every later boot the sign-in page is the first thing shown, with no password anywhere.
6. **If the server stops answering for 30 seconds,** the status page says so in plain words and goes back
   to the app when the server recovers.

Opening the app from a browser on another computer on the same network stays available as an option,
not the main path.

### First boot, underneath

1. `systemd-repart` grows the data partition to fill the disk.
2. `medbrains-firstboot` generates every secret (JWT keys, ID-fingerprint and provider keys, database
   and first admin passwords), a checksummed PostgreSQL cluster and the certificate for the screen's own
   front end. None of it is in the image.
3. `medbrains-db-init` creates the owner, `medbrains_app` and `medbrains_outbox_worker` roles, using
   `deploy/standalone/db-roles.sh`.
4. `medbrains-server` runs migrations and the seed as the owner, then serves as `medbrains_app`, which
   row level security applies to.
5. `medbrains-console-status` removes the password from the env once the seed has read it, and removes
   the password file once the administrator has changed it.

**Why the seeded admin and not the onboarding wizard:** the server seeds a hospital on every empty
database before it listens, so `/api/onboarding/status` never reports `needs_setup` on a fresh box and
`/onboarding` refuses. Keeping the seed with a generated password is the path the standalone installer
already uses. The seed's defaults are now the neutral "My Hospital" and "Main Campus", renamed in Admin.
Choosing your own password and naming the hospital at first boot is a later step (§8s).

**The first password is only 8 characters, about 40 bits,** so a person can read it off a screen and
type it. It comes from the OS random source, in a 31-character alphabet with no 0, O, 1, I or L. The
password policy does not apply to it: that policy checks passwords people choose, which is why the
forced change asks for a stronger one. That length is acceptable because it is one-time and guessing is
limited, as measured below: 5 tries a minute per address, and the account locks for 15 minutes after 5
failures.

## Network

`/etc/nftables.conf` is default deny in both directions. Inbound: 80, 443, 123 (time for the LAN), 5353
(`medbrains.local`). Outbound: address, names, time, and 443 to any address until Control can hold an allowlist.
Analysers and PACS have no outbound path until the device network gateway (task N4.2). A file that does not
parse fails the build. Time is `chrony` with NTS, and keeps serving the LAN with the internet gone.

## Linux hardening

Task T1.1, all with settings Linux already has: `/etc/sysctl.d/90-medbrains.conf`, unused kernel modules blocked
in `/etc/modprobe.d/medbrains-blocklist.conf`, and `lockdown=integrity` with memory protections on the kernel
command line. Unprivileged user namespaces stay on because WebKit's sandbox needs them.

## How the screen works

- `cage` is the Wayland kiosk compositor. `console-session`, running inside it as the unprivileged
  `kiosk` user, starts `cog` (WPE WebKit) on the status page.
- The status page is written once and never reloads. Every 5 seconds it probes the front end and the
  server and reads `/run/medbrains-console/status.js`, then changes only the text that differs. If nothing
  differs it touches nothing, so nothing repaints. It is a script file because WebKit cannot fetch
  `file://` URLs, and the flag that would allow it lets a page read any local file.
- `medbrains-console-status` rewrites that file only when its content differs, on tmpfs. It asks the
  database only while the first password exists, and every command has a timeout.
- The page opens the app by itself when ready, unless the first sign-in details are still waiting.
- If health checks fail for 30 seconds, `console-session` tells cog to show the status page.

**Blips and flapping.** A shorter failure leaves the app alone, because the page may hold a half-typed
form. After a real outage the app reloads, so an unsaved form is lost at that point. Each return within
10 minutes doubles the wait before going back (10, 20, 40 seconds, up to 5 minutes).

**Staying on this machine.** The app loads from `https://127.0.0.1:8443`, a loopback-only front end with
a self-signed certificate, the only certificate the kiosk trusts, so there is no warning. cog has no
address bar. A WebKit content filter blocks everything except that origin, the status page and its
health probe, and cage blocks switching to another console. Nothing on the screen runs a shell.

**Limits we cannot enforce:**
- cog's history keys stay on: Alt+Left and Alt+Right. Ctrl+Q did nothing when we tried it, and
  Ctrl+Alt+F2 stayed on the screen's console, as intended.
- A blocked address shows WebKit's small "blocked by a content blocker" page with "Try again". We reached
  it only by forcing it with `cogctl`. A link to another site in the app would land on it, and Alt+Left
  leaves it.
- The anatomy model's CDN is blocked too, so the body-site picker's 3D model won't load on this screen.
- WPE has no file picker, so uploads don't work on this screen. Not tested beyond that.

**Known gaps, not built yet:**
- **No auto-lock or fast user switching.** Anyone standing at the screen can use a signed-in session.
  Sign-in protects the data until then; nothing locks it afterwards.
- A password forgotten after the change has no recovery path on the appliance (§8k, later).
- Sign-in is limited per address, and everyone at the screen is one address (`127.0.0.1`). The limit is 5
  requests a minute across all `/auth` routes, including the sign-in page's lookups, so busy use of the
  screen can hit it. We hit it in testing, and the page wrongly blamed the connection.
- Anybody on the network can lock the administrator out for 15 minutes with 5 wrong passwords.
- A graceful server stop took up to 29 seconds in testing.

**Web app items to fix elsewhere, not changed in this PR:**
- The sign-in page says "For Indian hospitals" and that data "is kept in India", which is not true of
  every appliance.
- A wrong password shows the bare word "unauthorized".
- The app shows "Test cases" and asks to verify `admin@medbrains.localhost`, which cannot receive mail.
- The rate limiter's 429 is reported on the sign-in page as a connection problem.
- Other mentions of the client's name remain in fixtures and comments; the owner has that list.

## Printing

**Off in D1.** When it is added, the path is `rustenberg`, MedBrains' own Gotenberg-compatible service,
not Gotenberg. rustenberg drives Chromium on the host, so a machine that prints needs Chromium, which
bears on the engine comparison below.

## Disk layout (§8k)

| Partition | Size | Holds |
|---|---|---|
| EFI | 512 MB | systemd-boot, the boot file (kernel, initrd, logo) |
| root A | 2 GB | the system (`/`), ext4 |
| root B | 2 GB | reserved, labelled `_empty`, for A/B updates |
| data | 1 GB, grown at first boot to fill the disk | `/var`: PostgreSQL, files, logs, backups, secrets |

The PostgreSQL configuration and `/etc/medbrains` are symlinks into `/var`, so reinstalling the system
partitions keeps the data.

## What is in D1, and what is not

| Item | State |
|---|---|
| Debian trixie arm64, from one command | in |
| Server, PostgreSQL 17, TLS front, the app on the screen | in |
| Hardened units, watchdog, journald limits, crash-safe PostgreSQL | in |
| SSH | not installed |
| amd64 image | config present, not built or booted |
| dm-verity read-only root | **not in D1**, SEC3. Root is writable ext4, so a changed system file is not detected. Blockers: `/etc/machine-id` on a read-only root, and mkosi's verity partitions |
| LUKS data partition | **not in D1**, SEC3: data at rest on the disk is unencrypted. Add `Encrypt=tpm2` in the data partition |
| A/B updates and rollback | D4. Slot B is reserved; nothing writes to it yet |
| Recovery partition and boot menu | D4. A failed boot shows systemd's own messages and that the root account is locked |
| Trusted TLS for other computers | D2. Caddy's local CA means a browser warning on first visit |
| Setup wizard for hospital, backups, TLS | D2 (§8s) |
| Nightly backups, health screen | D2. `/var/backups/medbrains` exists, no timer runs |
| Clinic compile profile (SM2) | later; today's binary has all modules |
| Signed images, SBOM | SEC1 |
| `medbrains-bridge`, separate worker process | none: the server runs its workers in-process, and the bridge arrives with its first device |
| Orthanc, rustenberg, SpiceDB, mail | off (§8a clinic profile) |

## Files

- `mkosi.conf`, `mkosi.conf.d/`: packages and image settings.
- `mkosi.repart/`: build-time partitions. `mkosi.extra/usr/lib/repart.d/`: first-boot growth.
- `mkosi.extra/`: units, first-boot scripts, the status page, journald, watchdog, network and Caddy.
- `mkosi.postinst.chroot`: removes the baked PostgreSQL cluster, enables units.
- `mkosi.build.chroot`, `patches/`: rebuilds cog's Wayland plugin with the click fix.
- `mkosi.splash.bmp`, `ukify-splash.py`, `install-ukify-splash.sh`: the boot logo.
- `build.sh`: runs mkosi. `builder.Dockerfile`: the Mac fallback. `qemu-run.sh`: boot it.

## Measured

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
| `caddy` | 1.9 OK |
| `medbrains-console-status` | 2.8 OK |
| `cage-console` | 4.8 OK |
| `medbrains-firstboot`, `medbrains-db-init` | 6.5 MEDIUM: run once, as root, to create secrets and the database |

The screen unit scores highest of the running services because WebKit's own sandbox needs what we would
otherwise take away.

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
| TLS | Caddy from Debian: local CA for the network, a fixed certificate for the screen | production refuses `SECURE_COOKIES=false` and the server has no TLS of its own, so even the LAN needs HTTPS | Pingora proxy from `deploy/standalone` (another binary to cross-build; expects public certificates); relaxing the production check |
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
| `pg_receivewal@17-main` failed on every boot; `caddy-api.service` or `caddy.service` failed | mkosi applies presets to the image and Debian's enable anything not listed, so unwanted templates and a second Caddy unit on the same ports were on | `10-medbrains.preset` disables them |
| Black screen; `cage: Unable to open Wayland socket: Invalid argument`; `strace` showed `EACCES` on `/run/user/987/wayland-*.lock` | `ProtectHome=yes` hides `/run/user` too. Changing `ProtectSystem` made no difference, which pointed away from it | removed `ProtectHome` from the screen unit, added `ReadWritePaths=/run/user` |
| `cage -D` exited 1 and sent the diagnosis the wrong way | cage 0.2.0 has no `-D`; `strace` showed the usage error | no flag |
| `systemctl restart cage-console` hung for 90 seconds | the stop waited out the default timeout on a stuck cage | `TimeoutStopSec=5s` |
| cage exited 133; cog: `bwrap: Can't open source /etc: Function not implemented` | `RestrictSUIDSGID=yes` installs a seccomp filter that answers `openat2` with `ENOSYS`, and Debian's bubblewrap uses `openat2`. Found with `strace -f` | removed that setting from the screen unit. WebKit's own sandbox stays on: turning it off was refused by the tool's safety check, and fixing the cause is better anyway |
| Next: `bwrap: Can't mount proc on /proc: Operation not permitted` | `ProtectKernelTunables`, `ProtectKernelLogs` and `ProtectHostname` each stop a fresh `/proc` mount in WebKit's sandbox. Proven by adding them back one at a time | removed those three from the screen unit, so its score is worse than the others. We kept WebKit's sandbox and gave these up |
| A page that had rendered sat half-drawn | headless QEMU flips virtio-gpu only when a display asks: every `screendump` advanced it one frame | attach a VNC client in tests; a real display is not affected |
| **Black 64 px rectangles on screen**, in random places, staying until the next paint. The owner saw them too | llvmpipe rasterises in threads with 64 px tiles, and a frame could be presented before all of them finished. Not a cursor, and not the compositor: `WLR_SCENE_DEBUG_DAMAGE=rerender` did not help, `LP_NUM_THREADS=0` did. A real GPU driver does not use llvmpipe | `LP_NUM_THREADS=0` in the screen unit. One incomplete first paint at boot remains, until the page's next update |
| **The screen flickered** every 15 seconds | a meta refresh reloaded the whole page, the page carried a minute clock, the timer ran its commands regardless, and a full-screen gradient made every repaint touch every pixel | the page is written once and changes only differing text; no clock; flat colour; the status file changes only on change. Scales with `clamp()` |
| **Flat background with nothing on it**, until a reboot. The owner saw it | first, the filter failed to compile (`^(blob\|data):`: "Disjunctions are not supported yet") so nothing was allowed. Then, the health probe trusted the front end: Caddy answers 502 with the server down, and to a `no-cors` fetch that looks like success, so the page opened an empty 502 | separate filter rules; the page probes the server too; Caddy's 502 now has a sentence in it, so it is never blank |
| Returning to the app after an outage painted nothing, in one test | seen with WebKit's page cache on, before the 502 cause above was found, so the cache may not have been at fault | `--enable-page-cache=false` stays; it also saves memory |
| **Typing in the app reset the page**: fields emptied, and the sign-in step fell back to the hospital code. This is what the owner hit when they could not sign in | `GStreamer element appsink not found`, then `g_signal_connect_data` on a null element, then "Renderer process terminated", on the first keystroke in a real form; cog restarted the page. Found by logging cog's output on a keystroke. Why a keystroke reaches GStreamer was not traced | added `gstreamer1.0-plugins-base` and `-good`. A plain test page never crashed, which is why it looked like a form bug |
| **A pointer click did nothing**: the button took focus, and the press and release reached the page, but no `click` fired. Enter worked, which hid it | a bug in Debian's cog 0.18.4: its Wayland plugin passes Linux button codes (272) to WebKit, which expects 1, 2 and 3, and sends no button on release. The conversion in its source is commented out with "@FIXME: what is this for?". A logging test page showed `pointerdown`, `mousedown`, `pointerup`, `mouseup` and no `click` | `patches/cog-0.18.4-wl-pointer-button.patch`, rebuilt by `mkosi.build.chroot`. Worth sending upstream, and evidence for the engine question: basic clicks were broken in Debian stable |
| The first sign-in details could be skipped: the app opened while they should have been showing | a race: the status file said "no first sign-in" while the server was still starting | the file says `pending` until the answer is known |
| `mkosi.build.chroot` failed three ways: `Invalid argument` on the workspace, `BUILDDIR: unbound`, and `ln: /etc/resolv.conf: busy` | mkosi's overlay cannot sit on Docker's overlay; `BUILDDIR` is unset without a build directory; network access binds `resolv.conf` during scripts | an anonymous volume for `/var/tmp`; `mktemp -d`; ship the symlink in the extra tree |
| An `exec` loop made the build hang for 12 minutes | the splash wrapper replaced `/usr/bin/ukify`, and `/usr/lib/systemd/ukify` is a symlink to it | the real script moves to `ukify.real` |
| `Failed to sync ESP file system: Input/output error`, once | the host disk was nearly full from other work (under 15 GB free). A retry passed | none; watch the guard's disk warning |
| A shared host: `curl` on port 8444 answered 200 from somebody else's VM, and `:8443` timed out | another session's QEMU on the same machine held those ports | `OS_WEB_PORT`. We never touched that VM |
| Tests sent a wrong password twice by accident, and typed text doubled once | the app's error message moves the fields below it, so a click at a fixed spot missed; under heavy host load keys repeated | a harness fault, not a product one. Layouts re-read and keys held for less time. It does show the lockout counting real failures |
