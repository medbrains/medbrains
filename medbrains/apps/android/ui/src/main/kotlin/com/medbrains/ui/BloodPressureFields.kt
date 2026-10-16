package com.medbrains.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.medbrains.kit.BloodPressure

/**
 * One blood-pressure reading as two numbers side by side: systolic (high)
 * then diastolic (low), in mmHg. Errors show once a field is left, or on both
 * when [showErrors] is set after a refused save. The keyboard's Next moves from
 * systolic to diastolic.
 */
@Composable
fun BloodPressureFields(
    systolic: String,
    onSystolicChange: (String) -> Unit,
    diastolic: String,
    onDiastolicChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    showErrors: Boolean = false,
) {
    val errors = BloodPressure.validate(systolic, diastolic)
    val focus = LocalFocusManager.current
    var leftSystolic by remember { mutableStateOf(false) }
    var leftDiastolic by remember { mutableStateOf(false) }
    var focused by remember { mutableStateOf<String?>(null) }

    fun track(side: String) = Modifier.onFocusChanged { state ->
        if (state.isFocused) {
            focused = side
        } else if (focused == side) {
            focused = null
            if (side == "systolic") leftSystolic = true else leftDiastolic = true
        }
    }

    Column(modifier.semantics { contentDescription = "Blood pressure" }) {
        Text("Blood pressure", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f)) {
                CarbonTextField(
                    systolic, onSystolicChange, "Systolic (high) mmHg",
                    Modifier.testTag("bp-systolic").then(track("systolic")),
                    error = errors.systolic.takeIf { showErrors || leftSystolic },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Next),
                    keyboardActions = KeyboardActions(onNext = { focus.moveFocus(FocusDirection.Next) }),
                )
            }
            Column(Modifier.weight(1f)) {
                CarbonTextField(
                    diastolic, onDiastolicChange, "Diastolic (low) mmHg",
                    Modifier.testTag("bp-diastolic").then(track("diastolic")),
                    error = errors.diastolic.takeIf { showErrors || leftDiastolic },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Next),
                )
            }
        }
    }
}
