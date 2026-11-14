---
title: Install the server on Linux
sidebar_label: Linux server
sidebar_position: 2
description: "Install the MedBrains server and web app on your own Ubuntu or Debian server with the standalone kit: PostgreSQL 17, TLS, generated keys, checks and backups."
---

# Install the server on Linux

**Who:** a Linux administrator who runs MedBrains on a server of their own,
instead of the [OS appliance](/install/os/).
**You need:**

- a clean **Ubuntu 22.04 or 24.04, or Debian 12** server with root access,
  4 cores or more;
- a DNS name for it (for example `hms.example-hospital.org`) pointing at the
  server, with ports **80 and 443** reachable, so Let's Encrypt can issue a
  certificate;
- the release files for your processor, [verified](/install/verify-a-download/);
- a copy of the MedBrains repository, for the `deploy/standalone` kit.

The kit, `install.sh`, installs Docker, runs PostgreSQL 17 in a container on
localhost, installs the server as a systemd service behind the MedBrains edge
proxy, gets a TLS certificate, generates every key, and sets up sealed
backups. Running it again is safe: it picks up where it left off.

## 1. Make your backup key first

Backups are encrypted to an [age](https://age-encryption.org) public key. The
matching private key never goes on the server. Make it on another computer:

```bash
age-keygen -o medbrains-backup.key            # prints "Public key: age1..."
age -p -o medbrains-backup.key.age medbrains-backup.key
rm medbrains-backup.key
```

Keep `medbrains-backup.key.age` in two safe places, and its passphrase apart
from it. Without both, no backup can be read.

Then put **your** public key in the kit, replacing the line that is there:

```bash
echo "age1...your-public-key..." > medbrains/deploy/standalone/backup-recipients.txt
```

:::danger Replace the key in the kit
The file in the repository holds the MedBrains project's own key. If you leave
it, your backups are sealed to a key your hospital does not hold.
:::

## 2. Copy the files to the server

```bash
VER=3.33.0; ARCH=x86-64          # or ARCH=arm64
BASE=https://github.com/medbrains/medbrains/releases/download/v$VER
curl -fLO "$BASE/medbrains-server-bins-linux-$ARCH.tar.gz"
curl -fLO "$BASE/medbrains-web-dist.tar.gz"
scp medbrains-server-bins-linux-$ARCH.tar.gz medbrains-web-dist.tar.gz root@SERVER:/tmp/
scp -r medbrains/deploy/standalone root@SERVER:/tmp/
```

## 3. Unpack on the server

The kit reads the programs and the web app from `/tmp`:

```bash
cd /tmp
tar -xzf medbrains-server-bins-linux-x86-64.tar.gz     # medbrains-server, medbrains-archive, medbrains-edge, ...
tar -xzf medbrains-web-dist.tar.gz && rm -rf medbrains-web && mv web-dist medbrains-web
```

:::caution The edge proxy is not in the release yet
The kit also needs `/tmp/medbrains-proxy`. The release tarball has
`medbrains-front`, the appliance's front, which is a different program. Until
the release ships `medbrains-proxy`, build it on a Linux machine of the same
processor type and copy it over:

```bash
cargo build --release -p medbrains-proxy --bin medbrains-proxy
scp target/release/medbrains-proxy root@SERVER:/tmp/
```
:::

## 4. Run the installer

```bash
sudo bash /tmp/standalone/install.sh hms.example-hospital.org it@example-hospital.org
```

**Expected:** nine numbered steps (`==> [1/9]` to `==> [9/9]`), then the public
address. The first administrator's password is generated once:

```bash
sudo cat /etc/medbrains/initial-admin-password
```

Sign in at `https://hms.example-hospital.org` and change it. Then
[set up the hospital](/get-started/set-up-a-hospital/).

## Check it worked

```bash
systemctl is-active medbrains-server.service       # active
curl -fsS http://127.0.0.1:3000/api/health         # {"status":"ok",...}
curl -I https://hms.example-hospital.org           # HTTP/2 200
systemctl list-timers 'medbrains-*'                # backup and archive timers scheduled
```

## What it set up

| Item | Where |
|---|---|
| Settings and keys | `/etc/medbrains/env` (mode 640, root:medbrains). Back it up with the database: a restored database cannot be read without it |
| Programs | `/usr/local/bin/medbrains-*`, with the previous version kept as `*.prev` |
| Web app and this guide (`/help`) | `/var/www/medbrains` |
| Data and files | PostgreSQL 17 in Docker, files under `/var/lib/medbrains` |
| Server | `medbrains-server.service` on `127.0.0.1:3000`; database migrations run when it starts |
| Backups | `medbrains-pg-backup.timer`, daily at 02:30 UTC. See [backups](/admin/backups/) |

The keys in `/etc/medbrains/env` (the JWT signing pair and the data keys) are
made by the installer and never overwritten. See
[keys](https://github.com/medbrains/medbrains/blob/main/medbrains/docs/architecture/OS-KEYS.md).

## If it fails

| What you see | What to do |
|---|---|
| `ERROR: /tmp/medbrains-proxy missing` | Build and copy it, as in step 3 |
| The web app is blank, or `/var/www/medbrains/web-dist/` exists | The web archive was unpacked without the `mv`. Repeat step 3, then run the installer again |
| Certbot fails | DNS does not point at this server yet, or port 80 is closed from the internet |
| `refusing to start: JWT_PRIVATE_KEY does not belong to its public key` | The two halves in `/etc/medbrains/env` were changed separately. Empty both values and run the installer again: it makes a new pair, and everyone signs in again |
| `curl /api/health` fails | `journalctl -u medbrains-server -n 50` shows why. A database error means PostgreSQL is not up: `sudo docker ps` |

**Deeper:** [`deploy/standalone/README.md`](https://github.com/medbrains/medbrains/blob/main/medbrains/deploy/standalone/README.md).
