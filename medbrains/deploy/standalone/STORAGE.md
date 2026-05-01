# Storage backends — three deployment shapes

The MedBrains object-storage layer sits behind the
`medbrains_core::object_store::ObjectStore` trait. Three concrete
shapes are supported; pick by environment.

## 1. LocalFs (default — pilot single-server)

Hot tier: `LocalFsObjectStore` — plain files at
`/var/lib/medbrains/objects`. Cold tier:
`ColdLocalObjectStore` — gzip-compressed files at
`/var/lib/medbrains/cold`. Archive tier: a second
`ColdLocalObjectStore` rooted at `/var/lib/medbrains/archive` (often
mounted on a cheaper / slower disk).

Configuration (in `/etc/medbrains/env`):

```sh
MEDBRAINS_OBJECTS_HOT=/var/lib/medbrains/objects
MEDBRAINS_OBJECTS_COLD=/var/lib/medbrains/cold
MEDBRAINS_OBJECTS_ARCHIVE=/var/lib/medbrains/archive
```

No daemon, no network calls, restore is instant for any tier.
Suitable for: hospital pilot up to ~5 TB total content. Backup
strategy = filesystem-level snapshots / rsync.

## 2. RustFS (multi-server on-prem HA)

[RustFS](https://rustfs.com/) is an S3-compatible object store
written in Rust. Use it when the pilot graduates to multiple
application servers and you need a shared object store with
replication.

Drop-in once the S3 adapter ships (planned next-PR — see
`/Users/apple/.claude/plans/delegated-discovering-milner.md`):

```sh
MEDBRAINS_OBJECTS_BACKEND=s3
S3_ENDPOINT=http://rustfs.internal:9000
S3_REGION=us-east-1
S3_BUCKET=medbrains-objects
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

The same adapter works against MinIO, Ceph RGW, and any other
S3-compatible store — just point `S3_ENDPOINT` at the right URL.

Why RustFS specifically: same Rust runtime as MedBrains, lower
memory footprint than MinIO, simpler ops than Ceph.

## 3. AWS S3 + Glacier (cloud-hosted tenants)

Same S3 adapter, no `S3_ENDPOINT` (defaults to AWS regional
endpoint). Archive tier swaps to a Glacier-class store with
`StorageClass=GLACIER`:

```sh
MEDBRAINS_OBJECTS_BACKEND=s3
S3_REGION=ap-south-1
S3_BUCKET=medbrains-objects
S3_ARCHIVE_STORAGE_CLASS=GLACIER
```

Glacier restore SLA: 3-12h. The admin UI's "Restore" button writes a
restore-request marker; the sweeper picks it up on next tick and
calls `RestoreObject`. Once Glacier promotes the object to a
restore-ready state, the sweeper flips `storage_tier` back to `cold`.

## Tier transition flow (all three shapes)

1. `medbrains-archive` runs daily (02:00 by default).
2. Per tenant + per `object_storage_policies` row, finds documents
   whose age exceeds the configured threshold for the next tier.
3. For each: `dst.put(bytes_from(src))`, `src.delete(key)`,
   `UPDATE patient_documents`, `INSERT INTO
   object_storage_transitions` with hash-chained `previous_hash`.
4. Stops when no more candidates are eligible. One advisory lock
   per tenant prevents concurrent sweeps from racing the chain.

The chain matters because deletions can't be undone; the audit
trail must be tamper-evident.

## Picking a shape

| Hospital scale | Recommended shape |
|---|---|
| 1 hospital, ≤ 5 TB | LocalFs (this kit) |
| 1 hospital, > 5 TB | LocalFs hot + LocalFs cold on separate spinning-rust mount |
| 2-5 hospitals, single AZ | RustFS shared between app servers |
| 5+ hospitals or geo-redundant | AWS S3 + Glacier (or equivalent on Azure / GCP) |

## When to migrate

- **LocalFs → RustFS**: when adding a second application server.
  Migration = `rsync` the existing directories into the bucket once,
  flip `MEDBRAINS_OBJECTS_BACKEND=s3`, restart.
- **LocalFs → S3+Glacier**: same migration path, plus a separate
  pass to set `StorageClass=GLACIER` on the older objects.
- **RustFS → S3**: pure config flip. Same protocol, different
  endpoint. No data migration if you point RustFS at S3-as-tier-2.

The point of the trait is that none of these migrations require a
code change to MedBrains itself.
