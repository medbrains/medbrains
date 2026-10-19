# Mobile store lanes

One Fastfile for every `apps/mobile-*` app. Each lane takes `app:<name>` and
reads that app's own `app.json`, so bundle ids and package names are never
restated here.

```
bundle install

bundle exec fastlane doctor        app:staff   # check credentials, build nothing
bundle exec fastlane ios beta      app:staff   # -> TestFlight
bundle exec fastlane android beta  app:staff   # -> Play internal track
bundle exec fastlane ios release   app:staff   # promote to the App Store
bundle exec fastlane android release app:staff # promote internal -> production
```

`app:` accepts the short name (`staff`, `camp`, `patient`, `vendor`) or the
full directory name (`mobile-staff`).

## Credentials

All of it comes from the environment. Nothing here is committed, and nothing
should be pasted into a file inside this repo.

| Variable | What it is | Where to get it |
|---|---|---|
| `ASC_KEY_ID` | App Store Connect API key id | App Store Connect → Users and Access → Integrations |
| `ASC_ISSUER_ID` | Issuer id for that key | same page |
| `ASC_KEY_PATH` | Path to the downloaded `.p8` | keep it outside the repo |
| `MATCH_GIT_URL` | Private repo holding the signing certificates | created once by `fastlane match init` |
| `MATCH_PASSWORD` | Passphrase for that repo | shared through the password manager |
| `PLAY_JSON_KEY_PATH` | Play service-account JSON | Play Console → API access |
| `APPLE_TEAM_ID` | Developer team id | Apple Developer → Membership |

An API key rather than an Apple ID login is deliberate: it runs unattended and
carries no 2FA session to expire mid-release.

## Native projects

These are Expo apps. `apps/mobile-camp` and `apps/mobile-staff` have `ios/`
committed; the rest generate theirs. A lane runs `expo prebuild` only when the
native directory is missing — a committed `ios/` is used as it stands, because
`prebuild --clean` would discard native edits made against it.

## What this does not do

It does not build the web SPA or the server binaries. Those are the deploy's
business and terraform owns them — see
`infra/terraform/envs/clients/alagappa/build.tf`.
