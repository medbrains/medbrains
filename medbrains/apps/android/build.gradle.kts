// MedBrains Android — Kotlin + Jetpack Compose (Material 3 Expressive).
// Modules: :core (Rust via UniFFI), :kit (shell), :ui (Carbon tokens + theme), :app-*.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
}
