package com.medbrains.staff.reception

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.medbrains.kit.ApiError
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.Remote
import com.medbrains.kit.value
import com.medbrains.ui.CarbonActionRow
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonStatTile
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch

/**
 * What the desk was asked and what it said back. Open first: a question
 * nobody answered is the only thing here that needs doing.
 */
@Composable
fun EnquiryDeskScreen(nav: NavHostController, api: FrontOfficeApi) {
    val identity = LocalIdentity.current
    val scope = rememberCoroutineScope()
    val remote = remember { Remote<List<EnquiryRow>>() }
    var busyId by remember { mutableStateOf<String?>(null) }
    var failure by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) { remote.load { api.enquiries() } }
    val state by remote.state.collectAsState()
    val rows = state.value.orEmpty()
    val canLog = identity?.can("front_office.enquiry.create") == true
    val canResolve = identity?.can("front_office.enquiry.manage") == true

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-enquiry-desk")) {
        CarbonPageHeader("Reception", "Enquiry desk", "Calls and callers at the front door.")
        Row(Modifier.padding(horizontal = 16.dp)) {
            CarbonStatTile("Open", rows.count { !it.resolved }, "Waiting on an answer", Modifier.weight(1f))
            Spacer(Modifier.width(1.dp))
            CarbonStatTile("Logged", rows.size, "Enquiries today", Modifier.weight(1f))
        }
        if (canLog) {
            Column(Modifier.padding(16.dp)) {
                CarbonPrimaryButton("Log an enquiry", modifier = Modifier.testTag("enquiry-log"), onClick = { nav.navigate("log-enquiry") })
            }
        } else {
            Text(
                "This account can read the enquiry desk but not log or resolve. Ask an administrator for front_office.enquiry.create.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(16.dp).testTag("enquiry-read-only"),
            )
        }
        failure?.let { CarbonNotification(NotificationKind.Error, "Not recorded", it, Modifier.padding(horizontal = 16.dp)) }
        RemoteContent("enquiries", state, "Couldn't load the enquiries", "The hospital server did not answer. Do not read this as a quiet desk.", { it.isEmpty() }, "No enquiries yet", "Nothing has been logged at this desk today.", { scope.launch { remote.load { api.enquiries() } } }) { list ->
            Column {
                list.sortedBy { it.resolved }.forEach { enquiry ->
                    Column(Modifier.fillMaxWidth()) {
                        CarbonActionRow(
                            enquiry.caller_name ?: "Caller not named",
                            listOfNotNull(enquiry.enquiry_type, enquiry.caller_phone).joinToString(" · "),
                            onClick = {}, modifier = Modifier.fillMaxWidth().testTag("enquiry-row-${enquiry.id}"),
                        ) { CarbonTag(if (enquiry.resolved) "resolved" else "open", if (enquiry.resolved) CarbonTone.Success else CarbonTone.Warning) }
                        enquiry.response_text?.takeIf { it.isNotBlank() }?.let {
                            Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(horizontal = 16.dp).testTag("enquiry-said-${enquiry.id}"))
                        }
                        if (!enquiry.resolved && canResolve) {
                            Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                                CarbonTertiaryButton("Resolve", onClick = {
                                    scope.launch {
                                        busyId = enquiry.id; failure = null
                                        try { api.resolveEnquiry(enquiry.id); remote.load { api.enquiries() } }
                                        catch (e: ApiError) { failure = e.message } catch (e: Exception) { failure = "Could not reach the hospital server. Nothing was recorded." } finally { busyId = null }
                                    }
                                }, modifier = Modifier.fillMaxWidth().testTag("enquiry-resolve-${enquiry.id}"))
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * What was asked, and what the desk told them. The answer is typed at the
 * time, because "resolved" with no words tells the next shift nothing.
 */
@Composable
fun LogEnquiryScreen(nav: NavHostController, api: FrontOfficeApi) {
    val scope = rememberCoroutineScope()
    var caller by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var type by remember { mutableStateOf("general") }
    var said by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var failure by remember { mutableStateOf<String?>(null) }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().testTag("screen-log-enquiry")) {
        CarbonPageHeader("Enquiry desk", "Log an enquiry", "Who asked, and what they were told.")
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            CarbonTextField(caller, { caller = it }, "Caller's name", Modifier.testTag("field-caller-name"))
            CarbonTextField(phone, { phone = it }, "Phone", Modifier.testTag("field-caller-phone"), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone))
            Column {
                Text("What about", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.padding(top = 8.dp))
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().testTag("field-enquiry-type")) {
                    listOf("general" to "General", "patient" to "A patient", "billing" to "Billing", "directions" to "Directions").forEachIndexed { i, (v, label) ->
                        SegmentedButton(selected = type == v, onClick = { type = v }, shape = SegmentedButtonDefaults.itemShape(i, 4), modifier = Modifier.testTag("enquiry-type-$v")) { Text(label) }
                    }
                }
            }
            CarbonTextField(said, { said = it }, "What they were told", Modifier.testTag("field-enquiry-response"), singleLine = false)
            failure?.let { CarbonNotification(NotificationKind.Error, "Not logged", it) }
            CarbonPrimaryButton("Log the enquiry", enabled = !busy && said.isNotBlank(), modifier = Modifier.testTag("enquiry-submit"), onClick = {
                scope.launch {
                    busy = true; failure = null
                    try {
                        api.logEnquiry(NewEnquiryBody(caller.ifBlank { null }, phone.ifBlank { null }, type, said.trim()))
                        nav.popBackStack()
                    } catch (e: ApiError) { failure = e.message } catch (e: Exception) { failure = "Could not reach the hospital server. Nothing was logged." } finally { busy = false }
                }
            })
        }
    }
}
