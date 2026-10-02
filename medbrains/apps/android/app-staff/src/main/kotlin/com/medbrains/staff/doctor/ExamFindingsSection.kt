package com.medbrains.staff.doctor

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.medbrains.staff.shared.bodysite.BodyMapPicker
import com.medbrains.staff.shared.bodysite.PickedSite
import com.medbrains.ui.CarbonSectionTitle
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTextField

/**
 * Findings at a place on the body — "Left knee: Effusion" — picked on the
 * body map, then described. They save with the consultation.
 */
@Composable
fun ExamFindingsSection(findings: List<ExamFinding>, canRecord: Boolean, onChange: (List<ExamFinding>) -> Unit) {
    var picking by remember { mutableStateOf(false) }
    var site by remember { mutableStateOf<PickedSite?>(null) }
    var finding by remember { mutableStateOf("") }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        CarbonSectionTitle("Findings at a site")
        if (findings.isEmpty()) Text("No site findings recorded.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        findings.forEach { f ->
            Row(Modifier.fillMaxWidth().testTag("exam-finding-row"), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                Text(f.line, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                if (canRecord) TextButton(onClick = { onChange(findings - f) }, modifier = Modifier.semantics { contentDescription = "Remove ${f.line}" }) { Text("Remove") }
            }
        }
        val chosen = site
        when {
            !canRecord -> Unit
            chosen == null -> CarbonTertiaryButton("Pick a site on the body", { picking = true }, Modifier.testTag("exam-finding-pick"))
            else -> {
                CarbonTextField(finding, { finding = it }, "Finding at ${chosen.label.lowercase()}", Modifier.testTag("field-exam-finding"), singleLine = false)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CarbonTertiaryButton("Add finding", {
                        val entry = ExamFinding(site = chosen.label, laterality = chosen.laterality, finding = finding.trim())
                        if (entry !in findings) onChange(findings + entry)
                        site = null; finding = ""
                    }, Modifier.testTag("exam-finding-add"), enabled = finding.isNotBlank())
                    TextButton(onClick = { site = null; finding = "" }) { Text("Cancel") }
                }
            }
        }
    }
    if (picking) BodyMapPicker("Finding site", onDismiss = { picking = false }) { site = it; picking = false }
}
