package com.medbrains.staff.reception

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import com.medbrains.kit.LocalApiClient
import com.medbrains.kit.LocalIdentity
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.NotificationKind
import kotlinx.coroutines.launch

/**
 * Names the picker lists the desk could not load, with a retry, so an outage never reads as a
 * hospital with no doctors or departments.
 */
@Composable
fun UnloadedListsNotice(session: ReceptionSession) {
    if (session.unloadedLists.isEmpty()) return
    val api = ReceptionApi(LocalApiClient.current)
    val identity = LocalIdentity.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    CarbonNotification(
        NotificationKind.Error,
        "Couldn't load ${joinNames(session.unloadedLists)}",
        "The hospital server did not answer, so those choices are missing here. Try again.",
        Modifier.testTag("unloaded-lists"),
    ) {
        CarbonTertiaryButton("Try again", enabled = !busy, modifier = Modifier.testTag("unloaded-lists-retry"), onClick = {
            scope.launch { busy = true; try { session.load(api) { identity?.can(it) == true } } finally { busy = false } }
        })
    }
}

/** "doctors", "doctors and camps", "departments, doctors, and camps": as iOS's ListFormatter writes it. */
private fun joinNames(names: List<String>): String =
    if (names.size <= 2) names.joinToString(" and ") else names.dropLast(1).joinToString(", ") + ", and " + names.last()
