# Keys that may sign OS updates

One public key per file, named `<id>.pub`, as base64. `build.sh` copies each into every image. **No release
key exists yet**, so a release image refuses every bundle and says why on its Settings screen.

Never put a key named `test-*` here: `build.sh` refuses it. Debug images make their own test key at build time.
How the release keys are made, kept, rotated and revoked: `docs/architecture/OS-SIGNING-KEYS.md`.
