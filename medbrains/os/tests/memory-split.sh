#!/bin/sh
# Memory by process on a running appliance, for the owner: PSS from smaps, which shares each page among the
# processes that map it, so the rows add up. Then each WebKit process split by what its pages are, as far as
# smaps can tell: the engine's code (its libraries), the heap and anonymous memory (the page's JavaScript heap,
# DOM, decoded images and caches all live here; smaps cannot tell them apart), and shared buffers for drawing.
# Run as root on the machine: sh memory-split.sh
set -eu

pss_kb() { awk '/^Pss:/ { print $2 }' "/proc/$1/smaps_rollup" 2>/dev/null || echo 0; }

echo "== PSS by process, MB =="
for pid in $(ls /proc | grep -E '^[0-9]+$'); do
    [ -r "/proc/$pid/smaps_rollup" ] || continue
    name=$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null | cut -c1-60)
    [ -n "$name" ] || continue
    printf '%s\t%s\t%s\n' "$(pss_kb "$pid")" "$pid" "$name"
done | sort -rn | awk -F'\t' '$1 > 2048 { printf "%8.1f  %6s  %s\n", $1 / 1024, $2, $3 }'

echo "== Totals by part, MB =="
for pid in $(ls /proc | grep -E '^[0-9]+$'); do
    [ -r "/proc/$pid/smaps_rollup" ] || continue
    printf '%s\t%s\n' "$(pss_kb "$pid")" "$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null)"
done | awk -F'\t' '
    $2 ~ /WebKitWebProcess/     { part = "WebKit web pages" }
    $2 ~ /WebKitNetworkProcess/ { part = "WebKit network" }
    $2 ~ /WebKitGPUProcess/     { part = "WebKit GPU" }
    $2 ~ /medbrains-shell/      { part = "shell" }
    $2 ~ /^\/usr\/bin\/cage/    { part = "compositor (cage)" }
    $2 ~ /kanidmd/              { part = "kanidmd" }
    $2 ~ /medbrains-server/     { part = "MedBrains server" }
    $2 ~ /postgres/             { part = "Postgres" }
    $2 ~ /medbrains-front/ { part = "front" }
    { if (part == "") part = "everything else"; sum[part] += $1; total += $1; part = "" }
    END { for (p in sum) printf "%8.1f  %s\n", sum[p] / 1024, p; printf "%8.1f  all processes\n", total / 1024 }' | sort -rn

echo "== Each WebKit web process by kind of page, MB =="
for pid in $(pgrep -f WebKitWebProcess || true); do
    awk -v pid="$pid" '
        /^[0-9a-f]+-[0-9a-f]+ / { path = $6; kind = (path ~ /\.so/) ? "engine code (libraries)" :
                                   (path == "[heap]") ? "malloc heap" :
                                   (path ~ /memfd|dri|shm|SYSV|dmabuf/) ? "shared drawing buffers" :
                                   (path ~ /^\[(stack|vdso|vvar|vsyscall)/) ? "stacks" :
                                   (path == "") ? "anonymous (JS heap, DOM, images, caches)" : "other files" }
        /^Pss:/ { sum[kind] += $2 }
        END { for (k in sum) printf "  pid %s %8.1f  %s\n", pid, sum[k] / 1024, k }' "/proc/$pid/smaps" | sort -k3 -rn
done
free -m | head -2
