# `-Pminified` only, never release. The test APK runs against the shrunk app
# and borrows the app's copy of these libraries; keep them whole so the
# journeys load. Our own code and the JNA bridge are still shrunk as release.
-keep class kotlin.** { *; }
-keep class kotlinx.** { *; }
-keep class androidx.** { *; }
-keep class org.junit.** { *; }
