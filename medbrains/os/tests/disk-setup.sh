#!/usr/bin/env bash
# Checks disk-setup's `finish` with a stand-in systemd-cryptenroll, so a failure can be forced. No machine
# needed. A failed read must stop first boot and must never record the disk as chosen to be unencrypted.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/../mkosi.extra/usr/lib/medbrains/disk-setup"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
FAILED=0

# Runs finish with cryptenroll printing $2 and exiting $3; checks the exit status $4 and the record $5.
check() {
    local name="$1" output="$2" code="$3" want_code="$4" want_record="$5" got
    rm -f "$WORK/config/disk-protection"
    mkdir -p "$WORK/bin" "$WORK/config"
    cat > "$WORK/bin/systemd-cryptenroll" <<STUB
#!/bin/sh
[ "\$#" -gt 1 ] && exit 1
printf '%s\n' '$output'
exit $code
STUB
    chmod +x "$WORK/bin/systemd-cryptenroll"
    mkdir -p "$WORK/run"
    PATH="$WORK/bin:$PATH" MEDBRAINS_DISK_PART=/dev/null MEDBRAINS_DISK_CONFIG="$WORK/config" MEDBRAINS_RUN="$WORK/run" \
        bash "$SCRIPT" finish </dev/null >/dev/null 2>&1
    got=$?
    local record=""
    [[ -f "$WORK/config/disk-protection" ]] && record="$(cat "$WORK/config/disk-protection")"
    if [[ "$got" -eq "$want_code" && "$record" == "$want_record" ]]; then
        echo "pass  $name"
    else
        echo "FAIL  $name: exit $got, record '$record'"
        FAILED=1
    fi
}

check "a failed slot read records nothing" "" 1 1 ""
check "an empty-key slot records the choice" "SLOT TYPE
   0 password" 0 0 "unencrypted-chosen"
check "no seal and no choice records nothing" "SLOT TYPE
   1 recovery" 0 1 ""
check "a seal whose recovery key cannot be made records nothing" "SLOT TYPE
   0 tpm2" 0 1 ""
# KAN-2: setup's random key left beside a seal by a cut-short start is not a choice to go unencrypted.
check "a random key beside a seal records nothing" "SLOT TYPE
   0 tpm2
   1 password" 0 1 ""

# Runs prepare on a TPM machine whose chip loads only RSA key size $2, with a 2048-bit PCR key in place.
# KAN-2: the recovery key must exist, and be shown, before the TPM is ever asked to open the disk.
check_prepare() {
    local name="$1" loads="$2" want_pubkey="$3" P="$WORK/prep" key=abcdefgh-abcdefgh-abcdefgh-abcdefgh-abcdefgh-abcdefgh-abcdefgh-abcdefgh
    rm -rf "$P"; mkdir -p "$P/bin" "$P/run"; : > "$P/tpmrm0"
    openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 2>/dev/null | openssl pkey -pubout > "$P/pcr.pem"
    printf '#!/bin/sh\n' > "$P/bin/modprobe"; printf '#!/bin/sh\n' > "$P/bin/udevadm"
    printf '#!/bin/sh\necho "$*" >> %s/repart.args\nfor a; do case "$a" in --key-file=*) cp "${a#*=}" %s/key-at-repart;; esac; done\n' "$P" "$P" > "$P/bin/systemd-repart"
    printf '#!/bin/sh\necho "$*" >> %s/enroll.args\necho %s\n' "$P" "$key" > "$P/bin/systemd-cryptenroll"
    printf '#!/bin/sh\n[ "$1" = rsa%s ]\n' "$loads" > "$P/bin/tpm2_testparms"
    chmod +x "$P"/bin/*
    printf '\nabcdefgh\n' | PATH="$P/bin:$PATH" MEDBRAINS_DISK_PART="$P/none" MEDBRAINS_TPM_DEVICE="$P/tpmrm0" \
        MEDBRAINS_RUN="$P/run" MEDBRAINS_PCR_PUBLIC_KEY="$P/pcr.pem" bash "$SCRIPT" prepare >/dev/null 2>&1
    local got=$? setup_key; setup_key="$(cat "$P/key-at-repart" 2>/dev/null)"
    if [[ "$got" -eq 0 && ${#setup_key} -eq 64 ]] && grep -q -- "--definitions=.*/tpm " "$P/repart.args" \
        && [[ "$(grep -c -- "--tpm2-public-key=$P/pcr.pem --tpm2-public-key-pcrs=11" "$P/repart.args")" -eq "$want_pubkey" ]] \
        && [[ "$(grep -c -- "--tpm2-public-key= --tpm2-public-key-pcrs= " "$P/repart.args")" -ne "$want_pubkey" ]] \
        && grep -q -- "--unlock-key-file=$P/run/.* --wipe-slot=password --recovery-key $P/none" "$P/enroll.args" \
        && [[ "$(cat "$P/run/medbrains-recovery-key" 2>/dev/null)" == "$key" ]] \
        && [[ "$(ls "$P/run")" == medbrains-recovery-key ]]; then
        echo "pass  $name"
    else
        echo "FAIL  $name: exit $got; repart: $(cat "$P/repart.args" 2>/dev/null); enroll: $(cat "$P/enroll.args" 2>/dev/null)"
        FAILED=1
    fi
}
check_prepare "prepare adds and shows the recovery key, sealed with the PCR key the TPM loads" 2048 1
check_prepare "prepare seals without a PCR key the TPM cannot load" 3072 0

# A local variable named in an exit trap is unbound by the time the trap runs, which turned a finished
# re-seal into a failure and left the key file behind.
if grep -nE "^ +local .*KEY_FILE|trap .*key_file" "$SCRIPT"; then
    echo "FAIL  the key file's trap uses a local variable"
    FAILED=1
else
    echo "pass  the key file's trap does not use a local variable"
fi
exit "$FAILED"
