// MedBrains Android — Kotlin + Jetpack Compose (Material 3 Expressive).
// Modules: :core (Rust via UniFFI), :kit (shell), :ui (Carbon tokens + theme), :app-*.
// The plugin classpath (Android Gradle plugin, Kotlin plugins) is locked too, in this folder's
// buildscript-gradle.lockfile: every module builds with these plugins, so an unpinned transitive
// version here would reach every app. Regenerate with: ./gradlew :buildEnvironment --write-locks
buildscript {
    configurations.classpath {
        resolutionStrategy.activateDependencyLocking()
    }
}

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
    // Build tools only (lint, Kotlin plugin): raise Bouncy Castle to the app's 1.86 for
    // GHSA-9pwp-9qqc-pr26, GHSA-qp49-qgx5-5m26 and GHSA-cj8j-37rh-8475; lint's guava to
    // 33.7.2-jre for GHSA-xxph-c9ww-hj94, its commons-lang3 to 3.18.0 for GHSA-j288-q9x7-2f5v
    // and its httpclient to 4.5.14 for GHSA-7r82-7xv7-xcpj; and the Kotlin swift-export tool's
    // OpenTelemetry to 1.67.0 for GHSA-rcgg-9c38-7xpx and GHSA-ccrj-gw8r-854m. The app's
    // -android guava is pinned in app-patient.
    configurations.configureEach {
        val isLintTool = name == "androidLintTool"
        resolutionStrategy.eachDependency {
            val group = requested.group
            val artifact = requested.name
            if (group == "org.bouncycastle") useVersion("1.86")
            if (group == "io.opentelemetry") useVersion("1.67.0")
            if (isLintTool) {
                if (group == "com.google.guava" && artifact == "guava") useVersion("33.7.2-jre")
                if (group == "org.apache.commons" && artifact == "commons-lang3") useVersion("3.18.0")
                if (group == "org.apache.httpcomponents" && artifact == "httpclient") useVersion("4.5.14")
            }
        }
    }
}
