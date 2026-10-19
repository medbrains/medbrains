# Alert sounds: provenance and licence

`calm` (soft kalimba), `attention` (bell) and `urgent` (rising C-E-G ding) were
generated for MedBrains with the sound bank of **earshot**, which is released
under the MIT licence. No third-party recordings are included.

| Folder | Format | Used by |
|---|---|---|
| `web/` | MP3 | web app and TV token board (`apps/web`) |
| `ios/` | 16-bit PCM WAV, mono 44.1 kHz | iOS staff and patient bundles (`apps/ios/project.yml`) |
| `android/raw/` | Ogg Vorbis | Android `kit` module `res/raw` (`apps/android/kit/build.gradle.kts`) |

Which sound plays for which notification is decided in `alert-sounds.json`.
