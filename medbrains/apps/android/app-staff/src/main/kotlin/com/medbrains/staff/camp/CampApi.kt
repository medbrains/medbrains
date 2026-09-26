package com.medbrains.staff.camp

import com.medbrains.kit.ApiClient
import com.medbrains.staff.doctor.ModuleToken
import com.medbrains.staff.doctor.WorklistToken
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

@Serializable private data class StationCallNext(val counter_label: String, val module: String, val scope: String, val scope_id: String)

class CampApi(private val client: ApiClient) {
    suspend fun stations(): List<CampStation> = client.get("/api/tokens/camp-stations")
    suspend fun queue(station: CampStation): List<WorklistToken> =
        client.get("/api/tokens/worklist?module=camp&scope=counter&scope_id=${station.counter_id}")

    /** The server picks who is next under its lock; `null` means nobody waits. */
    suspend fun callNext(station: CampStation, room: String): ModuleToken? {
        val body = StationCallNext(room, "camp", "counter", station.counter_id)
        val text = client.call("POST", "/api/tokens/call-next", client.json.encodeToString(StationCallNext.serializer(), body))
        return if (text.isBlank() || text == "null") null else client.json.decodeFromString(ModuleToken.serializer(), text)
    }

    /** Done here — the patient goes on to the next station. */
    suspend fun complete(id: String): ModuleToken = client.post("/api/tokens/$id/complete")

    /** Done, and needs no further station — no medicine, so no pharmacy queue. */
    suspend fun finish(id: String): ModuleToken = client.post("/api/tokens/$id/finish")
    suspend fun noShow(id: String): ModuleToken = client.post("/api/tokens/$id/no-show")
    suspend fun register(body: CampRegistrationBody): CampRegistered = client.post("/api/camp/registrations", body)
}
