# Kept for every app that uses the Rust core.
#
# The UniFFI bindings (uniffi.edge_rn) call the native library through JNA,
# which finds classes, methods and Structure fields by name at run time.
# Renamed or removed, they fail only when the call is made — in a patient's
# registration, not at build time.
-keep class com.sun.jna.** { *; }
-keep class * implements com.sun.jna.** { *; }
-keep class uniffi.** { *; }
-dontwarn java.awt.**
