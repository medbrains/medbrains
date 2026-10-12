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
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.medbrains.kit.AuthStore
import com.medbrains.kit.HospitalLookup
import com.medbrains.kit.SignInOptions
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.BrandWordmark
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.NotificationKind
import kotlinx.coroutines.launch

/**
 * Sign-in in the hospital's own terms: first which hospital (its code,
 * remembered on this device), then how that hospital signs in — username and
 * password when it accepts them. The keyboard never covers the button
 * (imePadding).
 */
@Composable
fun LoginScreen(auth: AuthStore) {
    var hospitalCode by remember { mutableStateOf(auth.rememberedHospitalCode) }
    var hospital by remember { mutableStateOf<SignInOptions?>(null) }
    var lookupProblem by remember { mutableStateOf<String?>(null) }
    var looking by remember { mutableStateOf(false) }
    var breakGlass by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    fun lookUp() {
        if (hospitalCode.isBlank() || looking) return
        looking = true
        scope.launch {
            when (val found = auth.lookUpHospital(hospitalCode)) {
                is HospitalLookup.Found -> { lookupProblem = null; hospital = found.options }
                HospitalLookup.Unknown -> lookupProblem = "No hospital uses the code \"${hospitalCode.trim()}\". Check it with your IT desk."
                is HospitalLookup.Failed -> lookupProblem = "${found.message} This is a connection problem, not a wrong code."
            }
            looking = false
        }
    }
    // A code that signed in here before opens that hospital directly.
    LaunchedEffect(Unit) { if (hospitalCode.isNotBlank()) lookUp() }

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
            Text(
                hospital?.name ?: "Start with your hospital.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.testTag("hospitalName"),
            )
            Spacer(Modifier.height(40.dp))
            val chosen = hospital
            if (chosen == null) {
                CarbonTextField(
                    value = hospitalCode,
                    onValueChange = { hospitalCode = it },
                    label = "Hospital code",
                    error = lookupProblem,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters, imeAction = ImeAction.Go),
                    keyboardActions = KeyboardActions(onGo = { lookUp() }),
                    modifier = Modifier.testTag("hospitalCode"),
                )
                Spacer(Modifier.height(32.dp))
                CarbonPrimaryButton(
                    text = if (looking) "Checking…" else "Continue",
                    onClick = { lookUp() },
                    enabled = hospitalCode.isNotBlank() && !looking,
                    modifier = Modifier.testTag("continue"),
                )
            } else {
                if (chosen.password || breakGlass) {
                    PasswordForm(auth, chosen.code)
                } else {
                    CarbonNotification(
                        kind = NotificationKind.Info,
                        title = "${chosen.name} signs in with ${chosen.providers.firstOrNull()?.name ?: "single sign-on"}",
                        message = if (chosen.providers.isEmpty()) "Sign-in isn't set up for this hospital yet. Ask your IT desk."
                        else "That sign-in isn't in this app yet. Use ${chosen.name}'s web address, or ask your IT desk.",
                    )
                    Spacer(Modifier.height(16.dp))
                    CarbonTertiaryButton("Administrator? Use a password", onClick = { breakGlass = true }, modifier = Modifier.fillMaxWidth().testTag("breakGlass"))
                }
                Spacer(Modifier.height(16.dp))
                CarbonTertiaryButton(
                    "Not ${chosen.name}? Change hospital",
                    onClick = { auth.forgetHospital(); hospital = null; breakGlass = false; hospitalCode = "" },
                    modifier = Modifier.fillMaxWidth().testTag("changeHospital"),
                )
            }
        }
    }
}

/** Username and password for one hospital; every attempt is scoped to it. */
@Composable
private fun PasswordForm(auth: AuthStore, hospitalCode: String) {
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
            auth.signIn(username.trim(), password, hospitalCode)
            signingIn = false
        }
    }

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
