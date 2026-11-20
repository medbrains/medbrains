# Mac fallback only: on Linux, build.sh runs mkosi directly. Nothing in the image uses this.
# The image builder: mkosi on Debian stable. Used only by build.sh.
# Base pinned by digest (debian:trixie, 13.7, 2026-11-04). `apt-get upgrade` then takes the
# trixie-security fixes the base predates (zlib CVEs, Snyk 2026-11-17): a build environment
# with known holes is worse than one whose patch level moves with Debian security.
FROM debian:trixie@sha256:9c6e381421d0f48d1b8133e573f33c185ee16cbf505eda9c4a8a4791b25ea8a6
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends \
        mkosi systemd-ukify systemd-repart systemd-boot-efi systemd-container \
        apt dpkg debian-archive-keyring dosfstools mtools e2fsprogs erofs-utils \
        cpio kmod zstd xz-utils ca-certificates python3 bubblewrap uidmap xorriso \
    && rm -rf /var/lib/apt/lists/*
COPY mkosi.splash.bmp ukify-splash.py install-ukify-splash.sh /tmp/splash/
COPY trial-initrd /tmp/splash/trial-initrd
RUN sh /tmp/splash/install-ukify-splash.sh
