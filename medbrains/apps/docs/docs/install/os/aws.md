---
title: Install on Amazon Web Services
sidebar_label: AWS (VMDK)
sidebar_position: 6
description: "Import MedBrains OS into AWS as a snapshot, register it as a UEFI image with NitroTPM, start a Nitro instance and finish setup on its serial console."
---

# Install on Amazon Web Services

**Who:** the person who runs the hospital's AWS account.
**You need:** the AWS CLI signed in with rights to S3, EC2 and VM Import (the
`vmimport` service role), an S3 bucket in the target region, and
`medbrains-os-v3.33.0-x86-64.vmdk` ([verified](/install/verify-a-download/)).
For arm64, use `medbrains-os-v3.33.0-arm64.raw.zst`.

The release builds these files but does not upload them to AWS. You import
them into your own account.

## 1. Import the disk as a snapshot

Change `my-bucket` to your bucket:

```bash
aws s3 cp medbrains-os-v3.33.0-x86-64.vmdk s3://my-bucket/
aws ec2 import-snapshot --description medbrains-os-v3.33.0 \
  --disk-container "Format=VMDK,UserBucket={S3Bucket=my-bucket,S3Key=medbrains-os-v3.33.0-x86-64.vmdk}"
```

Wait until the task says `completed`, and note its `SnapshotId`:

```bash
aws ec2 describe-import-snapshot-tasks --import-task-ids import-snap-0123456789abcdef0
```

For arm64, unpack first (`zstd -d medbrains-os-v3.33.0-arm64.raw.zst`), upload
the `.raw`, and use `Format=RAW`.

## 2. Register a UEFI image with NitroTPM

The sealed disk needs NitroTPM, so the image must say so:

```bash
aws ec2 register-image --name medbrains-os-v3.33.0 --architecture x86_64 \
  --boot-mode uefi --tpm-support v2.0 --ena-support --virtualization-type hvm \
  --root-device-name /dev/xvda \
  --block-device-mappings "DeviceName=/dev/xvda,Ebs={SnapshotId=snap-0123456789abcdef0,VolumeSize=64,VolumeType=gp3}"
```

For arm64, use `--architecture arm64`.

**Do not use `aws ec2 import-image`.** It rewrites the system inside, rejects
a Linux it does not recognise, and does not set UEFI or NitroTPM.

## 3. Start an instance

Launch the new image on a Nitro type that offers NitroTPM, for example
`m6i.xlarge` (x86-64) or `m7g.xlarge` (arm64). Open port 443 to the hospital
network only.

## Check it worked

The appliance has no SSH. Open **EC2 > Instance > Connect > EC2 serial
console**. It shows the first setup screen. Go on to
[first boot and the recovery key](/admin/first-boot/).

## If it fails

| What you see | What to do |
|---|---|
| `import-snapshot` fails with a role or permission error | The `vmimport` service role is missing. Create it as the AWS VM Import guide describes |
| The instance type is refused | It does not offer NitroTPM or UEFI. Pick a current Nitro type |
| Setup asks about a TPM | The image was registered without `--tpm-support v2.0`. Register it again |
| Serial console is not available | Turn on EC2 serial console access for the account (*EC2 > Settings*) |

**Deeper:** [`os/README.md`, "Amazon Web Services"](https://github.com/medbrains/medbrains/blob/main/medbrains/os/README.md#amazon-web-services-vmdk-or-raw-for-arm64).
