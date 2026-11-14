plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}
/**
 * The server a release build talks to. Empty or HTTPS; empty means the app reaches only the hospital its QR binding names.
 */
val releaseServerUrl: String = providers.gradleProperty("medbrains.serverUrl").orNull.orEmpty()
require(releaseServerUrl.isEmpty() || releaseServerUrl.startsWith("https://")) {
    "medbrains.serverUrl must be an https:// URL, not $releaseServerUrl"
}

android {
    sourceSets.getByName("androidTest").kotlin.srcDir("../testkit/src")
    // Shared with the web picker and iOS: one list of body regions for every surface.
    sourceSets.getByName("main").assets.srcDir("../../../packages/anatomy")
    namespace = "com.medbrains.staff"
    compileSdk = 37
    defaultConfig {
        applicationId = "com.medbrains.staff"
        minSdk = 28
        targetSdk = 37
        versionCode = rootProject.extra["appVersionCode"] as Int
        versionName = rootProject.extra["appVersionName"] as String
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        // Release CI passes this only when it uploads the R8 mapping to error tracking.
        val proguardUuid = providers.gradleProperty("sentry.proguardUuid.app-staff").orNull.orEmpty()
        buildConfigField("String", "SENTRY_PROGUARD_UUID", "\"$proguardUuid\"")
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
                proguardFiles(
                    getDefaultProguardFile("proguard-android-optimize.txt"),
                    "minified-test-rules.pro"
                )
                testProguardFiles("test-rules.pro")
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
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.runner)
    debugImplementation(libs.compose.ui.test.manifest)
}
