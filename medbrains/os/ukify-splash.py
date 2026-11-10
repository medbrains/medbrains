#!/usr/bin/python3
"""Builder-only wrapper: runs the real ukify, adding the MedBrains splash and our small initrd to `build`."""
import os
import sys

args = sys.argv[1:]
if "build" in args:
    args.append("--splash=/usr/share/medbrains/splash.bmp")
    args.append("--initrd=/usr/share/medbrains/trial-initrd.cpio")
os.execv("/usr/bin/python3", ["python3", "/usr/lib/systemd/ukify.real", *args])
