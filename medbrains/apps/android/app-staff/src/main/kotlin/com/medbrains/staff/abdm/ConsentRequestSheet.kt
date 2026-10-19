package com.medbrains.staff.abdm

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.medbrains.kit.AbdmRecords
import com.medbrains.kit.AbdmRecordsApi
import com.medbrains.kit.ApiError
import com.medbrains.staff.shared.forms.LocalDateField
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPicker
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.PickerOption
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.time.LocalDate

/**
 * Ask, through ABDM, for the patient's records held by other hospitals:
 * purpose, record types, the date range and how long the copies may be kept.
 * The patient approves it in their ABHA app; the request names the doctor.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConsentRequestSheet(api: AbdmRecordsApi, patientId: String, onClose: () -> Unit, onSent: () -> Unit) {
    val today = remember { LocalDate.now() }
    var purpose by remember { mutableStateOf<String?>(AbdmRecords.DEFAULT_PURPOSE) }
    var hiTypes by remember { mutableStateOf(AbdmRecords.DEFAULT_HI_TYPES) }
    var from by remember { mutableStateOf(today.minusYears(AbdmRecords.DEFAULT_YEARS_BACK)) }
    var to by remember { mutableStateOf(today) }
    var keepDays by remember { mutableStateOf<String?>(AbdmRecords.DEFAULT_KEEP_DAYS.toString()) }
    var problem by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    fun send() {
        problem = AbdmRecords.problem(hiTypes, from, to)
        val p = purpose
        val keep = keepDays?.toIntOrNull()
        if (problem != null) return
        if (p == null || keep == null) { problem = "Choose a purpose and how long to keep the copies"; return }
        scope.launch {
            busy = true
            try {
                val row = api.raise(patientId, AbdmRecords.newRequest(p, hiTypes, from, to, keep))
                onSent()
                // ABDM can refuse it outright; that is said here, not in a toast that vanishes.
                if (row.status == AbdmRecords.FAILED) problem = row.error ?: AbdmRecords.status(row.status).hint else onClose()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                problem = (e as? ApiError)?.message ?: "Could not reach the hospital server."
            } finally {
                busy = false
            }
        }
    }

    ModalBottomSheet(onDismissRequest = onClose) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp).navigationBarsPadding().testTag("abdm-request-sheet"), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("Request records from other hospitals", style = MaterialTheme.typography.titleLarge)
            Text("ABDM asks the patient to approve this in their ABHA app, in your name and HPR ID.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            CarbonPicker("Purpose", AbdmRecords.PURPOSES.map { PickerOption(it.value, it.label) }, purpose, { purpose = it }, allowNone = false, tag = "abdm-purpose")
            Column {
                Text("Record types", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                AbdmRecords.HI_TYPES.forEach { type ->
                    val on = type.value in hiTypes
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = 48.dp)
                            .toggleable(value = on, role = Role.Checkbox, onValueChange = { hiTypes = if (it) hiTypes + type.value else hiTypes - type.value })
                            .testTag("abdm-type-${type.value}"),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Checkbox(checked = on, onCheckedChange = null)
                        Text(type.label, style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }
            LocalDateField("Records from", from, { from = it }, "abdm-from", latest = today)
            LocalDateField("Records to", to, { to = it }, "abdm-to", latest = today)
            CarbonPicker("Keep the copies for", AbdmRecords.KEEP_OPTIONS.map { PickerOption(it.value.toString(), it.label) }, keepDays, { keepDays = it }, allowNone = false, tag = "abdm-keep")
            Text("They are erased then, or as soon as the patient withdraws consent.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            problem?.let { CarbonNotification(NotificationKind.Error, "Could not request records", it, Modifier.testTag("abdm-request-problem")) }
            CarbonPrimaryButton("Send request", onClick = ::send, enabled = !busy, modifier = Modifier.testTag("abdm-send-request"))
            TextButton(onClick = onClose, modifier = Modifier.fillMaxWidth()) { Text("Cancel") }
        }
    }
}
