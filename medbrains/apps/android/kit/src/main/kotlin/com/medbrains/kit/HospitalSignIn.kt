package com.medbrains.kit

import kotlinx.serialization.Serializable

/** How one hospital lets its staff sign in — asked before signing in. */
@Serializable
data class SignInOptions(
    val code: String,
    val name: String,
    /** Username and password are accepted. */
    val password: Boolean,
    /** The hospital's own identity providers ("Sign in with Microsoft"). */
    val providers: List<Provider> = emptyList(),
) {
    @Serializable
    data class Provider(val id: String, val name: String, val protocol: String)
}

/**
 * What a hospital-code lookup found. A wrong code and an outage stay apart:
 * "no such hospital" is never shown for a server that could not be reached.
 */
sealed interface HospitalLookup {
    data class Found(val options: SignInOptions) : HospitalLookup
    data object Unknown : HospitalLookup
    data class Failed(val message: String) : HospitalLookup
}
