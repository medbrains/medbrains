package com.medbrains.staff.reception

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.medbrains.staff.shared.forms.FieldKind
import com.medbrains.staff.shared.forms.OptionLists
import com.medbrains.staff.shared.forms.RegistrationCatalogue
import com.medbrains.staff.shared.forms.RegistrationDraftValues
import com.medbrains.ui.CarbonRow
import com.medbrains.ui.CarbonSectionTitle
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTone

/**
 * The answers read back before registering, step by step — the words the
 * desk chose (option labels, "Yes"), never record ids. Safety flags first.
 */
@Composable
fun RegistrationReview(draft: RegistrationDraftValues, lists: OptionLists, visible: Set<String>, onEdit: (Int) -> Unit) {
    val catalogue = RegistrationCatalogue.shared
    Column(Modifier.fillMaxWidth().testTag("registration-review"), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (draft.isOn("is_unknown_patient")) CarbonTag("Unknown patient", CarbonTone.Warning)
            if (draft.isOn("is_medico_legal")) CarbonTag("MLC ${draft["mlc_number"]}", CarbonTone.Danger)
            if (draft.isOn("is_vip")) CarbonTag("VIP", CarbonTone.Info)
        }
        catalogue.steps.forEachIndexed { index, step ->
            val rows = catalogue.fieldsIn(step.step).filter { it.id in visible }.mapNotNull { field ->
                val raw = draft[field.id]
                when {
                    field.kind == FieldKind.TOGGLE -> if (draft.isOn(field.id)) field.label to "Yes" else null
                    raw.isEmpty() -> null
                    else -> field.label to (lists.options(field).firstOrNull { it.value == raw }?.label ?: raw)
                }
            }
            if (rows.isNotEmpty()) {
                Column {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                        CarbonSectionTitle(step.title)
                        TextButton(onClick = { onEdit(index) }, modifier = Modifier.testTag("review-edit-${step.step}")) { Text("Change") }
                    }
                    rows.forEach { (label, value) -> CarbonRow(label, value) }
                }
            }
        }
    }
}
