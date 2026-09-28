# The journey tests' own dependencies, when `-Pminified` shrinks the test APK:
# error-prone annotations name a javac type that no Android runtime has.
-dontwarn javax.lang.model.element.Modifier
# The test APK's own classes: JUnit finds tests and helpers by name, and R8
# otherwise strips them all — a run of zero tests that reports success.
-keep class com.medbrains.staff.** { *; }
-keep class com.medbrains.testkit.** { *; }
