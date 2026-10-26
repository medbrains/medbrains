# On-site PACS with a cloud copy

Images live on a machine at the hospital, on the same network as the scanners,
so imaging keeps working when the internet does not and CT/MRI studies never
cross it. MedBrains (in the cloud) fills the PACS's worklist and reads studies
back over the hospital VPN. Every night the PACS copies itself to an encrypted,
versioned S3 bucket in Mumbai, so a lost machine can be rebuilt.

```
 scanners ──DICOM 4242──▶ PACS (Orthanc, on-site) ──nightly──▶ S3 (Mumbai, versioned)
                            ▲  │ OHIF viewer on the LAN
              worklist out  │  │ studies back
                            │  ▼
                    MedBrains (cloud) over the hospital VPN
```

## 1. The machine

| | Minimum | Notes |
|---|---|---|
| CPU / RAM | 4 cores / 16 GB | 8 cores / 32 GB for heavy CT/MRI |
| Disks | 2 × N TB, mirrored (RAID 1) | N from the table below, plus 30% headroom |
| Network | wired, fixed LAN address | same network as the scanners |
| Power | UPS | a cut mid-write corrupts the index |
| OS | Ubuntu 24.04 LTS | |

Storage per year, roughly: X-ray/CR/DR 20 MB a study, ultrasound 15 MB, CT
300 MB, MRI 200 MB, mammography 50 MB. 100 X-rays and 20 CTs a day is about
3 TB a year. The S3 copy grows the same way; images move to cheaper storage
after 30 days.

## 2. Install

```bash
sudo PACS_BIND_IP=192.168.10.20 ./install.sh     # this machine's LAN address
```

It installs Docker, starts Orthanc (version pinned by digest) with sign-in
required, prints the `medbrains` user's password once, and enables the nightly
backup timer.

Then:

1. **Scanners.** For each one, add it to `ORTHANC__DICOM_MODALITIES` in
   `/etc/medbrains-pacs/pacs.env` — `{"CT1": ["CT1AET", "192.168.10.31", 104]}`
   (name, its AE title, its IP, its port) — and restart:
   `docker compose -f /opt/medbrains-pacs/docker-compose.yml up -d`.
   Only listed scanners may store or query.
   On each scanner (usually the vendor engineer, ~15 minutes): worklist
   provider and storage destination = this machine, port 4242, AE title
   `HOSPPACS`.
2. **MedBrains.** Radiology → Modalities → PACS: address
   `http://<PACS LAN address>:8042` (reached over the VPN), username
   `medbrains`, and the printed password. The password is stored sealed for
   this hospital and this address only, is never shown again, and must be
   re-entered if the address or username changes. The address must be a
   private or VPN address (10.x, 172.16–31.x, 192.168.x, 100.64–127.x); a PACS
   hosted elsewhere needs https and the server operator listing its host in
   `MEDBRAINS_PACS_ALLOWED_HOSTS`. From then on every imaging order goes
   onto the worklist and studies come back to their orders within a minute of
   the scanner finishing.
3. **Cloud copy.** From an admin workstation with AWS access:
   `./create-backup-bucket.sh <hospital>` — it creates the bucket (private,
   versioned, KMS-encrypted, Mumbai, cold storage after 30 days, old versions
   kept a year) and a key that can write and read but not delete. Paste its
   output into `/etc/medbrains-pacs/backup.env`. Test once:
   `sudo systemctl start pacs-backup && journalctl -u pacs-backup -n 5`.

## 3. Restore onto a new machine

```bash
sudo PACS_BIND_IP=<address> ./install.sh            # fresh Orthanc
sudo docker compose -f /opt/medbrains-pacs/docker-compose.yml down
# (fill backup.env with the same bucket and key)
set -a; . /etc/medbrains-pacs/backup.env; set +a
B=s3://$PACS_BACKUP_BUCKET/pacs/<old hostname>
sudo -E aws s3 sync "$B/storage" /srv/orthanc/db
LATEST=$(aws s3 ls "$B/index/" | sort | tail -1 | awk '{print $4}')
sudo -E aws s3 cp "$B/index/$LATEST" - | gunzip | sudo tee /srv/orthanc/db/index >/dev/null
sudo docker compose -f /opt/medbrains-pacs/docker-compose.yml up -d
```

Images from the last day before the loss are only in the copy if the night ran;
studies are also still on most scanners for a few days.

## 4. What stays true

- The PACS listens only on the LAN address, never on a public interface.
- Sign-in is required for the web API and viewer; only listed scanners speak DICOM.
- The bucket blocks public access; the backup key cannot delete.
- Images stay in India (ap-south-1).
