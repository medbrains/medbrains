package com.medbrains.kit

/**
 * The server an app launch talks to, in order: a debug-build override from the launch intent
 * (emulator runs and UI tests), the hospital this device was bound to by its QR, and finally the
 * default the build was made with. A release build's default is an https URL or empty, never the
 * emulator's cleartext host; the apps' build files enforce that.
 */
fun chooseServerUrl(debugOverride: String?, boundApiBase: String?, buildDefault: String): String =
    debugOverride?.takeIf { it.isNotBlank() } ?: boundApiBase?.takeIf { it.isNotBlank() }
        ?: buildDefault
