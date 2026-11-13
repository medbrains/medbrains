## MedBrains OS: which file to use

Every file below is built from the same system image, and every one is listed in `SHA256SUMS`
(signed, `SHA256SUMS.sigstore.json`). Check it before you use a file: `sha256sum --check --ignore-missing SHA256SUMS`.
**Intel and AMD machines both use `x86-64`.** `arm64` is for ARM servers and boards with UEFI firmware.
Every file boots with UEFI only. A file ending `-unsigned` was built without the release signing key. Use it for trials only.

| Where it runs | File |
|---|---|
| A physical machine, from a USB stick or a DVD (the installer) | `medbrains-os-<ver>-x86-64.iso` / `-arm64.iso` |
| A physical machine, written straight to its disk from another computer | `medbrains-os-<ver>-<arch>.raw.zst` |
| Proxmox VE, KVM, libvirt, OpenStack | `medbrains-os-<ver>-<arch>.qcow2` |
| VMware ESXi / vSphere, Workstation, Fusion (Intel Mac) | `medbrains-os-<ver>-x86-64.ova` |
| Microsoft Hyper-V (generation 2) | `medbrains-os-<ver>-x86-64.vhdx` |
| Amazon Web Services (`import-snapshot`, then `register-image --boot-mode uefi --tpm-support v2.0`) | `medbrains-os-<ver>-x86-64.vmdk`; arm64: the `.raw.zst`, unpacked |
| Microsoft Azure | `medbrains-os-<ver>-x86-64-azure.vhd.zst` (unpack it first: `zstd -d`) |

Give a virtual machine a virtual TPM 2.0, or the data disk cannot be sealed and setup asks before it stores
anything unencrypted. Steps for each hypervisor and cloud are in `os/README.md`, "Install and run".
