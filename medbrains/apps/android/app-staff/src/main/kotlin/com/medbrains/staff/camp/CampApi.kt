package com.medbrains.staff.camp

import com.medbrains.kit.ApiClient
import com.medbrains.staff.shared.tokens.TokenRoute
import kotlinx.serialization.Serializable

// Wire shapes mirror crates/medbrains-tokens/src/station_flow.rs and
// crates/medbrains-camp (RFCs/modules/RFC-MODULE-token-queues.md, P4).

/** One step of a running camp's route: its queue lives at [counter_id]; every room in [rooms] calls from it. */
@Serializable
data class CampStation(
    val counter_id: String,
    val camp_id: String,
    val camp_name: String,
    val name: String,
    val flow_position: Int,
    val rooms: List<String> = emptyList(),
) {
    val label: String get() = "$flow_position. $name"
}

// No defaults on request bodies: the client does not encode them.
@Serializable
data class CampRegistrationBody(
    val camp_id: String,
    val person_name: String,
    val age: Int?,
    val gender: String?,
    val phone: String?,
    val is_walk_in: Boolean,
)

/** The registration and the number kept to the last station; null only for a camp with no route. */
@Serializable data class CampRegistered(val id: String, val token_number: String? = null)

/** The camp routes this module calls; the station queues themselves go through `TokenApi` like every other queue. */
object CampEndpoint {
    const val REGISTRATIONS = "/api/camp/registrations"
}

class CampApi(private val client: ApiClient) {
    suspend fun stations(): List<CampStation> = client.get(TokenRoute.CAMP_STATIONS)
    suspend fun register(body: CampRegistrationBody): CampRegistered = client.post(CampEndpoint.REGISTRATIONS, body)
}
