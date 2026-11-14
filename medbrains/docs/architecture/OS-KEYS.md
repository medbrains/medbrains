# MedBrains OS: keys, secrets and certificates

What is on the image today, from the code and booted arm64 and amd64 debug images (2026-11-04). An inventory, not
a design: root, machine and licence keys are plan T2. A key not listed here is a gap in this document.

"Measured": seen on a booted image. "Source": read in code we ship. "Unverified": neither.

## What the disk encryption does and does not protect

The data partition is `/var`: the database, secrets, files, logs. It is LUKS2, created on first boot, so no
plaintext copy of it ever exists (`os/mkosi.extra/usr/lib/medbrains/disk-setup`).

The seal is **PCR 7 and PCR 11 by signature with Secure Boot enforced, PCR 4 and 7 and PCR 11 by signature without it**,
plus a **rollback floor** in the TPM (below). With Secure Boot, a new boot file signed with our keys opens the disk by
itself, so updates and power cuts after them need nobody. **In one line: this protects a disk that has left the machine.
Without a PIN it does not protect a stolen machine from someone able to change its disk.**

| Attack | Result today | Evidence |
|---|---|---|
| Disk removed or copied, read or booted elsewhere | **Stopped** without the recovery key. Marker and JWT key absent from the raw disk | `raw_disk_shows_nothing`, `copy_stays_locked` |
| Stolen machine booted from an attacker's own system | **With Secure Boot, the firmware refuses a boot file not signed with our key, and PCR 7 records that it enforced that key. Without it, stopped by PCR 4, tested.** Before that the disk **opened**: with Secure Boot off PCR 7 is the same under any system, and PCR 11 can be extended by hand to the published values and the signature replayed. Measured on swtpm | `stolen_machine_replay_refused`, with a control that still opens without PCR 4 |
| Boot file (UKI) changed | **Stopped:** PCR 11 changes, and Secure Boot refuses it or PCR 4 changes | `changed_boot_file_stays_locked` |
| Older boot file and system, signed with our keys | **Stopped by the rollback floor:** a system whose `MEDBRAINS_ROLLBACK` is below the TPM counter gets no TPM unlock, and the disk asks for its recovery key | `floor_refuses_older_system` (x86-64 swtpm), `os/tests/disk-setup.sh` |
| Kernel command line edited | **With Secure Boot, ignored:** systemd-stub uses only the command line inside the signed boot file, so an added loader entry with another `roothash=` starts the genuine system (`added_entry_is_ignored`), and the updater refuses a boot partition holding an entry it did not put there. Unsigned credentials from the boot partition or SMBIOS are refused by `systemd.import_credentials=no`, which the updater requires of every boot file. **Without Secure Boot:** menu and editor off, tested by file only; **not sealed:** PCR 12 changed between normal cold boots, so a machine stopped opening itself. Starting a firmware shell first changes PCR 4 | `boot_editor_off`, anomaly in DECISIONS |
| Passive sniffing of the TPM bus | **Stopped.** Unseal runs in a salted HMAC session with response encryption, on by default | Below |
| Active interposer on the TPM bus, no PIN | **Not stopped.** systemd says so in its source. A PIN closes it | Below |
| System partition edited, then booted in this machine | **Stopped since verity** (`OS-VERITY.md`): the changed block is refused and the start stops or goes back, tested on arm64 (`tamper`). **Closed with Secure Boot** (row above). **Still open without it:** a boot entry added to the boot partition can start our boot file with another root hash, measured only into PCR 12, which the seal leaves out (reasoned). Before verity: **not stopped without a PIN, tested.** Same loader and boot file, so PCR 4 matches and the TPM opens the disk for whatever runs. The same goes for those files copied to a USB stick with another system partition (reasoned, not run). **Only verity and Secure Boot close this. A PIN does, today** | `system_partition_edit_stays_locked` (x86-64, not yet run), `tamper` (arm64) |
| Cold boot, or DMA while running | Volume key is in kernel memory. IOMMU settings help against DMA; nothing here stops cold boot | Below |

### Sniffing the TPM, and the PIN trade-off

**Sessions:** systemd 257 `tpm2_make_encryption_session` ([source](https://github.com/systemd/systemd/blob/v257/src/shared/tpm2-util.c))
starts a salted HMAC session with AES-128-CFB parameter encryption for every seal and unseal, with no option
to turn it off. Measured from swtpm's log on a normal boot: all three `TPM2_Unseal` commands carry a second
session (`0x02000000`, attributes `0x41`, response-encrypt set). The token records `tpm2-srk: true`.

**What that leaves:** the same source says it plainly: "an active interposer could fake a TPM, satisfying the
encrypted session, and just forward everything to the real TPM". Binding the session to a PIN stops that.

| | No PIN (default) | PIN at every start |
|---|---|---|
| Power cut | **Comes back by itself** | Waits for a person at the screen, however long that is |
| Stolen machine, edited system partition | **Opens** | Needs the PIN |
| Active interposer on the TPM bus | Can get the key | Needs the PIN too. Wrong PINs trip the TPM's lockout: on swtpm three, across boots, then even the right PIN is refused for a while (real chips allow more). The recovery key still works, tested |

Setup asks once, at first boot; Enter means no PIN. Recorded as `encrypted-tpm2` or `encrypted-tpm2-pin`. A ward
with no system until someone types a PIN carries its own patient risk, so no PIN is the default.

**FIDO2 key: not built.** `systemd-cryptenroll --fido2-device=auto` can do it; a VM cannot test a real key.

### Binding to the signed boot image

`build.sh` signs the boot file's expected PCR 11 values with `OS_PCR_KEY`; mkosi and `systemd-measure` embed the
signature (`.pcrsig`) and public key (`.pcrpkey`), and the stub puts them in `/run/systemd`. `disk-setup` seals to that key
(`systemd-cryptenroll --tpm2-public-key --tpm2-public-key-pcrs=11`), so any boot file signed with it matches PCR 11.
**PCR 11 alone protects nothing with Secure Boot off**, as the attack above shows: someone's own system extends PCR 11 to
the published values and replays the signature. Beside it the seal needs a value that system cannot produce:

- **Secure Boot enforced, and our certificate the only one trusted:** PCR 7 alone. The exact condition
  (`medbrains-os-update seal-pcrs`, `secure_boot.rs`, unit-tested): `SecureBoot` is 1, `SetupMode` is 0, `AuditMode` is 0
  or absent (`DeployedMode` may be either), and **PK, KEK and db are each well-formed signature lists holding only X.509
  entries equal to our certificate**, read from the sealed system partition (`/usr/share/medbrains/secure-boot-db.der`),
  never from the boot partition. dbx may hold anything: it only removes trust. Any other trusted entry, a vendor's or
  Microsoft's certificate or a hash, keeps PCR 4: any of them could have signed a boot chain that leaves PCR 7 as it is.
  Anything missing, malformed or unreadable keeps PCR 4 too. `build.sh` signs the loader and the boot file with `OS_SB_KEY`; mkosi puts the key files on the boot partition, and
  systemd-boot enrols them only where that is safe, a virtual machine in setup mode (`secure-boot-enroll if-safe`). PCR 7
  does not change when a new boot file is signed with the same key, so **updates open by themselves**. A real machine gets
  the keys at installation (plan X2); until then it takes the next line.
- **Otherwise** (Secure Boot off, or a firmware that also trusts others, as most PCs' db does): PCR 4, the loader and boot
  file the firmware started, as before. Every new boot file asks for the recovery key once, then `disk-setup reseal`.

`disk-setup` chooses when it seals, at first boot or at `reseal`, from the firmware's variables. Turning Secure Boot on
later changes PCR 7: the recovery key once, then `disk-setup reseal` seals the new way. That is the one-time step for a
disk sealed before this. Not PCR 12: unstable (DECISIONS 2026-11-04), and what it would catch Secure Boot refuses already.

- **Key today:** debug images make throwaways. **No release key exists, so a release image is not signed.** Holding the keys
  is plan T2, offline (`OS_PCR_KEY` and `OS_SB_KEY` apart: either alone opens no disk).
- **Shown on swtpm:** the replay is refused and its control opens, a changed boot file is refused, restoring it opens again.
- **swtpm cannot show:** real firmware's PCR 4 and 7 across updates, real TPM timing, any physical attack.

### Rollback floor

With PCR 4 out of the seal, any older boot file signed with our keys would open the disk, a flawed one included. So the
TPM holds a **floor**: an NV monotonic counter (`0x01004d42`). Each image carries a rollback number, `MEDBRAINS_ROLLBACK`
in its `os-release`, so it is on the sealed system partition and in the boot file's measured `.osrel`. `OS_ROLLBACK` sets
it and must rise with every release (debug: the version's last number plus one).

- **Checked** before the data disk opens (`medbrains-disk-floor.service`, `disk-setup floor-check`, required by the
  unlock): a number below the counter, or a counter that can't be read, extends PCR 11 with `medbrains-below-rollback-floor`,
  so no signed policy matches for the rest of that boot and the disk asks for its recovery key. A person can still open it.
- **Raised** at first boot, before the partition exists, to the image's number, and by the updater before each install to
  the running version's number (`disk-setup floor-raise`). The version in use and newer ones open by themselves, so going
  back to the version just left still works; the one before it no longer does.
- **Steps:** each release raises `OS_ROLLBACK` by one, so an install is normally one TPM increment, a machine that skipped
  releases a few. `MAX_FLOOR_STEPS` is 64 (a year of weekly releases skipped at once); a larger gap is a release numbered
  wrongly and stops the install. Each step is one NV write. Real TPMs rate-limit NV writes and are rated for roughly
  100,000 or more of them, so a few per release is negligible wear; at a slow chip's ~100 ms per write, 64 steps fit the
  updater's 120 s `FLOOR_LIMIT`. Not measured on a real TPM.
- **A counter, not an ordinary index:** anyone with the owner authorisation (empty, as on most machines) can delete an
  index and define it again. By the TPM 2.0 specification a counter defined again starts no lower than the highest any
  counter on that TPM has reached, and a missing one is refused. On swtpm (`floor_counter_cannot_be_lowered`): deleting it
  is refused by the check; defining it again started at or above the old value; clearing the TPM left a disk that does not
  open by itself (the clear also discards the seal). **Not verified on a real TPM.** Anyone with OS access can raise it,
  which locks the machine to its recovery key: damage, not access (owner decision on owner authorisation, DECISIONS).
- **Adopted** by a disk sealed before the floor existed: once it opens, with its recovery key that once, as every update on
  such a disk needed, `medbrains-disk-floor-adopt.service` (`disk-setup floor-adopt`) defines the counter at its lowest; the
  next install raises it. A failure is a failed unit with a plain reason in the journal and on the console.
- **Reinstalling an older image** on a machine that ran a newer one starts below its floor and asks for the recovery key at
  every start: install the current release.

Chosen over `systemd-pcrlock` (predicted PCR 4 values from the firmware event log in an NV policy: experimental in systemd
257, and once found sealing the disk to a file on that disk) and over a key per release (a restored old LUKS header with
its old token opens an old boot file again: only TPM state resists that). Ordinary NV indexes: rejected, above.

### DMA and the IOMMU

`iommu.strict=1 iommu.passthrough=0`, and on x86-64 also `intel_iommu=on amd_iommu=force_isolation
efi=disable_early_pci_dma`.

- **x86-64 under QEMU with `intel-iommu`, measured:** `dmar0` present, 8 groups, "Default domain type: Translated",
  "strict mode", and the machine boots.
- **arm64 under QEMU `virt,iommu=smmuv3` (HVF), measured:** one SMMU, 4 groups, the same two lines, and it boots.
- **A VM cannot show:** that real DMA is blocked, that real devices work under strict mode, the speed cost on real
  NICs and disks, or Thunderbolt and hot plug. `amd_iommu` is untested: QEMU here was Intel.

### No TPM, including the Raspberry Pi 5

Nothing assumes a TPM. With none the machine stops and says so, and stores nothing until someone types a choice.
The Pi 5 has none by default. Its route is an add-on over SPI, or the Pi's own secure boot with a key in **OTP, which
cannot be undone**. Neither is built or tested, and no OTP was touched. Secure boot alone gives no sealed disk key.

### Disposal: destroy the key

Overwrite the LUKS2 header and key slots; the 16 MiB header area holds the only wrapped copies of the volume key.

```sh
dd if=/dev/urandom of=/dev/disk/by-partlabel/medbrains-data bs=1M count=32 conv=fsync
```

Then clear the TPM in firmware, destroy the recovery key on paper, and handle any **backups** and copies of the
env file separately. Tested: `destroying_the_key_wipes_the_disk`, on a boot with no TPM: the recovery key opens before and nothing after.
**Flash limit:** a drive may keep remapped old sectors with an old header. Only someone holding a matching recovery
key or old TPM seal could use them. Add the drive's own secure erase, or physically destroy it, for high-risk
disposal. No screen for this yet.

## Keys on a machine

| Key | Protects | Algorithm | Where | Mode | Lifetime | Rotation | Lost | Stolen |
|---|---|---|---|---|---|---|---|---|
| **Disk volume key** | Everything in `/var` | AES-256-XTS (`aes-xts-plain64`, 512-bit key), measured | LUKS2 header, wrapped by each key slot; kernel memory while open | header on `/dev/vda4` | Life of the disk | None: `cryptsetup reencrypt` exists, **no path built, not tested** | Data gone without slots | Data readable, by a copy forever |
| **TPM seal** | Opens the volume key at boot | LUKS2 `systemd-tpm2` token, SHA-256 bank, PCR 7 (Secure Boot) or 4+7, PCR 11 by signature, measured; slot uses minimal PBKDF2 (1000 rounds) because its secret is high entropy | Sealed blob in LUKS2 header; only that TPM can unseal | header | Until PCR 7 changes, or the TPM is replaced | `disk-setup reseal KEYFILE`, below | Recovery key opens the disk | Useless without that TPM |
| **Optional PIN** | Binds the seal to a person | TPM auth value, chosen at setup | In the person's head | none | Until replaced | No screen yet, **gap** | Recovery key | Needs the TPM too; lockout limits guessing |
| **Boot signing key** (`OS_PCR_KEY`) | Which boot files may open disks | RSA 2048, `systemd-measure`. Public half in every boot file | Debug: throwaway in the build folder. Release: **none exists** | | 30 days for the throwaway | Plan T2 | No signed update can open existing disks, after which the recovery key is needed | With the Secure Boot key as well, **any machine** would open for that boot file: offline only |
| **Secure Boot key** (`OS_SB_KEY`; the firmware's PK, KEK and db) | Which loaders and boot files the firmware starts | RSA 2048, `sbsign` through mkosi and ukify; certificate on the boot partition and in the firmware | Debug: throwaway in the build folder. Release: **none exists**; held like `OS_PCR_KEY`, apart from it | | Firmware ignores expiry | A KEK-signed db update, which changes PCR 7: re-seal. **Not built** | No new boot file starts on enrolled machines | Starts signed code; opens disks only with `OS_PCR_KEY` too |
| **Rollback floor** | Which systems open the disk by themselves | TPM NV monotonic counter `0x01004d42`, owner hierarchy | The TPM | | Life of the TPM | Only rises | Lost with the TPM, as is the seal | Raising it locks the machine to its recovery key |
| **Recovery key** | Opens the disk on any machine | 64 modhex characters, 256 bits, from `systemd-cryptenroll` | **Paper only**; a slot in the header | none on disk | Life of the disk | `systemd-cryptenroll --wipe-slot=recovery --recovery-key` on a running machine: no screen yet, **gap** | If the TPM also fails, data is gone; MedBrains holds no copy | Full data access from a copy. Replace it at once |
| **`JWT_PRIVATE_KEY`** | Sessions (15 min), refresh chain (7 days), step-up (5 min), portal (12 h), device tokens (30 days) | Ed25519, source (`jsonwebtoken` 10, aws-lc-rs) | `/var/lib/medbrains/config/env` | 0640 root:medbrains | Forever | **None**: no key id, no verify-with-old. Replace and every session and device token ends | Everyone signs in again; devices re-pair. No data lost | Forge any user until replaced. **High** |
| **`MEDBRAINS_IDENTIFIER_HMAC_KEY`** | Aadhaar and identifier fingerprints | HMAC-SHA256, source | same env | 0640 | Forever | **None**: fingerprints cannot be recomputed from the hash | Duplicate matching stops, permanently | Identifier values can be tested offline against stolen fingerprints |
| **`MEDBRAINS_ABDM_SECRET_KEY`** | ABDM client secret, link tokens, transfer keys, UHI signing key, sealed in the database | AES-256-GCM, key from HKDF-SHA256, random 96-bit nonce, source | same env | 0640 | Forever | **None** | Re-enter those secrets with ABDM | Those secrets, given the database |
| **`MEDBRAINS_NHCX_SECRET_KEY`** | NHCX client secret and private key, sealed | Same AEAD, source | same env | 0640 | Forever | **None** | Re-enter | Those secrets, given the database |
| **`MEDBRAINS_PACS_SECRET_KEY`** | PACS password, sealed to tenant, host and user | AEAD by `medbrains-crypto`, source, call not read | same env | 0640 | Forever | **None** | Re-enter | That password, given the database |
| **`MEDBRAINS_EVENT_TOKEN_KEY`** | QR and barcode tokens | AES-GCM, source | same env (new, see gaps) | 0640 | Forever | **None** | Printed codes stop working | Forge or read tokens |
| **`MEDBRAINS_SIGNATURE_KEY_ENCRYPTION_KEY`** | Wraps doctors' signing keys | AEAD, source | same env (new, see gaps) | 0640 | Forever | **None** | Signing keys unusable, doctors re-enrol | Sign as a doctor, given the database |
| **`MEDBRAINS_OAUTH_TOKEN_KEY`** | SSO and connected-account tokens, sealed | AES-GCM, source | same env (new, see gaps) | 0640 | Forever | **None** | Reconnect accounts | Those tokens, given the database |
| **Database passwords** (owner, `medbrains_app`, worker) | Local database login | 32 alphanumeric, stored as SCRAM-SHA-256, measured | Same env, three `*_DATABASE_URL`; verifiers in PostgreSQL | 0640 | Forever | Manual `ALTER ROLE` plus env edit; nothing automates it | Reset as `postgres` by peer auth; no data lost | Database access from this machine only (loopback, firewall) |
| **First admin password** | First sign-in | Chosen by a person at setup; only its Argon2 hash goes into the env as `MEDBRAINS_SEED_*`, removed once the server has read it | env, briefly | 0640 | Until changed | Password change | **No recovery path yet** (§8k) | Offline guessing while the line exists |
| **User passwords** | Sign-in | Argon2 with crate defaults, source | Database | RLS | User set | Password change | Reset | Offline guessing |
| **API keys** | Machine access | 256-bit random, unsalted SHA-256 at rest, source | Database | RLS | Until revoked | Revoke and create | Create new | Hash only; high entropy, so guessing is not practical |

### Checked when loaded

A key is checked before it is used, and a bad one is refused, never warned about
(`crates/medbrains-crypto/src/keys.rs`; the eMudhra CA incident is why):

- **JWT pair**: parsed with OpenSSL (PKCS#8 private; SPKI or raw 32-byte public),
  the seed must derive the public key, and a probe token is signed and verified
  with `jsonwebtoken`. Any failure stops the server with
  `refusing to start: JWT_PRIVATE_KEY does not belong to its public key ...`.
  The fingerprint (`SHA256:` + 16 hex) is logged at start-up, never the key.
  `install.sh` makes the same check with OpenSSL (`deploy/standalone/jwt-keys.sh`).
- **Sealing keys**: `secrets::sealing::sealing_key` only. The development value in
  the source is used only when the key is unset and `MEDBRAINS_ENV=development`.
- **Doctor signing keys**: the unsealed seed must derive the credential's stored
  public key; each signature is verified before it is written. A plaintext key
  from before May 2026 is used only under the same proof and is sealed in place
  the first time it signs. A sealed key that will not open means
  `MEDBRAINS_SIGNATURE_KEY_ENCRYPTION_KEY` changed: restore it from the backup.
- **Fidelius**: peer keys are a raw point or SPKI on exactly this curve (explicit
  parameters, or BouncyCastle's curve25519 OID, which OpenSSL cannot name and a
  strict DER walk accepts), never at
  infinity, off the curve or outside the prime-order subgroup; a reopened private
  scalar must be `1 ≤ d < n` and derive its stored public point.

New raw-key handling outside `keys*` fails `make check-raw-key-bytes`.

## Certificates

| Certificate | Protects | Algorithm | Where | Mode | Lifetime | Renewal | Lost | Stolen |
|---|---|---|---|---|---|---|---|---|
| **Caddy local root** | Trust for this box's LAN certificates | ECDSA P-256, measured | `/var/lib/caddy/.local/share/caddy/pki/authorities/local/root.key` | 0600 caddy | 10 years, measured, source | None. Caddy remakes one only if it is gone | New root; anyone who had trusted the old sees a warning | Issue for any name, against anyone who trusted it. **No client is told to trust it yet**, so today every browser warns |
| **Caddy intermediate** | Signs leaf certificates | ECDSA P-256, measured | same folder | 0600 caddy | 7 days, measured, source | Caddy renews itself | Remade | As root, for days |
| **LAN leaf** (on demand) | `https://<name>` from other computers | ECDSA P-256 chain, TLS 1.3 with X25519 or P-256 | `certificates/local/<name>/` | 0600 caddy | 12 hours, measured, source | Caddy renews itself | Remade | Hours |
| **Loopback front** | The screen's kiosk to `127.0.0.1:8443` | ECDSA P-256, self-signed, measured | `/var/lib/caddy/local/{key,cert}.pem`; public copy `/var/lib/kiosk/local-front.pem` | key 0600 caddy; copy 0644 | **20 years**, measured | None: remove and let first boot remake it; first boot only makes one if it is missing | Screen shows a certificate error; first boot's condition stops it being remade: **gap** | Pretend to be the front to local processes only (loopback) |
| **Public roots** | Outbound TLS and NTS checks | System bundle | `/etc/ssl/certs`, on the system partition | 0644 | Debian updates | Package update | Outbound TLS fails | Public data; the risk is **adding** one: system partition is writable until verity |

## Algorithms in use: what we checked

| Claim | Evidence | Answer |
|---|---|---|
| Caddy (Debian 2.6.2-12+deb13u1) negotiates X25519MLKEM768 | `openssl s_client -groups X25519MLKEM768 -tls1_3` (OpenSSL 3.5.7) against 443 and 8443 on the booted image: **handshake failure, alert 40**. X25519 and P-256 succeed. Caddy 2.6.2's `defaultCurves` is `X25519, CurveP256` ([source](https://github.com/caddyserver/caddy/blob/v2.6.2/modules/caddytls/values.go)) | **No.** LAN and screen TLS have no post-quantum key exchange. Fixing it needs a newer Caddy than Debian trixie ships |
| rustls negotiates X25519MLKEM768 (server's outbound HTTPS) | rustls 0.23.46 in `Cargo.lock`; its `aws_lc_rs` `DEFAULT_KX_GROUPS` includes X25519MLKEM768, first when `prefer-post-quantum` is on; `cargo tree` shows that feature on, by way of an AWS SDK crate | **Source says yes; not observed on the wire.** The feature arrives through an unrelated dependency, so a dependency change could silently move it down the list. Provider is reqwest's aws-lc-rs fallback, with no `install_default` call |
| Chrony NTS | chrony 4.6.1, GnuTLS 3.8.9, measured. `chronyc -N authdata`: three NTS sources, AEAD 30 (AES-128-GCM-SIV) and 15 (AES-SIV-CMAC-256) | Works. **Post-quantum NTS-KE unverified.** Serving the LAN is plain NTP, unauthenticated |

Every TPM result here came from swtpm on x86-64 under emulation, with a stand-in server: evidence about the logic,
not about real chips; the real server was exercised on arm64's no-TPM path. Side channels and firmware TPMs were not checked.

## Gaps, most serious first

1. **A stolen machine without a PIN or Secure Boot is not fully protected.** Verity now refuses a changed system partition
   (`OS-VERITY.md`), but with Secure Boot off our boot file accepts a command line from a boot entry an attacker adds, and that
   lands in PCR 12, outside the seal. With Secure Boot it is ignored, tested in a VM; enrolling our keys on real machines
   (plan X2) and release keys (T1) are open, so **every real machine today takes the Secure Boot off path**.
2. **No key rotation anywhere.** JWT, HMAC and every sealing key are forever. A stolen `env` is permanent
   until each is rotated, and rotation has no code. Plan T2.
3. **Keys in one plaintext file once the disk is open.** Any root process or a read of `/var/lib/medbrains`
   gets them all. `systemd-creds` sealing per service is designed in OS-SETUP-AND-TRUST §7, not built.
4. **Sealed values under the old development keys.** `install.sh` now generates the event token, signature and OAuth
   keys and production refuses to start without them, but a host that ran before keeps nothing it sealed under the
   development keys: doctors re-enrol signing keys and accounts reconnect. No re-seal job exists.
5. **Secrets backend is reached by accident.** `os/` sets no `MEDBRAINS_SECRETS_BACKEND` or
   `MEDBRAINS_DEPLOY_MODE`, so the appliance takes the `saas` default and gets env through a fallback.
6. **A machine fitted with a TPM later** stays on its empty key until someone enrols: the volume key stays what
   it was, and old copies stay open.
7. **Debian arm64 has no MMIO TPM driver** (`CONFIG_TCG_TIS` off), so the sealed path cannot run under QEMU on
   arm64. A Raspberry Pi add-on uses SPI, for which `tpm_tis_spi` exists: **not tested**, and no device tree
   overlay is shipped. Every Pi today takes the no-TPM path.
8. **No passphrase on a machine with no TPM.** It can only stop or go unencrypted. Owner decision.
9. **On-demand TLS with no `ask`** issues for any name asked, 10 a minute, slowly filling the disk under attack.
    The 20-year loopback certificate has no renewal, though only this machine can reach it.

## How to re-seal or replace a key

All need the disk open and a root shell,
which the appliance does not offer yet (T2, §8k).

```sh
PART=/dev/disk/by-partlabel/medbrains-data
systemd-cryptenroll "$PART"                                  # list key slots
# After a board or TPM change. Two steps inside: in one, cryptenroll finds the same policy enrolled and does
# nothing, though that TPM has gone. Tested: reseal_to_new_tpm.
/usr/lib/medbrains/disk-setup reseal <file with the recovery key>   # checks the key first; drops any PIN
# New recovery key; prints it once.
systemd-cryptenroll --unlock-tpm2-device=auto --wipe-slot=recovery --recovery-key "$PART"
# Late TPM on a disk set up unencrypted: first a recovery key, which prints once. Then seal, and remove the empty
# key. Then write encrypted-tpm2 into the record. The volume key stays the same: old copies stay open.
systemd-cryptenroll --unlock-key-file=/dev/null --recovery-key "$PART"
systemd-cryptenroll --unlock-key-file=<file with that key> --tpm2-device=auto --tpm2-pcrs=4+7 --wipe-slot=empty "$PART"
```

With Secure Boot enforced, use `--tpm2-pcrs=7` there; `disk-setup reseal` picks for itself. With Secure Boot off, a new
boot file changes PCR 4: the disk asks for the recovery key once, and needs re-sealing. Turning Secure Boot on changes PCR 7:
the same, once, after which `reseal` seals to PCR 7 and signed 11.
To test a typed key, use `cryptsetup --disable-external-tokens`: otherwise the TPM token opens it and any key seems to work.
`systemd-pcrlock` is disabled: it writes a policy into `/var` that cryptenroll then picks up by itself, sealing the
disk to a file on that disk. A test found this: the disk would not open.

## Failure table (OS-PRINCIPLES section 7)

| What fails | Effect | Detected by | What the machine does | Test |
|---|---|---|---|---|
| No TPM at first boot | Cannot seal | `/dev/tpmrm0` absent after udev settles | Stops and asks: turn off, or type `STORE UNENCRYPTED`. Nothing stored until then | `no_tpm_can_turn_off` |
| Person chooses unencrypted | Data readable from any copy | Typed choice; empty-key slot; `disk-protection` record | Stores data and records it; the top bar says "This disk is not encrypted" at every boot | `no_tpm_records_the_choice` |
| Boot file changed | PCR 4 and 11 differ | Unseal fails | Same screen as a copied disk; restoring the file opens it | `changed_boot_file_stays_locked` |
| PIN wrong or forgotten | | Unseal fails | Two wrong tries, then it asks for the recovery key, which opens it; a key typed before that counts as a wrong PIN. A restart asks for the PIN again | `recovery_key_opens_a_pin_machine` |
| Power cut after the key is saved and before the record | The seal may need a PIN nobody can vouch for | Marker with no record | Disk asks; the saved recovery key opens it; setup asks for it again, re-seals, records what the seal is | `power_cut_during_pin_setup_recovers` |
| Disk copied to another machine | TPM refuses | Unseal fails | Prompt on the screen, with a notice after 20 s. `/var` not mounted; no service starts | `copy_stays_locked` |
| Recovery key lost **and** TPM gone | **Data lost** | Nothing opens | Stays at the prompt. Restore from backup; no backup exists until D2 | none: by design |
| Power cut during partition creation | Half-written | repart writes the table last | Next boot starts over | Reasoned from repart's design, **not injected**: timing not reliably reachable. F3 |
| Power cut with the key on screen | Key may be unsaved | No `disk-protection` record | Next boot wipes the slot and shows a new key; old one stops working | `power_cut_replaces_unconfirmed_key` |
| Key slots unreadable, or a recovery key cannot be made | No way back if the TPM fails | Exit status, and an empty-key slot required before recording unencrypted | Plain message stays on screen; no secrets written; the screen unit does not start | `failed_disk_step_stops_first_boot_visibly`, `os/tests/disk-setup.sh` |
| Partition creation fails, disk full or TPM error | No data disk | repart's exit status | Message and reason on screen; boot waits with no device | Not injected: gap |
| PCR 4 or 7 changes: firmware or db update, a boot file update with Secure Boot off, Secure Boot turned on | Seal no longer matches | Unseal fails | Same as a copied disk: asks for recovery key. Re-seal, above | Same path as `copy_stays_locked` |
| A new boot file signed with our keys, Secure Boot on | PCR 7 and signed 11 still match | | Opens by itself, at every start | `sealed_update`, `power_cuts_applying` (x86-64 swtpm) |
| A system below the rollback floor starts | Older signed code | `floor-check`, before the unlock | PCR 11 extended: asks for the recovery key; a trial nobody answers rolls back | `floor_refuses_older_system`; `os/tests/disk-setup.sh` |
| Floor counter missing, deleted or unreadable | Old can't be told from new | `floor-check` | Treated as below the floor. A disk sealed before the floor adopts one once open | `os/tests/disk-setup.sh` |
| Floor can't be raised: TPM fault, or a gap over 64 | Older versions would keep opening | `floor-raise` exit status | First boot stops before any data; an install stops before writing | `os/tests/disk-setup.sh` |
| The floor check fails, including when it can't extend PCR 11 | Could open for an older system | Unit exit status | The unit fails, so the unlock that requires it does not run: the disk stays locked | `failed_floor_check_keeps_disk_locked` (x86-64 swtpm), `os/tests/disk-setup.sh` |
| Firmware also trusts a certificate other than ours | PCR 7 would not prove our boot chain | `seal-pcrs` reads PK, KEK, db | Sealed with PCR 4 + 7 | `seal_matches_trusted_keys` with a vendor db (x86-64), `secure_boot_tests.rs` |
| Floor adopt fails | The next start asks for the recovery key | Unit exit status | Failed unit, reason in the journal and on the console | `os/tests/disk-setup.sh` |
| Recovery key leaks into logs | Full data access | `grep` of journal and raw disk | Never written: stderr discarded, stdout captured in the shell only | `recovery_key_not_logged`, `raw_disk_shows_nothing` |

Tests are in `crates/medbrains-os-test/src/disk.rs`.
