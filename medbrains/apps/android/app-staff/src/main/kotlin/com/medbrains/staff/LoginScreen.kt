package com.medbrains.staff

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.medbrains.kit.AuthStore
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.BrandWordmark
import kotlinx.coroutines.launch

/**
 * Sign-in on the Carbon grid: eyebrow, a light heading, two Field-01
 * inputs with the IME action advancing username → password → submit, an
 * inline error that says what to do, one full-width primary action with
 * its glyph on the right. The keyboard never covers the button (imePadding).
 */
@Composable
fun LoginScreen(auth: AuthStore) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var signingIn by remember { mutableStateOf(false) }
    val error by auth.lastError.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    val passwordFocus = remember { FocusRequester() }

    fun submit() {
        if (username.isBlank() || password.isBlank() || signingIn) return
        signingIn = true
        scope.launch {
            auth.signIn(username.trim(), password)
            signingIn = false
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).safeDrawingPadding().imePadding().verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(
            modifier = Modifier.widthIn(max = 560.dp).fillMaxWidth().padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(0.dp),
        ) {
            Spacer(Modifier.height(48.dp))
            BrandWordmark()
            Spacer(Modifier.height(8.dp))
            Text("Sign in", style = MaterialTheme.typography.headlineLarge, color = MaterialTheme.colorScheme.onBackground)
            Spacer(Modifier.height(8.dp))
            Text("Use the account your hospital gave you.", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(40.dp))
            CarbonTextField(
                value = username,
                onValueChange = { username = it },
                label = "Username or email",
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                keyboardActions = KeyboardActions(onNext = { passwordFocus.requestFocus() }),
                modifier = Modifier.testTag("username"),
            )
            Spacer(Modifier.height(24.dp))
            CarbonTextField(
                value = password,
                onValueChange = { password = it },
                label = "Password",
                error = error,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Go),
                keyboardActions = KeyboardActions(onGo = { submit() }),
                modifier = Modifier.focusRequester(passwordFocus).testTag("password"),
            )
            Spacer(Modifier.height(32.dp))
            CarbonPrimaryButton(
                text = if (signingIn) "Signing in…" else "Sign in",
                onClick = { submit() },
                enabled = username.isNotBlank() && password.isNotBlank() && !signingIn,
                modifier = Modifier.testTag("signIn"),
            )
        }
    }
}
