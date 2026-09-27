package com.medbrains.staff.shared.forms

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.medbrains.ui.CarbonPicker
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.PickerOption
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/**
 * One catalogue field, drawn by its kind with the Carbon controls. It holds
 * no rule: the value goes into the draft and the core judges it.
 */
@Composable
fun CatalogueFieldView(field: CatalogueField, draft: RegistrationDraftValues, lists: OptionLists, error: String?) {
    val tag = "field-${field.id}"
    Column {
        when (field.kind) {
            FieldKind.TOGGLE -> Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                Text(field.label, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                Switch(checked = draft.isOn(field.id), onCheckedChange = { draft[field.id] = it.toString() }, modifier = Modifier.testTag(tag).semantics { contentDescription = field.label })
            }
            FieldKind.SEGMENTED -> Labelled(field.label, error) {
                val options = lists.options(field)
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().testTag(tag)) {
                    options.forEachIndexed { i, o ->
                        SegmentedButton(selected = draft[field.id] == o.value, onClick = { draft[field.id] = o.value }, shape = SegmentedButtonDefaults.itemShape(i, options.size), modifier = Modifier.testTag("$tag-${o.value}")) { Text(o.label) }
                    }
                }
            }
            FieldKind.SELECT -> CarbonPicker(field.label, lists.options(field).map { PickerOption(it.value, it.label) }, draft[field.id].ifEmpty { null }, { draft[field.id] = it.orEmpty() }, error = error, tag = tag)
            FieldKind.DATE -> Labelled(field.label, error) { DateField(draft[field.id], { draft[field.id] = it }, tag) }
            else -> CarbonTextField(
                draft[field.id], { draft[field.id] = it }, field.label, Modifier.testTag(tag), error = error,
                keyboardOptions = KeyboardOptions(keyboardType = keyboardFor(field.kind)), singleLine = field.kind != FieldKind.LONG_TEXT,
            )
        }
        field.hint?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}

private fun keyboardFor(kind: String): KeyboardType = when (kind) {
    FieldKind.PHONE -> KeyboardType.Phone
    FieldKind.EMAIL -> KeyboardType.Email
    in FieldKind.NUMERIC -> KeyboardType.Number
    else -> KeyboardType.Text
}

/** A label above a control that has none of its own, and the error below. */
@Composable
private fun Labelled(label: String, error: String?, content: @Composable () -> Unit) {
    Column {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(8.dp))
        content()
        error?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error) }
    }
}

/** An optional date: nothing until the desk picks one (an age is often all a patient knows). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DateField(value: String, onChange: (String) -> Unit, tag: String) {
    var picking by remember { mutableStateOf(false) }
    val date = runCatching { LocalDate.parse(value) }.getOrNull()
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        CarbonTertiaryButton(date?.toString() ?: "Pick a date", onClick = { picking = true }, modifier = Modifier.testTag(tag))
        if (date != null) TextButton(onClick = { onChange("") }) { Text("Clear") }
    }
    if (picking) {
        val state = rememberDatePickerState(initialSelectedDateMillis = date?.atStartOfDay(ZoneOffset.UTC)?.toInstant()?.toEpochMilli())
        DatePickerDialog(
            onDismissRequest = { picking = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { onChange(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate().toString()) }
                    picking = false
                }, modifier = Modifier.testTag("date-ok")) { Text("Use this date") }
            },
            dismissButton = { TextButton(onClick = { picking = false }) { Text("Cancel") } },
        ) { DatePicker(state = state) }
    }
}
