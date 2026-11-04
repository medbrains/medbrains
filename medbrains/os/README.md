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

`os/tests/vm.py` drives it (real input over QMP, screenshots, and a command in the debug shell). QEMU runs headless with its sockets in `/tmp/mb-osimage/vm/`: `vnc.sock` is the screen, `qmp.sock` takes
input, `monitor.sock` takes `screendump`, and `serial.sock` is the shell on debug images. Headless QEMU
only flips the screen while a display is attached, so connect a VNC client or the screen appears
frozen. Set `OS_WEB_PORT` if port 8443 is taken, and `OS_SCREEN_W` / `OS_SCREEN_H` to change its size.

From another computer the same box answers at `https://<address>` with a certificate warning.

## Test an image

`make os-image DEBUG=1`, then `make os-test IMAGE=<image.raw>` boots a fresh machine, makes it a main machine, and checks firewall, kernel hardening, time, memory, disk and the main machine's half of joining (one VM cannot join itself: `tests/two-machines.sh` is the rest). Limits are in `crates/medbrains-os-test/budgets.json`: lower them as numbers improve, and never raise one without a reason in the PR. It needs QEMU, and doesn't run in CI yet.

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
   - **Review,** then **Start the main machine**. Nothing is final before this.
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

1. `systemd-repart` grows the data partition to fill the disk.
2. `medbrains-firstboot` generates every secret (JWT keys, ID-fingerprint and provider keys, database
   password), a checksummed PostgreSQL cluster and the certificate for the screen's own front end. None
   of it is in the image, and no password is generated for a person.
3. `medbrains-os-setup` listens on the Unix socket `/run/medbrains-console/setup.sock`, as root, mode 0660
   root:kiosk. A TCP port would let any local user bind it while the service restarts and receive what the
   screen sends. Permissions alone still let in WebKit's helpers, which share the screen's group, so it also checks
   the connecting program with the kernel: root or `/usr/bin/medbrains-shell`, nothing else. A process running as
   the screen's user could still start that program under its own control, so this raises the bar without closing
   the matter. It has no database and no web framework, and every helper it runs has a time limit.
4. **Review** writes the three fields into the env as `MEDBRAINS_SEED_*`, the password only as its Argon2 hash, then the role marker
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
PostgreSQL and Caddy each carry the role condition themselves, and `tests/check-units.sh` fails if one
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
`iwctl --passphrase`, nor in a log. The disk isn't encrypted yet (T1), so a removed disk would give it up.

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
and 443 to any address until Control can hold an allowlist. **Only a main machine** adds inbound 80, 443, 123
(time for the LAN), 7844 (iroh) and 7845 ("who are you?" for a typed address), from
`usr/lib/medbrains/main-machine.nft`, and only it announces `medbrains.local` and serves time.
Analysers and PACS have no outbound path until the device network gateway (task N4.2). A file that does not
parse fails the build. Time is `chrony` with NTS, and keeps serving the LAN with the internet gone.

## Linux hardening

Task T1.1, all with settings Linux already has: `/etc/sysctl.d/90-medbrains.conf`, unused kernel modules blocked
in `/etc/modprobe.d/medbrains-blocklist.conf`, and `lockdown=integrity` with memory protections on the kernel
command line. Unprivileged user namespaces stay on because WebKit's sandbox needs them.

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
The screen shows six digits. On the main machine, in MedBrains, **Admin > Machines** lists it with the same
six digits. Approve asks for the digits from the machine's own screen, and only then does the machine join.

**What a node is:** `medbrains-node.target`, with the screen, the agent and the setup service. No PostgreSQL,
server or Caddy, and no secrets but its own key. Its endpoint answers no protocol and its firewall opens no
service. `medbrains-agent` listens on `127.0.0.1:8443`, the address the screen already loads, and carries each
connection over iroh to the main machine's loopback front end. TLS ends at the main machine, so the agent
cannot read what it carries, and the screen's one trusted certificate is the main machine's, delivered on approval.

| Rule | How |
|---|---|
| A key alone grants nothing | Anyone may speak the join protocol, which only files a request. A tunnel needs a live key on the roster, decided by `medbrains-edge`'s `admit` |
| A fake main machine is caught | The code covers both keys and a nonce from each side, the node committing to its nonce first. Keys alone would not do: six digits fall to about a million tries, about a second of grinding |
| Approval cannot be clicked through | The server compares the digits a person typed with the code. Three wrong codes refuse the request, and each is audited as a denial |
| Requests run out | 10 minutes |
| A stranger cannot stop a machine joining | The list never refuses. One address holds at most 3 waiting (its oldest goes first) and 3 conversations, and starts at most 10 a minute; at 20 waiting the oldest goes. Machines shows what was pushed out, from which address, and the machine pushed out is told to ask again |
| Time | A node's chrony asks the main machine's chrony, over iroh, so the key authenticates it and removal ends it. A main machine with only its own clock answers stratum 10, and both machines then say "Time not confirmed" on the top bar |
| Tenant | From the hospital this box serves, through admission. The join frames have no such field and refuse unknown ones |
| Removal | The key leaves the roster at once; the agent asks every 2 seconds and closes that machine's open connection |
| No outside party | No relay, no outside lookup, no UPnP (`portmapper_config` is off; iroh's default would ask the router for a port) |

Approved machines are `paired_devices` rows with `device_node_keys` rows, and requests are
`device_pairing_requests` rows, so there are no new tables (migration 1405 adds five columns). The server
never touches iroh: `medbrains-agent --main` asks it over loopback, with a token in a file only the agent reads.

**Measured** (two debug-image VMs in QEMU on one Mac, 4 vCPUs and 4 GB each, one run; `tests/two-machines.sh`,
a socket netdev that carries multicast. No hardware):

| | Node | Main machine |
|---|---|---|
| Whole machine used, desktop after a reboot (`MemTotal - MemAvailable`) | **300 MB** | 519 MB |
| The same, signed in, app open | 732 MB | 2,763 MB, of which most is the server after sign-ins |
| Agent, PSS | 13 MB | 15 MB |
| `/var` used | 31 MB | 229 MB |
| Listening beyond loopback | UDP 5353 and the agent's two outbound sockets, which the firewall does not open | 80, 443, 123, 5353, 7844, 7845 |

The agent binary is 16.3 MB stripped. By symbol size, iroh, its QUIC and networking are about 3.6 MB and crypto
about 1.9 MB, so iroh costs about 5.5 MB; this is approximate, because generic code is attributed to its caller.

From clicking the main machine to the tunnel answering: 17 s, including a browser robot signing in and typing the
code. A person walking across a building is the slow part. Removal ended access 1 to 2 s after the database recorded
it, with both clocks in step; the agent asks every 2 s, so this can reach about 2 s.

**A main machine whose address changes** (changed through the setup service, since the wire has no DHCP server):

| Case | Result |
|---|---|
| Node signed in, mDNS working | Back with no action after 15 s (36 s before the idle timeout was shortened). The top bar says "Cannot reach the main machine" from its next poll, within about 10 s, and the signed-in page stays |
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
| Fake main machine answers | Node would send its screen there | Codes differ | Approval needs the digits from the node, so a person cannot approve it blind; three wrong refuses |
| Flood of requests | A real request could be crowded out | Machines lists what went | Per-address limits; the oldest goes; the machine pushed out is told to ask again |
| Server down during a join | Request cannot be filed | The node shows it could not reach the main machine | Grants nothing; a person asks again |
| Power cut after approval, before the role is written | Setup not finished | Agent has the approval on disk | Asking again finishes without a new request |
| Roster cannot be fetched | Removal cannot be learned | Agent logs it | Keeps the last roster until stale at 16 hours, then admits nobody |
| Main machine unreachable | Node cannot work | "Cannot reach the main machine" on the top bar, over the app too | No offline path; the connection is dialled again when the screen next asks |
| Main machine's address changes | The saved address is dead | An idle path is noticed within 8 s | Dials by key; mDNS says where that key is now, and the saved address is only a first guess |
| Node has no time source | Certificates and audit at risk | "Time not confirmed" on the top bar | Keeps working, and says so |
| Node key file readable by others | It may have been copied | The agent checks its mode at start | Refuses to start |

**Requirements and the tests that prove them:** a key alone grants nothing, `an_unapproved_key_is_refused_a_tunnel`; tenant from admission,
`the_tenant_comes_from_admission_never_from_a_claim`; codes, `code::tests`; a stranger cannot block a join, `one_address_flooding_cannot_block_or_push_out_another`
and `one_address_cannot_take_the_places_of_others`; duties separate, `each_duty_needs_its_own_permission`; removal, `an_approved_key_reaches_the_front_end_and_removal_ends_it_at_once`.

**Limits:**
- The machine key is a file (mode 0600), not in a TPM, until SEC3. Anyone who can read the data partition can
  copy it. Removing the machine ends the copy too.
- A display gets the same desktop as a workstation; the board is not built, nor is the §8a place or swap flow.
- Sign-in limits count every screen as one address, because each connection arrives on loopback.
- Someone able to use more than 20 addresses on the LAN at once can still push out a real request; the machine says so and asks again, and Machines shows every address. It takes a network-level answer (N4).
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
in the app: Ctrl+Shift+I and D (GTK's inspector, turned off in code), Ctrl+Shift+C, F12, Ctrl+Alt+F2 and F3, Ctrl+Alt+T.
None opens anything. The app's right-click menu has Back, Forward, Stop and Reload, with no Inspect.

**Limits we chose or could not avoid:**
- **`cage` does not show a second window.** A dialog window stayed invisible and its modal grab blocked all
  input, so the power question lives inside its menu, and the file chooser is refused. **Uploads, downloads
  and printing do not work on this screen.** The anatomy model's CDN stays blocked too.
- **No lock or switch person.** Anyone at the screen can use a signed-in session until a restart.
- **A page keeps the time zone it opened with** until a restart, if the zone is changed later in Settings.
- **If the server stops** while MedBrains is open, Caddy's plain sentence shows in the view and the desktop
  names the service. The old automatic return to a status page is gone.
- **The hospital's name on the desktop** is the one given at setup; renaming it in MedBrains doesn't update it.
- **The top bar says "Time not confirmed"** in red until chrony has a real time source, including for a moment after
  every boot, and always on a network with no time server. Its time zone is UTC, with no way to change it.
- **If the server stops** while MedBrains is open, Caddy's plain sentence shows in the view and the health
  widget says so. The old automatic return to a status page is gone.
- A password forgotten after setup has no recovery path on the appliance (§8k, later).
- Sign-in is limited per address, and everyone at the screen is one address (`127.0.0.1`).
- Anybody on the network can lock the administrator out for 15 minutes with 5 wrong passwords.

**Web app items to fix elsewhere, not changed here:**
- The sign-in page says "For Indian hospitals" and that data "is kept in India", which is not true of
  every appliance.
- The app shows "Test cases" and asks to verify `admin@medbrains.localhost`, which cannot receive mail.

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
| Backups and TLS in setup | D2 (§8s). Hospital name, first administrator and network are in |
| Nightly backups, health screen | D2. `/var/backups/medbrains` exists, no timer runs |
| Clinic compile profile (SM2) | later; today's binary has all modules |
| Signed images, SBOM | SEC1 |
| `medbrains-bridge`, separate worker process | none: the server runs its workers in-process, and the bridge arrives with its first device |
| Orthanc, rustenberg, SpiceDB, mail | off (§8a clinic profile) |

## Files

- `mkosi.conf`, `mkosi.conf.d/`: packages and image settings.
- `mkosi.repart/`: build-time partitions. `mkosi.extra/usr/lib/repart.d/`: first-boot growth.
- `mkosi.extra/`: units, first-boot scripts, journald, watchdog, network and Caddy.
- `mkosi.postinst.chroot`: removes the baked PostgreSQL cluster, enables units.
- `mkosi.build.chroot`: compiles `crates/medbrains-shell` and installs its fonts.
- `tests/`: `check-units.sh` and `console-status.sh` run alone; `vm.py` drives a booted debug image with real input;
  `two-machines.sh` boots a main machine and a node on one LAN; `nodes-screen.mjs` drives the Machines page.
- `mkosi.splash.bmp`, `ukify-splash.py`, `install-ukify-splash.sh`: the boot logo.
- `build.sh`: runs mkosi. `builder.Dockerfile`: the Mac fallback. `qemu-run.sh`: boot it.

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
