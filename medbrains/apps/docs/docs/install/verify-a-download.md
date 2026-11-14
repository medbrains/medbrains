---
title: Verify a download
sidebar_position: 2
description: "Check that a MedBrains release file is complete and came from our release workflow: compare it with SHA256SUMS, then verify the cosign signature."
---

# Verify a download

**Who:** anyone who downloads a MedBrains file.
**You need:** the file, plus `SHA256SUMS` and `SHA256SUMS.sigstore.json` from
the same release, all in one folder. For step 2 you also need
[cosign](https://docs.sigstore.dev/cosign/system_config/installation/) 2 or later.

Do both checks. The first proves the file is not damaged. The second proves
the list of checksums came from MedBrains and nobody else.

## 1. Check the file against SHA256SUMS

Download the two check files (change `VER` to your version):

```bash
VER=3.33.0
BASE=https://github.com/medbrains/medbrains/releases/download/v$VER
curl -fLO "$BASE/SHA256SUMS"
curl -fLO "$BASE/SHA256SUMS.sigstore.json"
```

Then check every file you downloaded:

```bash
sha256sum --check --ignore-missing SHA256SUMS      # Linux
shasum -a 256 --check --ignore-missing SHA256SUMS  # macOS
```

**Expected output:** one line per file you have, each ending in `OK`:

```text
medbrains-os-v3.33.0-x86-64.iso: OK
```

On Windows, print the file's hash and compare it by eye with its line in
`SHA256SUMS`:

```powershell
certutil -hashfile medbrains-os-v3.33.0-x86-64.iso SHA256
```

## 2. Check that SHA256SUMS is ours

`SHA256SUMS` is signed by our release workflow with Sigstore. There is no
long-lived key to steal: the signature names the exact GitHub workflow and
tag that made it.

```bash
cosign verify-blob SHA256SUMS \
  --bundle SHA256SUMS.sigstore.json \
  --certificate-identity-regexp '^https://github.com/medbrains/medbrains/.github/workflows/release.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

**Expected output:** `Verified OK`.

## Other checks

- **Build provenance.** Every release file also has a GitHub attestation:
  `gh attestation verify <file> --repo medbrains/medbrains`.
- **Container image.** The server image is signed on its own. It is pushed
  when a release is published; the v3.33.0 image job failed, so the first
  image is v3.34.0:

  ```bash
  cosign verify ghcr.io/medbrains/medbrains:3.34.0 \
    --certificate-identity-regexp '^https://github.com/medbrains/medbrains/.github/workflows/release.yml@refs/tags/v' \
    --certificate-oidc-issuer https://token.actions.githubusercontent.com
  ```

- **Software bill of materials.** `medbrains-source.cdx.json` (CycloneDX) is in
  `SHA256SUMS`, so step 1 covers it.

## If a check fails

- **`FAILED` in step 1.** The file is damaged or changed. Delete it and
  download it again. If it fails twice, do not install it.
- **`no properly formatted checksum lines found`.** You downloaded the
  release web page, not the file. Use the `curl` lines above.
- **`none of the expected identities matched` in step 2.** The checksums were
  not made by our release workflow. Do not install anything from that
  download.
- **A file name ends in `-unsigned`.** It was built without our signing key.
  Use it for trials only, never for patient data.

Report a failed check that is not explained above privately, through
[a security advisory](https://github.com/medbrains/medbrains/security/advisories/new),
never in a public issue.

**Deeper:** how releases are built and signed is in
[`docs/SECURITY-RELEASE-PROCESS.md`](https://github.com/medbrains/medbrains/blob/main/medbrains/docs/SECURITY-RELEASE-PROCESS.md).
