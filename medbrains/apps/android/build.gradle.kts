// MedBrains Android — Kotlin + Jetpack Compose (Material 3 Expressive).
// Modules: :core (Rust via UniFFI), :kit (shell), :ui (Carbon tokens + theme), :app-*.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
}

// One version for every app, never typed per module: `[workspace.package] version` in
// medbrains/Cargo.toml, and a build number of major*10000 + minor*100 + patch, so versionCode
// rises with each release (3.33.0 -> 33300). scripts/app_version.sh applies the same rule for
// iOS and checks a release tag against it.
val workspaceVersion: String = rootDir.resolve("../../Cargo.toml").readLines().let { lines ->
    lines.drop(lines.indexOf("[workspace.package]") + 1)
        .takeWhile { !it.startsWith("[") }
        .first { it.trimStart().startsWith("version") }
        .substringAfter('"').substringBefore('"')
}
val (versionMajor, versionMinor, versionPatch) = workspaceVersion.split('.').map(String::toInt)
require(versionMinor < 100 && versionPatch < 100) {
    "minor and patch must stay below 100 for the versionCode ($workspaceVersion)"
}
extra["appVersionName"] = workspaceVersion
extra["appVersionCode"] = versionMajor * 10000 + versionMinor * 100 + versionPatch
