package com.medbrains.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

/** One choice from a short list, shown as a Carbon field. */
data class PickerOption(val id: String, val label: String)

/**
 * One choice from a short list — a department, a consultant — as a Carbon
 * field: label above, the current choice on the Gray-10 ground with a
 * hairline under it, a chevron. Material's dropdown menu underneath, so
 * TalkBack gets the platform's own control. `null` shows the placeholder; an
 * entry for it is offered when [allowNone] so the desk can clear the choice.
 */
@Composable
fun CarbonPicker(
    label: String,
    options: List<PickerOption>,
    selection: String?,
    onSelect: (String?) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "Choose",
    error: String? = null,
    allowNone: Boolean = true,
    tag: String? = null,
) {
    var open by remember { mutableStateOf(false) }
    val current = options.firstOrNull { it.id == selection }?.label ?: placeholder
    val tagged: (String) -> Modifier = { suffix -> if (tag != null) Modifier.testTag("$tag$suffix") else Modifier }
    Column(modifier.fillMaxWidth()) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(8.dp))
        Box {
            Row(
                Modifier.fillMaxWidth().heightIn(min = TAP_TARGET_DP.dp)
                    .background(Carbon.ink[1])
                    .clickable(role = Role.DropdownList) { open = true }
                    .semantics { contentDescription = "$label: $current" }
                    .then(tagged(""))
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(current, style = MaterialTheme.typography.bodyLarge, color = if (selection == null) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface, modifier = Modifier.weight(1f))
                Icon(Icons.Filled.ArrowDropDown, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Box(Modifier.fillMaxWidth().height(if (error == null) 1.dp else 2.dp).background(if (error == null) MaterialTheme.colorScheme.outline else MaterialTheme.colorScheme.error).align(Alignment.BottomCenter))
            DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
                if (allowNone) DropdownMenuItem(text = { Text(placeholder) }, onClick = { onSelect(null); open = false }, modifier = tagged("-none"))
                options.forEach { option ->
                    DropdownMenuItem(text = { Text(option.label) }, onClick = { onSelect(option.id); open = false }, modifier = tagged("-${option.id}"))
                }
            }
        }
        if (error != null) {
            Spacer(Modifier.height(4.dp))
            Text(error, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
        }
    }
}
