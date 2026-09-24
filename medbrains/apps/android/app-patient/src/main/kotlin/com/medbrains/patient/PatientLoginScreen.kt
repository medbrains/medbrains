package com.medbrains.patient

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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.medbrains.kit.ApiError
import com.medbrains.kit.AuthStore
import com.medbrains.kit.TenantIdentity
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.BrandWordmark
import kotlinx.coroutines.launch

/**
 * Sign in with a code sent to the phone on the patient's record. "I already
 * have a code" skips the request: asking again retires the code they hold.
 * The verified code becomes a portal session — no role, no permissions.
 */
@Composable
fun PatientLoginScreen(auth: AuthStore) {
    val portal = LocalPortalApi.current
    val hospital = LocalHospitalCode.current
    var phone by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var codeStep by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val phoneOk = phone.trim().length >= 6

    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).safeDrawingPadding().imePadding().verticalScroll(rememberScrollState()).testTag("screen-patient-login"), horizontalAlignment = Alignment.CenterHorizontally) {
        Column(Modifier.widthIn(max = 560.dp).fillMaxWidth().padding(horizontal = 16.dp)) {
            Spacer(Modifier.height(48.dp))
            BrandWordmark()
            Spacer(Modifier.height(8.dp))
            Text(if (codeStep) "Enter your code" else "Sign in", style = MaterialTheme.typography.headlineLarge)
            Spacer(Modifier.height(8.dp))
            Text(if (codeStep) "We sent a 6-digit code to $phone." else "Use the phone number your hospital has for you.", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(40.dp))
            if (codeStep) {
                CarbonTextField(code, { code = it }, "Sign-in code", Modifier.testTag("code"), error = error, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword))
            } else {
                CarbonTextField(phone, { phone = it }, "Phone number", Modifier.testTag("phone"), error = error, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone))
            }
            Spacer(Modifier.height(32.dp))
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (codeStep) {
                    CarbonPrimaryButton("Sign in", enabled = !busy && code.length >= 6, modifier = Modifier.testTag("verify"), onClick = {
                        scope.launch {
                            busy = true; error = null
                            try {
                                val s = portal.verifyCode(hospital, phone.trim(), code)
                                auth.adopt(s.token, who = TenantIdentity(s.tenant_id, s.patient_id, phone, "You", null, emptyList(), emptyList()))
                            } catch (e: ApiError) {
                                error = if (e.status in listOf(400, 401, 403)) "That code did not work. Check it, or ask for a new one." else e.message
                            } catch (e: Exception) { error = "Could not reach the hospital server." } finally { busy = false }
                        }
                    })
                    TextButton(onClick = { codeStep = false; code = ""; error = null }, enabled = !busy, modifier = Modifier.testTag("changePhone")) { Text("Use a different number") }
                } else {
                    CarbonPrimaryButton("Send me a code", enabled = !busy && phoneOk, modifier = Modifier.testTag("sendCode"), onClick = {
                        scope.launch {
                            busy = true; error = null
                            try { portal.requestCode(hospital, phone.trim()); codeStep = true } catch (e: ApiError) { error = "Could not send the code. Check the number and try again." } catch (e: Exception) { error = "Could not reach the hospital server." } finally { busy = false }
                        }
                    })
                    TextButton(onClick = { codeStep = true; error = null }, enabled = !busy && phoneOk, modifier = Modifier.testTag("haveCode")) { Text("I already have a code") }
                }
            }
        }
    }
}
