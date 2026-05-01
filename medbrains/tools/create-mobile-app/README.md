# `medbrains-create-mobile-app`

Interactive scaffolder for new MedBrains Expo Prebuild apps. Phase D
of the mobile/TV/edge roadmap.

## Run

From the monorepo root:

```sh
node medbrains/tools/create-mobile-app/src/index.mjs
```

The CLI prompts for app id, variant, display name, bundle id, modules
to scaffold, and ABDM/offline flags. It writes a complete app
workspace under `medbrains/apps/<id>/` wired to:

- `@medbrains/mobile-shell` — auth + biometric + offline
- `@medbrains/ui-mobile` — Forest+Copper components
- `@medbrains/uniffi-rn-plugin` — Rust core via UniFFI (when offline-first)

## Variants

| Variant | Distribution | Biometric default | ABHA default |
|---------|--------------|-------------------|--------------|
| `staff` | MDM internal | required | no |
| `patient` | Public store | recommended | yes |
| `tv` | Side-loaded APK | optional | no |
| `vendor` | MDM internal (skeleton) | required | no |

## Output

Generated apps are turnkey: `pnpm install` from the workspace root,
then `pnpm --filter @medbrains/<id> prebuild` materializes the iOS +
Android projects with the Rust staticlib / cdylib + Podfile +
Gradle hooks already wired.

## Tests

```sh
node --test medbrains/tools/create-mobile-app/src/render.test.mjs
```

Covers the dependency-free Handlebars-style template renderer.
