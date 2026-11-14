plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}
/**
 * The server a release build talks to. Empty or HTTPS; required for a release build, because the patient app has no other way to find its hospital.
 */
val releaseServerUrl: String = providers.gradleProperty("medbrains.serverUrl").orNull.orEmpty()
require(releaseServerUrl.isEmpty() || releaseServerUrl.startsWith("https://")) {
    "medbrains.serverUrl must be an https:// URL, not $releaseServerUrl"
}
// Checked when a release variant actually builds (`assemble`, `build`, `bundleRelease`, ...),
// not by guessing from the task names on the command line.
val requireReleaseServerUrl = tasks.register("requireReleaseServerUrl") {
    val url = releaseServerUrl
    doLast {
        require(url.isNotEmpty()) {
            "A patient release build needs -Pmedbrains.serverUrl=https://<hospital server>"
        }
    }
}
tasks.matching { it.name == "preReleaseBuild" }.configureEach { dependsOn(requireReleaseServerUrl) }

android {
    sourceSets.getByName("androidTest").kotlin.srcDir("../testkit/src")
    // Shared with the web: one DPDP privacy notice for every surface.
    sourceSets.getByName("main").assets.srcDir("../../../packages/privacy")
    namespace = "com.medbrains.patient"
    compileSdk = 37
    defaultConfig {
        applicationId = "com.medbrains.patient"
        minSdk = 28
        targetSdk = 37
        versionCode = rootProject.extra["appVersionCode"] as Int
        versionName = rootProject.extra["appVersionName"] as String
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    buildTypes {
        // Cleartext and the launch-intent server override are for the emulator
        // and UI tests only; see AppConfig.
        debug {
            manifestPlaceholders["usesCleartext"] = "true"
            // The emulator's view of the developer's machine.
            buildConfigField("String", "DEFAULT_SERVER_URL", "\"http://10.0.2.2:3000\"")
            // `-Pminified` runs the journeys against R8-processed code: the only
            // way a keep rule missing from release shows up before a user does.
            if (providers.gradleProperty("minified").isPresent) {
                isMinifyEnabled = true
                proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            }
        }
        release {
            // R8 shrinks and renames the code so the shipped app does not read as
            // source; the core's keep rules protect the JNA bridge.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            manifestPlaceholders["usesCleartext"] = "false"
            // No cleartext default in a shipped app: the server is the one this build is for
            // (`-Pmedbrains.serverUrl=https://…`), HTTPS only.
            buildConfigField("String", "DEFAULT_SERVER_URL", "\"$releaseServerUrl\"")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlin {
        jvmToolchain(17)
        compilerOptions { allWarningsAsErrors.set(true) }
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}
dependencies {
    implementation(project(":kit"))
    implementation(project(":ui"))
    implementation(libs.activity.compose)
    implementation(libs.navigation.compose)
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.health.connect)
    constraints {
        // Health Connect pulls kotlinx-coroutines-guava, whose guava is the -jre (server JVM)
        // flavour. Hold the Android flavour at a version that wins the conflict.
        implementation("com.google.guava:guava:32.0.1-android")
    }
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.runner)
    debugImplementation(libs.compose.ui.test.manifest)
}
