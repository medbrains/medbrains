#!/usr/bin/env bash
# A clean device for the native journeys, never the developer's own.
#
#   scripts/native_test_env.sh ios      # prints the UDID of a fresh "MedBrainsPhone" simulator
#   scripts/native_test_env.sh android  # prints the serial of a fresh "MedBrainsPhone" emulator
#
# The shared simulator carries every app on the machine; a journey that runs
# there is not a clean test. This creates a dedicated device once, then
# erases it before every run so only the app under test is installed. The
# Android AVD is booted with its data wiped for the same reason.
set -euo pipefail
NAME="MedBrainsPhone"
case "${1:-}" in
  ios)
    RUNTIME="${IOS_RUNTIME:-com.apple.CoreSimulator.SimRuntime.iOS-18-0}"
    TYPE="${IOS_DEVICE_TYPE:-com.apple.CoreSimulator.SimDeviceType.iPhone-16}"
    UDID=$(xcrun simctl list devices -j | python3 -c "import sys,json; d=json.load(sys.stdin)['devices']; print(next((x['udid'] for r,l in d.items() if r.endswith('${RUNTIME##*.}') for x in l if x['name']=='$NAME'),''))")
    if [ -z "$UDID" ]; then UDID=$(xcrun simctl create "$NAME" "$TYPE" "$RUNTIME"); fi
    xcrun simctl shutdown "$UDID" >/dev/null 2>&1 || true
    xcrun simctl erase "$UDID" >/dev/null
    xcrun simctl boot "$UDID" >/dev/null
    xcrun simctl bootstatus "$UDID" -b >/dev/null
    echo "$UDID"
    ;;
  android)
    export PATH="$PATH:$HOME/Library/Android/sdk/platform-tools:$HOME/Library/Android/sdk/emulator"
    SERIAL="emulator-5556"
    adb -s "$SERIAL" emu kill >/dev/null 2>&1 || true
    sleep 3
    (nohup emulator -avd "$NAME" -wipe-data -no-snapshot-save -no-boot-anim -port 5556 >/dev/null 2>&1 &)
    until [ "$(adb -s "$SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 5; done
    echo "$SERIAL"
    ;;
  *) echo "usage: $0 ios|android" >&2; exit 2 ;;
esac
