// The Rust core (crates/medbrains-edge-rn) for Android: UniFFI-generated Kotlin
// in src/main/kotlin plus libmedbrains_edge_rn.so per ABI in src/main/jniLibs,
// both produced by `make native-core`. Never edit the generated sources.
plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
}
android {
    namespace = "com.medbrains.core"
    compileSdk = 37
    defaultConfig { minSdk = 28 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlin { jvmToolchain(17) }
}
dependencies {
    implementation("${libs.jna.get()}@aar")
    implementation(libs.kotlinx.coroutines.android)
}
