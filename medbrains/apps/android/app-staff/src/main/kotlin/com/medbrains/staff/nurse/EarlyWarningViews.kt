package com.medbrains.staff.nurse

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.medbrains.kit.EarlyWarning
import com.medbrains.kit.ServerTime
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTonedTile
import com.medbrains.ui.Eyebrow
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.carbon

/** Minimum touch target (Material / CLAUDE.md ≥44). */
private val TOUCH = 48.dp

/** One-of picker for a short option list; selecting the chosen one again clears it (not charted). */
@Composable
private fun OptionRow(options: List<EarlyWarning.Option>, selected: String?, short: Boolean, tag: String, onSelect: (String?) -> Unit) {
    SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().heightIn(min = TOUCH).testTag(tag)) {
        options.forEachIndexed { i, o ->
            SegmentedButton(
                selected = selected == o.code,
                onClick = { onSelect(if (selected == o.code) null else o.code) },
                shape = SegmentedButtonDefaults.itemShape(i, options.size),
                modifier = Modifier.semantics { contentDescription = o.label },
            ) { Text(if (short) o.code else o.label) }
        }
    }
}

/**
 * The bedside inputs an early-warning score needs beyond the classic vitals.
 * Nothing chosen is "not charted": the server marks the score incomplete
 * rather than scoring it normal.
 */
@Composable
fun EarlyWarningFields(
    consciousness: String?, onConsciousness: (String?) -> Unit,
    oxygenDevice: String?, onOxygenDevice: (String?) -> Unit,
    distress: String?, onDistress: (String?) -> Unit,
    field: @Composable (label: String, key: String, decimal: Boolean) -> Unit,
) {
    var deviceMenu by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Eyebrow("Early-warning score")
        Text("Consciousness (ACVPU)", style = MaterialTheme.typography.labelMedium)
        OptionRow(EarlyWarning.CONSCIOUSNESS, consciousness, short = true, tag = "ews-consciousness", onSelect = onConsciousness)
        Text("Oxygen / respiratory support", style = MaterialTheme.typography.labelMedium)
        Box {
            OutlinedButton(onClick = { deviceMenu = true }, modifier = Modifier.fillMaxWidth().heightIn(min = TOUCH).testTag("ews-oxygen-device")) {
                Text(EarlyWarning.OXYGEN_DEVICES.firstOrNull { it.code == oxygenDevice }?.label ?: "Not charted")
            }
            DropdownMenu(expanded = deviceMenu, onDismissRequest = { deviceMenu = false }) {
                DropdownMenuItem(text = { Text("Not charted") }, onClick = { onOxygenDevice(null); deviceMenu = false })
                EarlyWarning.OXYGEN_DEVICES.forEach { o ->
                    DropdownMenuItem(text = { Text(o.label) }, onClick = { onOxygenDevice(o.code); deviceMenu = false })
                }
            }
        }
        when {
            oxygenDevice == EarlyWarning.HIGH_FLOW -> field("FiO2 %", "fio2_percent", false)
            oxygenDevice != null && oxygenDevice != EarlyWarning.ROOM_AIR -> field("Oxygen flow L/min", "oxygen_flow_lpm", true)
        }
        Eyebrow("Children")
        field("Capillary refill (seconds)", "capillary_refill_seconds", true)
        Text("Respiratory distress", style = MaterialTheme.typography.labelMedium)
        OptionRow(EarlyWarning.DISTRESS, distress, short = false, tag = "ews-distress", onSelect = onDistress)
    }
}

/** The score a reading was given: band in words and colour, what was missing, next due, the escalation. */
@Composable
fun EarlyWarningResult(score: EarlyWarning.Score) {
    val tone = EarlyWarning.bandTone(score.band).carbon
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        CarbonTonedTile(tone) {
            Eyebrow("Early-warning score")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.testTag("ews-headline")) {
                Text("${EarlyWarning.toolLabel(score.tool)} ${EarlyWarning.totalText(score.total, score.incomplete)}", style = MaterialTheme.typography.titleMedium)
                CarbonTag(EarlyWarning.bandLabel(score.band), tone)
            }
            if (score.incomplete) {
                Text("Incomplete — not charted: ${EarlyWarning.missingText(score.missing)}. The score is at least ${score.total}.", style = MaterialTheme.typography.bodyMedium)
            }
            Text("Next full set due ${ServerTime.short(score.next_due_at)}", style = MaterialTheme.typography.bodyMedium)
        }
        if (score.escalation_id != null) {
            CarbonNotification(NotificationKind.Error, "Escalated", "Nurse in charge and doctors told. Acknowledge with your response on the care view.", Modifier.testTag("ews-escalated"))
        }
    }
}
