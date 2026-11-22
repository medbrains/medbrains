# RFC: Deployment models, AWS first

**Status:** Plan (owner, 2026-11-22: of all deployment models, AWS comes first) · **Related:**
`RFC-ONE-RELEASE-LEGO-BRICKS.md`, `RFC-HOSPITAL-OS.md`, `deploy/standalone/README.md`,
`docs/SECURITY-RELEASE-PROCESS.md` · **Recipe:** `deploy/cloud-image/` (separate PR)

## The rule

There is **one signed release**. A deployment model is a wrapper around that release: never a fork,
never its own build. A model is called **supported only while its conformance test passes on that
release**. Anything else is listed as "to be built" or "untested on this release", in the release
notes and on the website alike.

The conformance test is the same for every model: install release FROM, record a day's work, update
to release TO, check the work, roll back, roll forward, check again. Only the "box" changes (a
container, a kind cluster, a virtual machine, a cloud instance). One script with a driver per box; no
framework.

## The five models

| # | Model | What it is | Today | Conformance box |
|---|---|---|---|---|
| 1 | Installer on Linux | `deploy/standalone/install.sh` on a stock Debian or Ubuntu server | Works; runs a hospital | Debian 13 systemd container (the staging update test, in review) |
| 2 | MedBrains OS | The appliance image for bare metal and hypervisors | Works on QEMU/KVM, UTM, Raspberry Pi 5; cloud and VMware files are built, never booted there | `os/tests` on QEMU |
| 3 | Containers | The release image under Compose or Podman | Image is API only (no web files) and no test starts it | The release image, in CI |
| 4 | Kubernetes | The Helm chart | Untested skeleton | kind cluster |
| 5 | Cloud images and marketplaces | A cloud's machine image, made from model 1 | Missing; this RFC | An instance launched from the image |

By the rule above, only model 1 may be called supported today, and model 2 on the machines its tests
boot.

## Two image families

Marketplaces want a stock distribution and remote access their scanner can use; the appliance has
neither by design (no SSH, a sealed data disk, setup on its own screen). So there are two families,
both made from the one signed release:

| Family | Made of | For | Listed on marketplaces |
|---|---|---|---|
| **Cloud image** | Stock distribution image + the signed release + the standalone kit; secrets made at first boot | AWS, then Azure, DigitalOcean, Google Cloud | Yes |
| **MedBrains OS** | The appliance image (`os/`) | Bare metal, Proxmox, VMware, Hyper-V, and "bring your own image" imports into a cloud account | No |

The cloud image is model 1 baked, so a cloud hospital and an on-premises kit hospital run the same
install script and take the same updates.

## Order

1. **AWS cloud image, then a Free AWS Marketplace listing** (this RFC).
2. Containers: put the web files in the image, prove Compose and Podman.
3. Kubernetes: the Helm chart proven on kind, published as a signed chart.
4. Azure, DigitalOcean, Google Cloud: the AWS recipe with another builder block and that cloud's scan.
5. Separately, and not blocking the above: setup with no screen for MedBrains OS, which turns its
   already-built hypervisor and cloud files from "built" into "works".

## What we will not do

| Not doing | Why |
|---|---|
| MedBrains OS on a marketplace | Scanners need SSH and an unsealed disk; three of four marketplaces require a stock distribution base |
| A fork or a separate build per cloud | Breaks the one-release rule; multiplies tests, signatures and support |
| Anything secret in an image: keys, passwords, tokens, a default login | Every clone would share it; marketplaces refuse it |
| A setup page open to the internet with no gate | Whoever finds the address first becomes the administrator of a hospital system |
| Compiling on the instance, or patching an image in place | An image is rebuilt from a release; a running machine updates through the signed update path |
| A paid or bring-your-own-licence listing now | Free needs no bank or tax setup; the other two can follow |
| A Kubernetes operator of our own, or a database bundled in the chart | Not needed to prove model 4 |

## AWS image

### Base

The **official Debian 13 AMI** published by the Debian project, the most recent one at build time,
for **arm64 and x86-64** (two AMIs from one recipe). Debian 13 because the kit's PostgreSQL 17 path
and the staging test already run on it. Nothing in the base is replaced: kernel, cloud-init, SSH and
package sources stay Debian's.

### Build recipe

Packer's `amazon-ebs` builder starts a small build instance from the Debian AMI, uploads four files
and the kit taken from the release's own git tag, and runs one script, `bake.sh`, as root:

1. Apply Debian's pending updates.
2. Download the release's two tarballs, `SHA256SUMS` and its signature from the public release.
3. **Verify before anything is unpacked:** `cosign verify-blob` on `SHA256SUMS` with the exact
   signer identity (the release workflow at that tag, GitHub's OIDC issuer; never a pattern), then
   SHA-256 of both tarballs against it. A mismatch stops the build.
4. Install the packages the kit's `install.sh` would otherwise fetch, and PostgreSQL 17 from the
   kit's own pinned repository function, with cluster creation switched off.
5. Unpack the kit and the release into a root-only folder.
6. Install the SSH settings and the first-boot unit.
7. Seal the disk, then run the seal check; the build fails if the check finds anything.

Packer then stops the instance, makes the AMI and deletes the instance, its temporary key pair and
its temporary security group. Packer rather than a hand-written script: the lifecycle around the
build (start, wait, connect, snapshot, and clean up when a step fails) is where a script leaks
running instances; everything inside the machine stays plain shell that the local test runs as is.

### Baked, and made at first boot

| Baked into the image (same on every machine) | Made on each machine at first boot |
|---|---|
| Debian 13 with updates | SSH host keys and the machine id (by cloud-init and systemd) |
| The verified release: server programs and web files | Database cluster, the database owner's password and the three database roles |
| The standalone kit, from the release's tag | JWT signing key pair |
| PostgreSQL 17 and other packages, no cluster | The seven application keys (identifier HMAC, exchange secrets, event token, signature, OAuth) |
| SSH settings, the first-boot unit, the seal check | The first administrator's password |
| | The backup key pair, and a new local TLS key for PostgreSQL |

**Nothing secret is baked.** `install.sh` is what creates secrets, so it does not run during the
build; it runs on each machine's first boot. The seal removes host keys, the machine id, every
`authorized_keys`, shell history, logs, cloud-init state, package lists, the build's temporary files,
and the private key a PostgreSQL dependency creates when it is installed.

### Remote access

- SSH with **the launcher's key pair only**, as Debian's `admin` user with `sudo`. cloud-init
  installs that key at launch; the image holds none.
- No password login for anyone, no root login over SSH, root's password locked. No default account
  or password exists in the operating system or in MedBrains.
- AWS Systems Manager Session Manager also works if the launcher attaches the role; it is not
  required.

### Security group

| Port | Open to | Why |
|---|---|---|
| 443 | The hospital's networks, or the internet | The application |
| 80 | The internet | Let's Encrypt certificate issue and renewal only; it serves nothing else |
| 22 | The operator's own address only | Setup and administration; never `0.0.0.0/0` |

PostgreSQL and the application's own port listen on loopback only and need no rule. The listing's
recommended security group opens 443 and 80, and SSH restricted to an address the launcher types.

### First-administrator protection (owner decides)

A new instance has a public address and no screen. Whoever completes setup first owns the hospital's
system, so setup must be tied to something only the launcher has.

| Option | How it works | For | Against |
|---|---|---|---|
| **A. Private until the operator says so** (the recipe today) | First boot makes the secrets and starts the server on loopback only. Nothing answers on 443 until the operator signs in with the launch key and runs `sudo medbrains-cloud-setup <domain> <email>`. The first administrator's password is random, in a root-only file | No public window at all; no new server code; it is the kit path hospitals already run; the gate is the SSH key AWS itself guards | Needs one SSH (or Session Manager) session; a hospital with no IT person needs help for that step |
| B. One-time setup code | A setup page is public from first boot. A long random code sits in a root-only file (and optionally the instance console output). The page refuses without it; it works once and expires in 24 hours | Setup mostly in the browser | New public code before any login exists (page, rate limit, expiry) to write and attack-test; before a domain there is no trusted certificate, so the code and first password travel over a connection the browser cannot verify; console output is readable by any account user allowed to read it and is kept by AWS |
| C. Instance id as the first secret | The page asks for the instance id | Familiar to AWS users; no SSH | An instance id is not a secret: it is in logs, bills, tags and support tickets, and every user of the account can list it. AWS only |
| D. Setup page over an SSH tunnel | The page listens on loopback; the operator opens `ssh -L` and uses a browser | No public window | Harder than option A's one command for the same protection; already possible under A |

**Recommendation: A.** It is the only option with no public window and no new code, and it is what
the recipe does today. If hospitals find the SSH step a barrier, add B later with the code in the
root-only file only (not the console), after an attack test. C is not recommended.

Under every option the first administrator's password is changed at first sign-in and its file is
then deleted; making the server force that change is an open item.

### Updates

The same path as every kit host: download the release, verify the signature with the exact signer
identity and the checksums, stage it root-only, run that release's `install.sh`; `medbrains-rollback`
goes back. A web-only patch uses the web-patch lane of `RFC-ONE-RELEASE-LEGO-BRICKS.md` once it
lands. Debian security updates are applied unattended by the kit.

A new AMI is built for each release so new launches start current. A running hospital is **never**
updated by replacing its instance: its data is on its volume.

### Backups

- The kit's nightly database dump, sealed to the hospital's own key, runs from first boot into
  `/var/backups/medbrains`. That is the same disk: it survives a dropped table, not a lost volume.
- Off-site: the operator passes an S3 bucket as the third argument of `medbrains-cloud-setup` and
  attaches an instance role that may write to it. No access key is stored on the machine.
- The backup private key is made on the machine at first boot and must be moved offline; the kit
  says so on screen. A hospital can instead supply its own public key.
- EBS snapshots (AWS Backup) are a second layer, not a replacement: they are not sealed to the
  hospital's key.

### AWS Marketplace scan: each requirement and how it is met

Read from AWS's AMI product policies on 2026-11-22; to be re-read at submission.

| Requirement | How it is met |
|---|---|
| No default or baked passwords; password login off | `sshd` drop-in read first; root locked; the seal check reads `/etc/shadow` and the SSH settings |
| No `authorized_keys`, private keys or credentials in the image | Seal, then the seal check searches for them |
| Root login over SSH disabled; access through a user with `sudo` | `PermitRootLogin no`; Debian's `admin` user |
| SSH reachable by the scanner | Debian's `sshd`, unchanged, on 22 |
| A supported operating system with current patches | Official Debian 13 AMI, updated during the build |
| IMDSv2 | AMI registered as IMDSv2-only |
| Unencrypted, EBS-backed, HVM, 64-bit, ENA | Debian's AMI properties; `encrypt_boot = false` (a hospital encrypts its own volume at launch) |
| Source AMI in us-east-1, in the seller account | The listing build runs with `region=us-east-1` |
| No shell history, logs or build leftovers | Seal |
| Usage instructions that reach a working product | Text below |

The seal check makes the scanner's secret checks before the AMI exists and tests itself
(`seal-check.sh --self-test` plants each kind of leftover and expects a refusal). AWS's own "test
this version" scan is still the judge.

### Usage instructions for the listing

> 1. Launch the instance with your own key pair. Recommended: 4 GB of memory or more, a 40 GB or
>    larger encrypted gp3 volume, and a security group that opens 443 and 80, and 22 from your own
>    address only.
> 2. Give the instance an Elastic IP address and point your domain's DNS record at it.
> 3. Wait a few minutes for first boot. Sign in: `ssh admin@<address>` with your key pair. There
>    is no password.
> 4. Run `sudo medbrains-cloud-setup <your-domain> <your-email>`. This issues the certificate and
>    opens the application on `https://<your-domain>`. Until you run it, MedBrains answers only on
>    the machine itself.
> 5. Read the first administrator's password with `sudo cat /etc/medbrains/initial-admin-password`,
>    sign in at `https://<your-domain>`, change the password, then delete that file.
> 6. Move the backup key at `/root/medbrains-backup-identity.txt` to two offline places and remove
>    it from the server. Without it no backup can be opened.
> 7. MedBrains software is free and open source (Apache-2.0). You pay AWS for the instance, storage
>    and network.

### Regions

**Mumbai (`ap-south-1`) first** for the build and test in our own account and for the first
hospitals. A Marketplace submission is built in `us-east-1`, which AWS requires, and AWS copies it to
the regions the listing names: Mumbai and Hyderabad to begin with, others on request. Whether a Free
listing from an India seller is visible worldwide is not confirmed; ask AWS Seller Operations.

### Cost notes (estimates, on-demand prices, to be checked on the bill)

| Item | Estimate |
|---|---|
| One build: a small instance for about 15 minutes, a 20 GB volume, a public address | under USD 0.05 |
| One test launch for an hour | under USD 0.05 |
| Keeping an AMI: its snapshot (about 5 GB stored) | about USD 0.25 a month per region and architecture |
| A small hospital: 4 GB arm64 instance, 40 GB gp3, one public address, in Mumbai | about USD 25 a month, before backups and traffic |
| Marketplace Free listing | no listing fee |

### Conformance for this model

1. Locally, no AWS: `deploy/cloud-image/test-local.sh` bakes in a Debian 13 container with the real
   signature check, runs the seal check on the stopped image, and boots two clones that must each
   reach health on loopback only with no secret in common.
2. In AWS, owner-gated: build the AMI, launch it, run the staging update test over SSH, run AWS's
   scan. Nothing is launched in any account without the owner's go.

### Open items

- The kit is taken from the release's git tag; it is not a file on the release and so not covered by
  `SHA256SUMS`. Publishing it as a signed release file closes that.
- First boot uses the kit's attach mode to start without a certificate. A flag of its own in
  `install.sh` is cleaner; it must ship in a release with no other installer change.
- Not yet run in AWS: the Packer build, cloud-init's key regeneration on the sealed AMI, the
  certificate step, and AWS's scan.
- The server does not yet force a password change at the first administrator's first sign-in.
