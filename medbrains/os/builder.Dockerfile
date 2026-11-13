# Mac fallback only: on Linux, build.sh runs mkosi directly. Nothing in the image uses this.
# The image builder: mkosi on Debian stable. Used only by build.sh.
FROM debian:trixie
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        mkosi systemd-ukify systemd-repart systemd-boot-efi systemd-container \
        apt dpkg debian-archive-keyring dosfstools mtools e2fsprogs erofs-utils \
        cpio kmod zstd xz-utils ca-certificates python3 bubblewrap uidmap xorriso \
    && rm -rf /var/lib/apt/lists/*
COPY mkosi.splash.bmp ukify-splash.py install-ukify-splash.sh /tmp/splash/
COPY trial-initrd /tmp/splash/trial-initrd
RUN sh /tmp/splash/install-ukify-splash.sh
