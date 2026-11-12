package com.medbrains.kit

import org.junit.Assert.assertEquals
import org.junit.Test

/** Which server a launch reaches: override, then binding, then the build's default. */
class ServerUrlTest {
    private val release = "https://hospital.example"

    @Test
    fun aBoundHospitalWinsOverTheBuildDefault() {
        assertEquals(
            "https://bound.example",
            chooseServerUrl(null, "https://bound.example", release)
        )
    }

    @Test
    fun withNoBindingTheBuildDefaultIsUsed() {
        assertEquals(release, chooseServerUrl(null, null, release))
    }

    @Test
    fun aDebugOverrideWinsOverEverything() {
        assertEquals(
            "http://10.0.2.2:3000",
            chooseServerUrl("http://10.0.2.2:3000", "https://bound.example", release)
        )
    }

    @Test
    fun aBlankOverrideOrBindingIsIgnoredRatherThanUsedAsAServer() {
        assertEquals(release, chooseServerUrl("", " ", release))
    }
}
