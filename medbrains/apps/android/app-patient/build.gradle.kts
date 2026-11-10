plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}
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
        versionCode = 1
        versionName = "1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    buildTypes {
        // Cleartext and the launch-intent server override are for the emulator
        // and UI tests only; see AppConfig.
        debug {
            manifestPlaceholders["usesCleartext"] = "true"
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
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.runner)
    debugImplementation(libs.compose.ui.test.manifest)
}
