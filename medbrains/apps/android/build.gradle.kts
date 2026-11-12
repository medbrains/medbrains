// MedBrains Android — Kotlin + Jetpack Compose (Material 3 Expressive).
// Modules: :core (Rust via UniFFI), :kit (shell), :ui (Carbon tokens + theme), :app-*.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
}

// Every resolved dependency version is pinned in each module's gradle.lockfile, so a build
// cannot pick up a different transitive version than the one reviewed. Regenerate after a
// version bump with:
//   ./gradlew :core:dependencies :kit:dependencies :ui:dependencies \
//     :app-staff:dependencies :app-patient:dependencies --write-locks
allprojects {
    dependencyLocking {
        lockAllConfigurations()
        // Default lock mode, not STRICT: STRICT also demands lock state for every internal AGP
        // configuration any task resolves (androidApis, lint, R8), which would break each task
        // nobody has run with --write-locks yet. Every configuration that has a lock is enforced.
    }
}
