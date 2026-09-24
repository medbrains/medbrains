plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}
android {
    sourceSets.getByName("androidTest").kotlin.srcDir("../testkit/src")
    namespace = "com.medbrains.staff"
    compileSdk = 37
    defaultConfig {
        applicationId = "com.medbrains.staff"
        minSdk = 28
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    buildTypes {
        // Cleartext and the launch-intent server override are for the emulator
        // and UI tests only; see AppConfig.
        debug { manifestPlaceholders["usesCleartext"] = "true" }
        release {
            isMinifyEnabled = false
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
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.runner)
    debugImplementation(libs.compose.ui.test.manifest)
}
