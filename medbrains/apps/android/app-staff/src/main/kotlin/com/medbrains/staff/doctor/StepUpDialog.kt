package com.medbrains.staff.doctor

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.medbrains.kit.ApiError
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTextField
import kotlinx.coroutines.launch

/**
 * "Confirm it's you": the password again before a signature, as the web asks
 * with its own prompt. The field takes focus on open and the keyboard's Done
 * submits; a wrong password says so under the field and keeps the dialog
 * open. On success [onConfirmed] retries the action that asked.
 */
@Composable
fun StepUpDialog(stepUp: suspend (String) -> Unit, onDismiss: () -> Unit, onConfirmed: suspend () -> Unit) {
    var password by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val focus = remember { FocusRequester() }
    val scope = rememberCoroutineScope()

    fun confirm() {
        if (password.isEmpty() || busy) return
        scope.launch {
            busy = true
            try {
                stepUp(password)
                onDismiss()
                onConfirmed()
            } catch (e: ApiError) {
                error = e.message
                password = ""
                focus.requestFocus()
            } catch (e: Exception) {
                error = "Could not reach the hospital server."
            } finally { busy = false }
        }
    }

    LaunchedEffect(Unit) { focus.requestFocus() }
    AlertDialog(
        onDismissRequest = onDismiss,
        modifier = Modifier.testTag("step-up-sheet"),
        title = { Text("Confirm it's you") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("Signing puts your name to this record. Enter your password to continue.")
                CarbonTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = "Password",
                    error = error,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { confirm() }),
                    modifier = Modifier.focusRequester(focus).testTag("step-up-password"),
                )
            }
        },
        confirmButton = {
            CarbonPrimaryButton(if (busy) "Checking…" else "Confirm and sign", onClick = { confirm() },
                enabled = password.isNotEmpty() && !busy, modifier = Modifier.testTag("step-up-confirm"))
        },
        dismissButton = {
            CarbonTertiaryButton("Cancel", onClick = onDismiss, modifier = Modifier.testTag("step-up-cancel"))
        },
    )
}
