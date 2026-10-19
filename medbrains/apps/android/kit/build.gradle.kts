plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}
android {
    namespace = "com.medbrains.kit"
    compileSdk = 37
    defaultConfig { minSdk = 28 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlin {
        jvmToolchain(17)
        compilerOptions { allWarningsAsErrors.set(true) }
    }
    buildFeatures { compose = true }
}
dependencies {
    api(project(":core"))
    api(platform(libs.compose.bom))
    api(libs.compose.runtime)
    api(libs.compose.ui)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)
    // api: ApiClient and BindingApi.pinnedClient take and return OkHttpClient.
    api(libs.okhttp)
    // Ed25519 for the hospital QR: JCA has it only from API 33, minSdk is 28.
    implementation(libs.bouncycastle.prov)
    testImplementation(libs.junit)
}
