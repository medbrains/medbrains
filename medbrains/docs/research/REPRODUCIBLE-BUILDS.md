# Reproducible builds: why ours differ, how to fix them, what we can promise

Research for #5509 and for `RFC-OS-ECOSYSTEM` §6.2 rule 4 and §6.4 ("Our own build": a second,
independent builder must produce byte-identical artefacts before a release is signed). Written
2026-11-20 against `release/3.35.3`. No fix is implemented here. Each claim has a strength:

- **strong**: we measured it on our own artefacts, or a primary source says it directly
- **medium**: a primary source supports it, but we have not measured it on our build
- **weak**: reasoning or secondary sources only. Measure before relying on it.

## 1. Summary

1. **There is only one cause in the measured run.** The server binary differs because vendored
   OpenSSL writes its absolute build directory into the binary. That string has a different
   length in each checkout, so the read-only data section is laid out differently and every
   pointer into it moves. All 88,811 differing bytes come from that. Nothing else in rustc,
   LTO, codegen units, proc macros, sqlx data or the linker differed. **strong**
2. **The check does not test what we ship.** `reproducible.yml` builds natively on Ubuntu with
   path remapping. The release builds with cargo-zigbuild against glibc 2.36 and no remapping.
   The Docker image is a third build. A pass in the check would say nothing about the tarball,
   the image or the OS image. **strong**
3. **The shipped binaries contain the builder's home directory.** The x86-64 `medbrains-server`
   from the latest release run has 2,157 `/home/runner/.cargo/registry/...` paths in it.
   **strong**
4. **The web bundle has a build clock and a build-environment switch.** `__APP_BUILT__ = new
   Date()` (found as `2026-11-18T17:35:23.479Z` in a chunk). The Sentry plugin runs only when
   a token is present. The help site's sitemap dates depend on clone depth. **strong**
5. **The OS image has no reproducibility settings yet.** There is no `SourceDateEpoch=`, no
   `Seed=` and no package snapshot, and the container is a floating tag. **strong** (from the
   config). We have not measured the size of the effect.

What we can promise (section 5), in short:

- the Rust binaries and the web bundle: byte-identical rebuilds from a pinned build container,
  soon
- the raw OS image: byte-identical with mkosi's own settings, after more work
- Android: we can match the APK we publish, but not the APKs Google Play re-signs
- iOS: users cannot verify what the App Store delivers
- Trusting Trust: an independent rebuild catches a tampered build machine. It does not catch a
  tampered compiler. That needs diverse double-compiling, a research exercise and not a
  release gate.

## 2. The evidence

### 2.1 The reproducible.yml run

Run `43704156578` (schedule, 2026-11-15, `main` at `efc13ea33`, rustc 1.99.1). Both builds
ran on the same runner, in `a/` and `b-other-dir/`, with
`--remap-path-prefix=$WS/$dir=/build --remap-path-prefix=$HOME/.cargo=/cargo` and
`SOURCE_DATE_EPOCH` set to the commit time. Each build took 18.5 minutes.

| | server-a | server-b-other-dir |
|---|---|---|
| sha256 | `0384fab0…841c` | `29d7f9c2…54ff` |
| size | 230,204,040 | 230,204,040 |
| differing bytes | 88,811 | |

I wrote a small ELF section mapper (appendix A). It found where the differences sit:

| Section | Differing bytes | What they are |
|---|---|---|
| `.rodata` | 82,101 | The first difference is at `0x18035c8`: `…/a/medbrains/target/release/build/openssl-sys-7ad46629dd986f6e/out/openssl-build/install/lib/engines-3` in A, `…/b-other-dir/…` in B. The same goes for `…/lib/ossl-modules`. Everything after it is the same bytes moved 10 bytes along. |
| `.text` | 5,195 | 3,697 runs of 1–2 bytes. Read as 32-bit displacements, every one changes by 24, 32, 64, −136, −144 or −288 bytes: RIP-relative references to the moved strings. |
| `.rela.dyn` | 1,495 | The same small address changes, in relocation addends. |
| `.note.gnu.build-id` | 20 | LLD's hash of the content. It follows from the rest. |

The only absolute paths in either binary are those two OpenSSL strings (`grep -a /home/runner`
finds 2 in each). Everything else was remapped: 2,178 `/cargo/registry/…` paths and 107
`/rustc/<hash>/library/…` paths, the same in both. The build-script directory hash
(`openssl-sys-7ad46629dd986f6e`) is also the same in both, even though RUSTFLAGS differ. That
fits cargo's rule since 1.85: when RUSTFLAGS look like `--remap-path-prefix`, cargo leaves them
out of the hash ([Cargo 1.85 dev cycle][cargo185]). **strong**

**Why remapping does not fix it.** `openssl-src` runs `./Configure --prefix=<OUT_DIR>/install`
([lib.rs][openssl-src]). OpenSSL then compiles `ENGINESDIR` and `MODULESDIR` into C string
literals derived from that prefix. `--remap-path-prefix` rewrites only paths that rustc
produces. `-ffile-prefix-map` rewrites only `__FILE__` and debug info. Neither touches a
`#define` that Configure generated. **strong** (read in openssl-src 300.6.1 `src/lib.rs`,
lines 162–208.)

Everything else on the suspect list was **absent in this run**: timestamps, build-id
randomness, codegen-units or thin-LTO ordering (the profile is `lto = "thin"`,
`codegen-units = 1`, `strip = true`), proc-macro or HashMap ordering, sqlx offline data,
embedded git or build information, and debug info (the binary is stripped). **strong** for this
setup: same machine type, same toolchain, same time.

Caveat: two builds on one runner minutes apart cannot show differences that come from the
machine. These include the host C compiler (GCC 15.2 here), the glibc headers and crt objects,
the CPU model, and a different `HOME`. A real rebuilder will differ in all of them (section 4,
step 3).

### 2.2 The release run

Run `44360180829` (workflow_dispatch, `release/3.35.3`, 2026-11-18). From the `bins-x86-64`
artifact, `medbrains-server` (230,597,400 bytes):

- `.comment` reads `rustc version 1.100.0 (0ef1bc386 2026-11-09)` and
  `clang version 20.1.2 (… zig-bootstrap …)`. The toolchain pin holds, even though the job's
  action says `stable`, because `rust-toolchain.toml` wins in `medbrains/`. **strong**
- It has 2,157 `/home/runner/.cargo/registry/src/index.crates.io-…/…` paths (panic locations
  in dependencies). It also has 2 OpenSSL paths, under
  `/home/runner/work/medbrains/medbrains/medbrains/target/x86_64-unknown-linux-gnu/…`.
  Workspace crates appear as relative `crates/…` paths, because cargo passes relative paths
  for workspace members. **strong**
- It has no build-id note (the zig/LLD link). That is neutral for reproducibility.

Result: today a rebuilder gets the same bytes only with `HOME=/home/runner` and a checkout at
`/home/runner/work/medbrains/medbrains`, plus the same Ubuntu image, zig and runner. **strong**

### 2.3 Three recipes for one server

| Artefact | How it is built | C toolchain | Remap | Pinned env |
|---|---|---|---|---|
| Release tarball, OS image | `cargo zigbuild --target x86_64-unknown-linux-gnu.2.36` on `ubuntu-latest` | zig 0.15.2 (clang 20.1.2) | no | zig and cargo-zigbuild versions only |
| GHCR Docker image | `cargo build` in `rust:1.100.0-bookworm@sha256:…`, with `apt-get update` | Debian 12 GCC | no | base image by digest; apt floats |
| `reproducible.yml` | `cargo build` on `ubuntu-latest` | Ubuntu GCC 15.2, LLD 23 | yes | none |

Each recipe produces a different server. Only the first ships in the OS image. **strong**

### 2.4 Web bundle (`web-dist` from run 44360180829)

- `apps/web/vite.config.ts` defines `__APP_BUILT__: JSON.stringify(new Date().toISOString())`.
  It appears in `assets/AuthedRoutes-C_9fbr_F.js` as `new Date(\`2026-11-18T17:35:23.479Z\`)`.
  It changes that chunk's content hash and file name. That changes every chunk that imports it
  and `index.html`. **strong**
- `__APP_COMMIT__` gets `+local` when `git status --porcelain` is non-empty. A rebuild from a
  tarball gets `unknown`. **strong** (from the code)
- `sentryVitePlugin` is added only when `SENTRY_URL` and `SENTRY_AUTH_TOKEN` are set, which is
  on `v*` tags only. It injects debug-ID snippets into the chunks, so a tag build and a
  rebuilder without the token produce different bundles. **medium**: the gating is read from
  the code. The injection is the plugin's documented default, not measured on a tag build.
- `apps/docs/docusaurus.config.js` sets `sitemap.lastmod: "date"`, which comes from git
  history. All 56 `<lastmod>` values are `2026-11-18`, the HEAD date of the shallow
  (`fetch-depth: 1`) clone. A full clone gives per-file dates. **strong**
- Precompressed `.gz` files: all 566 have header mtime 0. Good. Brotli has no timestamp.
- Bundler ordering: Vite has had nondeterministic chunk and CSS names ([vite#13672][vite13672],
  [rollup#4909][rollup4909]). Nothing is known against Vite 8/Rolldown, and we have not
  measured it. **weak**. A build-twice job settles it in minutes.

### 2.5 Archives, OS image and derived formats

- **Release tarballs** (`release.yml`, `tar -czf dist/medbrains-server-bins-linux-$a.tar.gz -C
  artifacts/bins-$a .`). Entry mtimes are the artifact download time. Owner, group and
  directory order come from the runner. Identical binaries therefore give a different tarball,
  and so a different line in `SHA256SUMS`. **strong** ([reproducible-builds.org: archives][rb-archives]).
- **OS image** (`os/mkosi.conf`, `os/mkosi.repart`). There is no `SourceDateEpoch=` and no
  `Seed=`, so partition and filesystem UUIDs are random and file mtimes are the build time.
  There is no `Snapshot=` or snapshot `Mirror=`, so the Debian trixie packages are whatever the
  archive holds that day. There is no `ToolsTree=`. The builder is `debian:trixie` (a floating
  tag) with mkosi from apt. mkosi documents all four settings as reproducibility features
  ([mkosi(1)][mkosi-man]; `SourceDateEpoch=` and `Seed=` since v16, [news][mkosi-news]).
  **strong** that they are missing, **medium** that setting them makes ext4 and vfat
  reproducible ([mkosi talk, All Systems Go 2024][mkosi-asg]: "vfat/ext4/f2fs/erofs can be made
  reproducible, btrfs/xfs needs work").
- **Derived formats** (`os/formats.sh`, `os/build-iso.sh`). The `.ova` is a tar without
  `--sort`, `--mtime` or owner normalisation. `qemu-img` VHD and VHDX outputs carry a creation
  timestamp and generated identifiers. `mkfs.vfat` and `xorriso` in the ISO step take their
  volume ID and dates from the clock unless told otherwise. **medium** (tool behaviour, not
  measured on ours).
- **Signed parts.** The UKI and PCR signatures use the owner's key. A rebuilder has no key. It
  can only show that its unsigned bytes equal ours with the signatures removed.
- **Kanidm.** Built from a pinned commit with checksums (`os/build-kanidm.sh`), with its own
  toolchain and no remapping. It has the same path issue as our binaries. **medium** (not
  measured).

### 2.6 Android and iOS

- **Android.** From the `android` artifact, the unsigned APK has fixed zip timestamps
  (`1981-01-01`, AGP's deterministic packaging). It has
  `META-INF/version-control-info.textproto` = `NO_SUPPORTED_VCS_FOUND`. It has
  `assets/dexopt/baseline.prof`, which F-Droid lists as "not reproducible at times" (rerun, or
  match the upstream CPU core count) ([F-Droid][fdroid]). And it has
  `libmedbrains_edge_rn.so` with 229 (arm64) and 226 (x86_64) `/home/runner` paths, the Rust
  issue from section 2.2 again. **strong** (measured) for the paths, **medium** for
  baseline.prof.
- **iOS.** The App Store re-signs the app and FairPlay-encrypts the binary it delivers. Nobody
  can compare a store install with a local build without decrypting it on a jailbroken device.
  WalletScrutiny, which checks wallet apps for reproducibility, ended up treating every iPhone
  app as not verifiable ([walletScrutiny#149][ws149]). **medium-strong** (consistent secondary
  sources; Apple publishes no position).

## 3. Ranked causes

| # | Cause | Artefacts | Strength |
|---|---|---|---|
| 1 | Vendored OpenSSL bakes `OUT_DIR` into `ENGINESDIR`/`MODULESDIR`, which moves `.rodata` | every binary with `openssl` vendored (server, crypto users) | strong, measured |
| 2 | No `--remap-path-prefix` in the release, Docker or Android builds: `$CARGO_HOME` and the workspace path are embedded | all shipped Rust binaries, Android `.so` | strong, measured |
| 3 | Three build recipes and a floating host environment (`ubuntu-latest`, apt, host GCC), and the check covers none of the shipped ones | server tarball, image, OS image | strong |
| 4 | Web build clock (`new Date()`), `+local` flag, token-gated Sentry injection, git-depth-dependent sitemap dates | web bundle, help site | strong (Sentry: medium) |
| 5 | OS image and archives: no SourceDateEpoch, Seed or package snapshot; unnormalised tar; VHD/VHDX/ISO IDs and dates | OS image, tarballs, VM formats | strong (config), medium (effect size) |
| 6 | `baseline.prof` nondeterminism | Android | medium |
| 7 | Latent: OpenSSL's `built on:` date. `mkbuildinf.pl` uses `SOURCE_DATE_EPOCH // time()`. The string is dead-stripped today, but would appear if anything calls `OpenSSL_version(OPENSSL_BUILT_ON)` | server | weak |

## 4. Fix plan, in order

Each step is small and can be checked on its own. Steps 1–4 make the Rust binaries
reproducible. Steps 5–7 cover the rest.

1. **One build script, used everywhere.** Add `scripts/release_build.sh`. It is the only place
   the release `cargo zigbuild` line lives. `release.yml`, the Dockerfile (switch to copying
   the zigbuild binaries into the distroless base instead of rebuilding) and
   `reproducible.yml` all call it. Change `reproducible.yml` to build **the release set, with
   zigbuild, for both triples**. Build it in two directories **and** with two different
   `HOME`s, so the check can catch cause 2. *Why first:* until the check measures the shipped
   recipe, every other fix is unverified.
2. **Fixed absolute paths for the build** (cures cause 1 now, and makes cause 2 cheap). The
   script exports:
   ```sh
   export CARGO_HOME=/opt/mb-cargo            # registry paths become the same everywhere
   export CARGO_TARGET_DIR=/opt/mb-build/target  # OUT_DIR, and so OpenSSL's prefix, is fixed
   export SOURCE_DATE_EPOCH="$(git log -1 --format=%ct)"
   export RUSTFLAGS="--remap-path-prefix=$PWD=/build --remap-path-prefix=$CARGO_HOME=/cargo"
   export CFLAGS="-ffile-prefix-map=$PWD=/build -ffile-prefix-map=$CARGO_HOME=/cargo"
   ```
   The fixed `CARGO_TARGET_DIR` is the part that fixes OpenSSL, because the leaked string is
   the `OUT_DIR` path. Remapping alone cannot change it. Debian made the same trade-off: its
   buildds have used a fixed build path since July 2023, and tests.reproducible-builds.org
   stopped varying the build path in early 2024 "because the build path is recorded in the
   environment and can be reused when rebuilding" ([variations][rb-variations],
   [rb-general 2024-02][rb-buildpath]). Cargo's native answer, `trim-paths` (RFC 3127), is still
   unstable ([cargo#12137][trimpaths], [unstable docs][cargo-unstable]), so we cannot use it on
   stable 1.100. **strong**
3. **Pin the build environment by digest.** Build inside one container image, referenced by
   digest. It holds rustup with the 1.100.0 toolchain, zig 0.15.2 (tarball checked by
   sha256), and cargo-zigbuild 0.24.0 (`--locked`). Record `rustc -vV`, `zig version` and the
   image digest in the provenance. This is what turns "same bytes on our runner" into "same
   bytes on a hospital's box". Note for the RFC's "toolchain pinned by version and checksum":
   rustup checks the SHA-256 values in the channel manifest over TLS. It removed its
   experimental GPG verification in 1.27.1 ([rustup 1.25.2 notes][rustup1252]; changelog
   1.27.1). The image digest is the checksum we can actually pin. **medium**
4. **Long term: stop vendoring OpenSSL.** `josekit` is the reason (`medbrains-crypto`,
   `medbrains-server`). Moving JOSE to a pure-Rust stack removes cause 1 for good, takes a C
   build out of the trusted base, and is less attack surface. It is a separate, larger change,
   with a security review. **medium**
5. **Web bundle.**
   - `__APP_BUILT__` from `SOURCE_DATE_EPOCH`, falling back to `git log -1 --format=%cI`.
   - In CI, never add `+local`: fail the build if the tree is dirty.
   - Sentry: add the plugin always, with injection on and upload only when a token exists. Or
     never inject. Either way, every build applies the same transform.
   - Docusaurus: `fetch-depth: 0` for this job, or drop `lastmod`.
   - Add a "build web twice" job: minutes, not an hour.
   **strong** for the clock; the others need the twice-job to confirm.
6. **Archives and checksums.** For every release tar
   ([reproducible-builds.org][rb-archives]):
   ```sh
   tar --sort=name --mtime="@$SOURCE_DATE_EPOCH" --owner=0 --group=0 --numeric-owner \
       --pax-option=exthdr.name=%d/PaxHeaders/%f,delete=atime,delete=ctime \
       -cf - -C "artifacts/bins-$a" . | gzip -n -9 > "dist/medbrains-server-bins-linux-$a.tar.gz"
   ```
   Also publish the per-binary sha256 values inside `SHA256SUMS`, so a rebuilder verifies the
   binaries and not only the tarball. **strong**
7. **OS image.**
   - Set `SourceDateEpoch=` from the commit time.
   - Commit an `os/mkosi.seed` (or set `Seed=`).
   - Pin packages with `Snapshot=` (check that the trixie mkosi version supports it) or
     `Mirror=https://snapshot.debian.org/archive/debian/<timestamp>/`.
   - Run the builder from a digest-pinned image, or a pinned `ToolsTree=`.
   - Build twice and compare the **unsigned raw** image. Signatures are checked by re-attaching
     them to the rebuilt bytes.
   - Derived formats (qcow2, vhd, vhdx, vmdk, ova, iso) are verified by re-deriving them from
     the raw image. They are not promised byte-identical until each tool's ID and date options
     are set (`mkfs.vfat -i`, xorriso honouring `SOURCE_DATE_EPOCH`, qemu-img options).
   **medium** ([mkosi(1)][mkosi-man], [system images][rb-sysimg]).
8. **Android.**
   - Apply the Rust steps (2, 3) to the cargo-ndk build of `medbrains-edge-rn`.
   - Pin AGP, the build-tools version and the JDK.
   - Compare unsigned APKs. Compare signed APKs with `apksigcopier`, the F-Droid method, which
     needs build-tools 34 (F-Droid notes build-tools 35 breaks it).
   - Watch `baseline.prof`. **medium** ([F-Droid][fdroid]).
9. **Gate.** When the twice-check shows equal hashes on three weekly runs in a row, remove
   `continue-on-error`. Then make the release's signing step wait on an **independent**
   rebuild (section 5.2).

## 5. What is realistically achievable

### 5.1 Per artefact

| Artefact | Byte-identical rebuild | What "verifiable" means | Effort |
|---|---|---|---|
| Server and other Rust binaries | **Yes**, after steps 1–3. Evidence: one measured cause, which a fixed path removes | Anyone with the pinned container image rebuilds a tag and gets the same sha256 as `SHA256SUMS` | small |
| Web bundle | **Yes**, after step 5 (bundler ordering not yet measured) | Same: the sha256 of each file in `web-dist` | small |
| Release tarballs | **Yes**, after step 6 | Same, plus per-binary hashes | trivial |
| OS raw image (unsigned) | **Likely**, after step 7 (mkosi supports it; not measured) | Rebuild the unsigned raw image; check that our signatures verify over the rebuilt bytes | medium |
| VM, ISO and cloud formats | Not at first | Derived from the verified raw image by a documented conversion | medium |
| Android APK | **Likely** for the APK we publish (F-Droid does this routinely); not for Play-delivered APKs, which Google re-signs and splits | Our unsigned APK matches; the signed one matches via `apksigcopier` | medium |
| iOS | **No** for what users install | At most: our pre-upload, unsigned build is rebuildable by a partner on the same Xcode. The App Store binary cannot be compared | — |

### 5.2 Trust levels and the Trusting Trust question

- **SLSA today: Build L2.** We use GitHub-hosted runners and `actions/attest-build-provenance`
  signs the provenance. L3 needs the build isolated from signing secrets, which GitHub reaches
  with a reusable workflow that is pinned at verification with `--signer-workflow`
  ([GitHub docs][gh-slsa3]). SLSA v1.0 requires reproducibility at **no** level; it only
  mentions "whether reproducible builds are used" ([SLSA levels][slsa]). Reproducibility is our
  extra layer, and it is what lets a third party check without trusting GitHub. **strong**
- **"Independent" must mean a different operator.** Two GitHub jobs share one vendor and one
  image supply. A real second builder is a different provider or a hospital's own machine. It
  runs the pinned container and publishes a signed in-toto statement (the same attestation
  format) with the hashes it got. Release signing waits for both. Until then, the RFC should
  say "rebuildable", not "independently rebuilt". **strong**
- **What reproducibility does not cover.** A rebuild catches a tampered *build machine* or CI.
  It does not catch a tampered *compiler* when both builders download the same rustc. That is
  Thompson's point ([Reflections on Trusting Trust][thompson]). The defence is diverse
  double-compiling ([Wheeler, DDC][wheeler]).
- **DDC with mrustc is feasible, but it is a research exercise.**
  - mrustc says it "fully bootstrap[s] (with a binary-equal 1.91.1) version 1.90.0"
    ([mrustc README][mrustc]). We pin 1.100.0, so the chain is mrustc → 1.90 → 1.91 → … → 1.100:
    about ten rustc self-builds, each taking hours.
  - It checks rustc's Rust code only. LLVM is C++, built by GCC, so trust moves to the C/C++
    compiler. That needs its own full-source bootstrap: Guix and live-bootstrap start from a
    small hex seed. Guix used mrustc for exactly this chain ([Guix: bootstrapping Rust][guix]).
  - Realistic promise: once a year, or when the toolchain changes, we publish a DDC report. It
    is not a per-release gate. **medium**

### 5.3 Suggested wording for RFC §6.4

> Release builds are reproducible: a tagged release rebuilt in the pinned build container
> produces the same SHA-256 for every server binary, the web bundle and the unsigned OS raw
> image, and the release is signed only after an independent builder, run by a different
> operator, reports the same hashes. Android APKs we publish are reproducible up to the
> signature. iOS builds and store-delivered Android builds are not verifiable by users,
> because the store re-signs or encrypts them. Reproducibility detects a compromised build
> machine, not a compromised compiler; for the compiler we pin the toolchain image by digest
> and run diverse double-compiling (mrustc) as a periodic exercise, not as a release gate.

## 6. Open questions to measure

1. Does zigbuild with steps 2–3 give equal hashes across two machines with different CPU
   models? (zig defaults to the host CPU only without an explicit target. We pass one.)
2. Is Vite 8/Rolldown output stable across runs and core counts?
3. Does the trixie mkosi have `Snapshot=`, and is ext4 from systemd-repart byte-stable with a
   fixed seed?
4. Does the Sentry plugin's debug ID depend only on chunk content?

## Appendix A: how the diff was measured

```sh
gh run download 43704156578 -n reproducible-build-diff -D repro-art   # our CI's own artifact
python3 -I elfdiff.py repro-art/server-a repro-art/server-b-other-dir # section histogram
strings -a repro-art/server-b-other-dir | grep /home/runner           # the two OpenSSL paths
```

`elfdiff.py` reads the ELF64 section headers and counts differing bytes per section. A second
pass reads each changed `.text` run as a signed 32-bit displacement and lists the deltas:
24, 32, 64, −136, −144 and −288 cover every run. diffoscope would report the same from a Linux
box. It was not used, because installing it is a download.

## Sources

[cargo185]: https://blog.rust-lang.org/inside-rust/2025/01/17/this-development-cycle-in-cargo-1.85/
[openssl-src]: https://docs.rs/crate/openssl-src/latest/source/src/lib.rs
[trimpaths]: https://github.com/rust-lang/cargo/issues/12137
[cargo-unstable]: https://doc.rust-lang.org/cargo/reference/unstable.html
[rb-variations]: https://tests.reproducible-builds.org/index_variations.html
[rb-buildpath]: https://lists.reproducible-builds.org/pipermail/rb-general/2024-February/003246.html
[rb-archives]: https://reproducible-builds.org/docs/archives/
[rb-sysimg]: https://reproducible-builds.org/docs/system-images/
[mkosi-man]: https://man.archlinux.org/man/mkosi.1
[mkosi-news]: https://github.com/systemd/mkosi/blob/main/mkosi/resources/man/mkosi.news.7.md
[mkosi-asg]: https://pkgbuild.com/~jelle/arch-mkosi-all-systems-go-2024/
[vite13672]: https://github.com/vitejs/vite/issues/13672
[rollup4909]: https://github.com/rollup/rollup/issues/4909
[fdroid]: https://f-droid.org/en/docs/Reproducible_Builds/
[ws149]: https://gitlab.com/walletscrutiny/walletScrutinyCom/-/issues/149
[rustup1252]: https://blog.rust-lang.org/2023/02/01/Rustup-1.25.2/
[gh-slsa3]: https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations/using-artifact-attestations-and-reusable-workflows-to-achieve-slsa-v1-build-level-3
[slsa]: https://slsa.dev/spec/v1.0/levels
[thompson]: https://dl.acm.org/doi/10.1145/358198.358210
[wheeler]: https://dwheeler.com/trusting-trust/
[mrustc]: https://github.com/thepowersgang/mrustc
[guix]: https://guix.gnu.org/blog/2018/bootstrapping-rust

- Cargo 1.85 development cycle (RUSTFLAGS and remap heuristic): <https://blog.rust-lang.org/inside-rust/2025/01/17/this-development-cycle-in-cargo-1.85/>
- openssl-src build logic: <https://docs.rs/crate/openssl-src/latest/source/src/lib.rs>
- trim-paths tracking issue: <https://github.com/rust-lang/cargo/issues/12137>; RFC 3127: <https://rust-lang.github.io/rfcs/3127-trim-paths.html>
- Debian test variations: <https://tests.reproducible-builds.org/index_variations.html>; build-path thread: <https://lists.reproducible-builds.org/pipermail/rb-general/2024-February/003246.html>
- reproducible-builds.org: archives <https://reproducible-builds.org/docs/archives/>, build path <https://reproducible-builds.org/docs/build-path/>, SOURCE_DATE_EPOCH <https://reproducible-builds.org/docs/source-date-epoch/>, system images <https://reproducible-builds.org/docs/system-images/>
- mkosi(1): <https://man.archlinux.org/man/mkosi.1>; mkosi news: <https://github.com/systemd/mkosi/blob/main/mkosi/resources/man/mkosi.news.7.md>; ASG 2024 talk: <https://pkgbuild.com/~jelle/arch-mkosi-all-systems-go-2024/>
- Vite #13672: <https://github.com/vitejs/vite/issues/13672>; Rollup #4909: <https://github.com/rollup/rollup/issues/4909>
- F-Droid reproducible builds: <https://f-droid.org/en/docs/Reproducible_Builds/>
- WalletScrutiny on iOS: <https://gitlab.com/walletscrutiny/walletScrutinyCom/-/issues/149>
- Rustup 1.25.2 (GPG verification experimental): <https://blog.rust-lang.org/2023/02/01/Rustup-1.25.2/>
- GitHub, SLSA v1 Build L3 with reusable workflows: <https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations/using-artifact-attestations-and-reusable-workflows-to-achieve-slsa-v1-build-level-3>
- SLSA v1.0 levels: <https://slsa.dev/spec/v1.0/levels>
- Thompson, Reflections on Trusting Trust (1984): <https://dl.acm.org/doi/10.1145/358198.358210>
- Wheeler, Diverse Double-Compiling: <https://dwheeler.com/trusting-trust/>
- mrustc: <https://github.com/thepowersgang/mrustc>
- Guix, Bootstrapping Rust: <https://guix.gnu.org/blog/2018/bootstrapping-rust>
