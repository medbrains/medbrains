# MedBrains OS: keys, secrets and certificates

What is on the image today, from the code and booted arm64 and amd64 debug images (2026-11-04). An inventory, not
a design: root, machine and licence keys are plan T2. A key not listed here is a gap in this document.

"Measured": seen on a booted image. "Source": read in code we ship. "Unverified": neither.

## What the disk encryption does and does not protect

The data partition is `/var`: the database, secrets, files, logs. It is LUKS2, created on first boot, so no
plaintext copy of it ever exists (`os/mkosi.extra/usr/lib/medbrains/disk-setup`).

The seal is **PCR 4 and 7, and PCR 11 by signature when the image is signed**. **In one line: this protects a disk that
has left the machine. Without a PIN it does not protect a stolen machine from someone able to change its disk.**

| Attack | Result today | Evidence |
|---|---|---|
| Disk removed or copied, read or booted elsewhere | **Stopped** without the recovery key. Marker and JWT key absent from the raw disk | `raw_disk_shows_nothing`, `copy_stays_locked` |
| Stolen machine booted from an attacker's own system | **Stopped by PCR 4, tested.** Before that the disk **opened**: with Secure Boot off PCR 7 is the same under any system, and PCR 11 can be extended by hand to the published values and the signature replayed. Measured on swtpm | `stolen_machine_replay_refused`, with a control that still opens without PCR 4 |
| Boot file (UKI) changed | **Stopped:** PCR 4 and PCR 11 both change | `changed_boot_file_stays_locked` |
| Kernel command line edited | **Menu and editor off**, tested by file only; **not sealed:** PCR 12 changed between normal cold boots, so a machine stopped opening itself. Starting a firmware shell first changes PCR 4 | `boot_editor_off`, anomaly in DECISIONS |
| Passive sniffing of the TPM bus | **Stopped.** Unseal runs in a salted HMAC session with response encryption, on by default | Below |
| Active interposer on the TPM bus, no PIN | **Not stopped.** systemd says so in its source. A PIN closes it | Below |
| System partition edited, then booted in this machine | **Not stopped without a PIN, tested.** Same loader and boot file, so PCR 4 matches and the TPM opens the disk for whatever runs. The same goes for those files copied to a USB stick with another system partition (reasoned, not run). **Only verity and Secure Boot close this. A PIN does, today** | `known_gap_system_partition_edit_opens` |
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
| Active interposer on the TPM bus | Can get the key | Needs the PIN too; wrong guesses hit the TPM's lockout |

Setup asks once, at first boot; Enter means no PIN. Recorded as `encrypted-tpm2` or `encrypted-tpm2-pin`. A ward
with no system until someone types a PIN carries its own patient risk, so no PIN is the default.

**FIDO2 key: not built.** `systemd-cryptenroll --fido2-device=auto` can do it; a VM cannot test a real key.

### Binding to the signed boot image

`build.sh` signs the boot file's expected PCR 11 values with `OS_PCR_KEY`; mkosi and `systemd-measure` embed the
signature, and the stub puts it in `/run/systemd`. `disk-setup` seals to that public key when it is present.
**PCR 11 alone protects nothing with Secure Boot off**, as the attack above shows. PCR 4 is what stops it, and PCR 4 holds
the boot file's own hash, so **any new boot file needs a re-seal until Secure Boot lands**; the A/B update path must plan for it.

- **Key today:** debug images make a throwaway. **No release key exists, so a release image is not signed.** Holding the key
  is plan T2, offline.
- **Shown on swtpm:** the replay is refused and its control opens, a changed boot file is refused, restoring it opens again.
- **swtpm cannot show:** real firmware's PCR 4 and 7 across updates (one recovery-key prompt expected), real TPM timing, any
  physical attack.

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
| **TPM seal** | Opens the volume key at boot | LUKS2 `systemd-tpm2` token, SHA-256 bank, PCR 7, PCR 11 by signature, measured; slot uses minimal PBKDF2 (1000 rounds) because its secret is high entropy | Sealed blob in LUKS2 header; only that TPM can unseal | header | Until PCR 7 changes, or the TPM is replaced | `disk-setup reseal KEYFILE`, below | Recovery key opens the disk | Useless without that TPM |
| **Optional PIN** | Binds the seal to a person | TPM auth value, chosen at setup | In the person's head | none | Until replaced | No screen yet, **gap** | Recovery key | Needs the TPM too; lockout limits guessing |
| **Boot signing key** (`OS_PCR_KEY`) | Which boot files may open disks | RSA 2048, `systemd-measure`. Public half in every boot file | Debug: throwaway in the build folder. Release: **none exists** | | 30 days for the throwaway | Plan T2 | No signed update can open existing disks, after which the recovery key is needed | **Any machine** would accept that boot file: offline only |
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

1. **A stolen machine without a PIN is not protected.** See the top: nothing measures the system partition, so changed files there run with the disk open.
   Verity and Secure Boot remain open in plan T1, and no release signing key exists.
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

A new boot file, or Secure Boot turned on, changes PCR 4 or 7: the disk asks for the recovery key once, and needs re-sealing.
To test a typed key, use `cryptsetup --disable-external-tokens`: otherwise the TPM token opens it and any key seems to work.
`systemd-pcrlock` is disabled: it writes a policy into `/var` that cryptenroll then picks up by itself, sealing the
disk to a file on that disk. A test found this: the disk would not open.

## Failure table (OS-PRINCIPLES section 7)

| What fails | Effect | Detected by | What the machine does | Test |
|---|---|---|---|---|
| No TPM at first boot | Cannot seal | `/dev/tpmrm0` absent after udev settles | Stops and asks: turn off, or type `STORE UNENCRYPTED`. Nothing stored until then | `no_tpm_can_turn_off` |
| Person chooses unencrypted | Data readable from any copy | Typed choice; empty-key slot; `disk-protection` record | Stores data and records it; the top bar says "This disk is not encrypted" at every boot | `no_tpm_records_the_choice` |
| Boot file changed | PCR 4 and 11 differ | Unseal fails | Same screen as a copied disk; restoring the file opens it | `changed_boot_file_stays_locked` |
| PIN wrong or forgotten | | TPM | Asks again. The recovery key works at the same prompt, also after 34 wrong PINs | `recovery_key_opens_a_pin_machine` |
| Power cut after the key is saved and before the record | The seal may need a PIN nobody can vouch for | Marker with no record | Disk asks; the saved recovery key opens it; setup asks for it again, re-seals, records what the seal is | `power_cut_during_pin_setup_recovers` |
| Disk copied to another machine | TPM refuses | Unseal fails | Prompt on the screen, with a notice after 20 s. `/var` not mounted; no service starts | `copy_stays_locked` |
| Recovery key lost **and** TPM gone | **Data lost** | Nothing opens | Stays at the prompt. Restore from backup; no backup exists until D2 | none: by design |
| Power cut during partition creation | Half-written | repart writes the table last | Next boot starts over | Reasoned from repart's design, **not injected**: timing not reliably reachable. F3 |
| Power cut with the key on screen | Key may be unsaved | No `disk-protection` record | Next boot wipes the slot and shows a new key; old one stops working | `power_cut_replaces_unconfirmed_key` |
| Key slots unreadable, or a recovery key cannot be made | No way back if the TPM fails | Exit status, and an empty-key slot required before recording unencrypted | Plain message stays on screen; no secrets written; the screen unit does not start | `failed_disk_step_stops_first_boot_visibly`, `os/tests/disk-setup.sh` |
| Partition creation fails, disk full or TPM error | No data disk | repart's exit status | Message and reason on screen; boot waits with no device | Not injected: gap |
| PCR 4 or 7 changes: firmware or boot file update, Secure Boot turned on | Seal no longer matches | Unseal fails | Same as a copied disk: asks for recovery key. Re-seal, above | Same path as `copy_stays_locked` |
| Recovery key leaks into logs | Full data access | `grep` of journal and raw disk | Never written: stderr discarded, stdout captured in the shell only | `recovery_key_not_logged`, `raw_disk_shows_nothing` |

Tests are in `crates/medbrains-os-test/src/disk.rs`.
