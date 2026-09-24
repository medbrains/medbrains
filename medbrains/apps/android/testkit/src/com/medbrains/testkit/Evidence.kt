package com.medbrains.testkit

import android.graphics.Bitmap
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.printToString
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.rules.TestWatcher
import org.junit.runner.Description
import java.io.File

/**
 * On a failure: the semantics tree and a screenshot, written to Gradle's
 * additional-test-output dir (pulled to build/outputs/connected_android_test_additional_output), so a
 * "not found" names what the screen held instead. Mirrors JourneyCase.swift.
 * Shared by every app's androidTest source set as a source directory.
 */
class Evidence(private val compose: () -> ComposeTestRule) : TestWatcher() {
    override fun failed(e: Throwable, description: Description) {
        val args = InstrumentationRegistry.getArguments().getString("additionalTestOutputDir")
        val dir = (args?.let(::File) ?: File(InstrumentationRegistry.getInstrumentation().targetContext.filesDir, "e2e")).apply { mkdirs() }
        val name = description.methodName
        runCatching { File(dir, "$name-hierarchy.txt").writeText(compose().onRoot(useUnmergedTree = true).printToString()) }
        runCatching {
            val shot = InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot()
            File(dir, "$name.png").outputStream().use { shot.compress(Bitmap.CompressFormat.PNG, 100, it) }
        }
    }
}
