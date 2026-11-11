#!/usr/bin/env python3
"""Reads an Ed25519 key out of the DER OpenSSL writes, by its exact structure, never by cutting bytes off the
end: a private key is PKCS#8 (RFC 8410), 48 bytes, a public key is SubjectPublicKeyInfo, 44 bytes, each with
one fixed prefix. Anything else is refused, and so is an all-zero private seed.

  ed25519_der.py private <der file>   prints the 32-byte seed, base64
  ed25519_der.py public <der file>    prints the 32-byte public key, base64
  ed25519_der.py pkcs8 <base64 seed>  writes the seed's PKCS#8 DER to stdout, for openssl to derive from
"""
import base64
import sys

PRIVATE_PREFIX = bytes.fromhex("302e020100300506032b657004220420")
PUBLIC_PREFIX = bytes.fromhex("302a300506032b6570032100")
KEY_LEN = 32


def raw_key(der, prefix):
    """The 32 key bytes of `der`, if it is exactly `prefix` and a key; otherwise None."""
    if len(der) != len(prefix) + KEY_LEN or not der.startswith(prefix):
        return None
    return der[len(prefix):]


def private_seed(der):
    """The seed of a PKCS#8 Ed25519 private key, or None. An all-zero seed is not a key anyone made."""
    seed = raw_key(der, PRIVATE_PREFIX)
    return None if seed is None or seed == bytes(KEY_LEN) else seed


def seed_from_base64(text):
    """A seed from its base64 text, or None if it is not 32 bytes or is all zero."""
    try:
        seed = base64.b64decode(text.strip(), validate=True)
    except ValueError:
        return None
    return seed if len(seed) == KEY_LEN and seed != bytes(KEY_LEN) else None


def main():
    """Runs one command; exits 1 with a reason on anything that is not a well-formed key."""
    if len(sys.argv) != 3 or sys.argv[1] not in ("private", "public", "pkcs8"):
        sys.exit(__doc__)
    kind, arg = sys.argv[1:]
    if kind == "pkcs8":
        seed = seed_from_base64(arg)
        if seed is None:
            sys.exit("not an Ed25519 seed (32 bytes, not all zero)")
        sys.stdout.buffer.write(PRIVATE_PREFIX + seed)
        return
    with open(arg, "rb") as file:
        der = file.read()
    key = private_seed(der) if kind == "private" else raw_key(der, PUBLIC_PREFIX)
    if key is None:
        sys.exit(f"{arg} is not an Ed25519 {kind} key")
    print(base64.b64encode(key).decode())


if __name__ == "__main__":
    main()
