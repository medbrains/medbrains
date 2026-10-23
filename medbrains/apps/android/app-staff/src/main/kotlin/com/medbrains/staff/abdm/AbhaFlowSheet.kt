package com.medbrains.staff.abdm

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.selection.toggleable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.medbrains.kit.Abha
import com.medbrains.kit.AbhaApi
import com.medbrains.kit.AbhaCardQr
import com.medbrains.kit.AbhaField
import com.medbrains.kit.AbhaOtpVia
import com.medbrains.kit.AbhaStage
import com.medbrains.kit.AbhaVerificationStep
import com.medbrains.kit.AbhaVerifiedProfile
import com.medbrains.kit.AbhaVerifyMethod
import com.medbrains.kit.ApiError
import com.medbrains.kit.LocalApiClient
import com.medbrains.kit.OurDetails
import com.medbrains.ui.BarcodeScanner
import com.medbrains.ui.CarbonChoiceRow
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonSectionTitle
import com.medbrains.ui.CarbonSegmented
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.NotificationKind
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** What a finished verification hands back: the proof's id, what ABDM holds, and the details the desk chose to take from it. */
data class AbhaConfirmation(val verificationId: String, val profile: AbhaVerifiedProfile, val apply: Set<AbhaField>)

enum class AbhaFlowMode(val title: String, val tag: String) { VERIFY("Verify ABHA", "verify"), CREATE("Create ABHA", "create") }

private const val SECOND_MS = 1_000L

/**
 * One ABHA conversation with ABDM, step by step. Verify and Create both run
 * on it. Plain `remember` state, never `rememberSaveable`: nothing typed here
 * — the Aadhaar number least of all — goes into the saved-instance bundle.
 */
class AbhaFlowState {
    var step by mutableStateOf<AbhaVerificationStep?>(null)
    var otp by mutableStateOf("")
    var failure by mutableStateOf<String?>(null)
    var busy by mutableStateOf(false)
    /** Seconds before ABDM will send another OTP. */
    var wait by mutableIntStateOf(0)
    /** Bumped on every step, so the resend countdown restarts. */
    var sent by mutableIntStateOf(0)
        private set

    suspend fun run(op: suspend () -> AbhaVerificationStep) {
        busy = true; failure = null
        try {
            val next = op()
            otp = ""; step = next; wait = next.resend_after_seconds ?: 0; sent += 1
        } catch (e: ApiError) { failure = e.message } catch (e: Exception) { failure = "Could not reach the hospital server." } finally { busy = false }
    }
}

/**
 * "Verify ABHA" or "Create ABHA", in a sheet over the screen that asked —
 * registration or a patient's record — so closing it (Back) leaves that
 * screen exactly as it was. [onConfirm] answers a failure to show, or null
 * when done (the sheet then closes).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AbhaFlowSheet(mode: AbhaFlowMode, ours: OurDetails, confirmLabel: String, onDismiss: () -> Unit, mobile: String = "", onConfirm: suspend (AbhaConfirmation) -> String?) {
    val confirm: suspend (AbhaConfirmation) -> String? = { c -> onConfirm(c).also { if (it == null) onDismiss() } }
    ModalBottomSheet(onDismissRequest = onDismiss, modifier = Modifier.testTag("abha-${mode.tag}-sheet")) {
        Column(Modifier.fillMaxWidth().imePadding().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            CarbonPageHeader("ABHA", mode.title)
            when (mode) {
                AbhaFlowMode.VERIFY -> AbhaVerifyFlow(ours, confirmLabel, confirm)
                AbhaFlowMode.CREATE -> AbhaCreateFlow(ours, mobile, confirmLabel, confirm)
            }
            CarbonTertiaryButton("Close", onClick = onDismiss, modifier = Modifier.fillMaxWidth().testTag("abha-close"))
            Spacer(Modifier.height(24.dp))
        }
    }
}

/** "Resend OTP" as ABDM allows it: after the pause, at most twice; once none are left, says so instead. */
@Composable
private fun ResendControl(flow: AbhaFlowState, resend: () -> Unit) {
    val left = flow.step?.resends_left
    if (left != 0) {
        CarbonTertiaryButton(Abha.resendLabel(flow.wait), enabled = !flow.busy && flow.wait == 0, modifier = Modifier.fillMaxWidth().testTag("abha-resend"), onClick = resend)
    }
    Abha.resendNote(left)?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
}

@Composable
private fun FailureNote(message: String?) {
    message?.let { CarbonNotification(NotificationKind.Error, "ABDM said no", it, Modifier.testTag("abha-failure")) }
}

/** The OTP ABDM sent, as the person reads it out: digits only, six at most. */
@Composable
private fun OtpField(flow: AbhaFlowState) {
    CarbonTextField(flow.otp, { flow.otp = Abha.otpInput(it) }, "OTP — ask the patient to read it out", Modifier.testTag("abha-otp"), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword))
}

/** Find the person's ABHA by number, mobile, Aadhaar, address or a scanned card; they read out the OTP; the desk compares and chooses. */
@Composable
private fun AbhaVerifyFlow(ours: OurDetails, confirmLabel: String, onConfirm: suspend (AbhaConfirmation) -> String?) {
    val client = LocalApiClient.current
    val api = remember(client) { AbhaApi(client) }
    val scope = rememberCoroutineScope()
    val flow = remember { AbhaFlowState() }
    var method by remember { mutableStateOf(AbhaVerifyMethod.ABHA_NUMBER) }
    var via by remember { mutableStateOf(AbhaOtpVia.AADHAAR) }
    var value by remember { mutableStateOf("") }
    var chosen by remember { mutableStateOf<String?>(null) }
    var tried by remember { mutableStateOf(false) }
    var scanning by remember { mutableStateOf(false) }
    var scanKey by remember { mutableIntStateOf(0) }
    var card by remember { mutableStateOf<AbhaCardQr?>(null) }
    LaunchedEffect(flow.sent) { while (flow.wait > 0) { delay(SECOND_MS); flow.wait -= 1 } }
    FailureNote(flow.failure)
    val step = flow.step
    if (step == null) {
        if (scanning) {
            BarcodeScanner(title = "Scan the ABHA card", hint = "Hold the QR on the patient's ABHA card to the camera.", resumeKey = scanKey, onScan = { payload ->
                scanning = false
                scope.launch {
                    try {
                        val read = api.readQr(payload)
                        card = read
                        Abha.lookup(read)?.let { (m, v) -> method = m; value = v }
                        flow.failure = null
                    } catch (e: ApiError) { flow.failure = e.message } catch (e: Exception) { flow.failure = "Could not reach the hospital server." }
                    scanKey++
                }
            })
            CarbonTertiaryButton("Cancel the scan", onClick = { scanning = false }, modifier = Modifier.fillMaxWidth().testTag("abha-scan-cancel"))
            return
        }
        CarbonTertiaryButton("Scan the ABHA card", onClick = { scanning = true }, modifier = Modifier.fillMaxWidth().testTag("abha-scan-card"))
        card?.let { CarbonNotification(NotificationKind.Info, "What the card says — verify it by OTP", Abha.cardSummary(it), Modifier.testTag("abha-card-read")) }
        CarbonSectionTitle("Find the ABHA by")
        AbhaVerifyMethod.entries.forEach { m ->
            CarbonChoiceRow(m.label, null, method == m, { method = m; value = Abha.lookupInput(m, value) }, Modifier.testTag("abha-method-${m.name.lowercase()}"))
        }
        val secret = method == AbhaVerifyMethod.AADHAAR
        CarbonTextField(value, { value = Abha.lookupInput(method, it) }, method.valueLabel, Modifier.testTag("abha-lookup-value"), error = if (tried) Abha.lookupProblem(method, value) else null,
            keyboardOptions = KeyboardOptions(keyboardType = when { secret -> KeyboardType.NumberPassword; method == AbhaVerifyMethod.ABHA_ADDRESS -> KeyboardType.Email; else -> KeyboardType.Number }, autoCorrectEnabled = false),
            visualTransformation = if (secret) PasswordVisualTransformation() else VisualTransformation.None)
        if (secret) Text("12 digits. Sent to ABDM encrypted; not saved here.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (Abha.choosesOtpVia(method)) {
            Text("Send the OTP to", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            CarbonSegmented("Send the OTP to", listOf(AbhaOtpVia.AADHAAR to "Aadhaar mobile", AbhaOtpVia.ABDM to "ABHA mobile"), via, { via = it }, "abha-otp-via")
        }
        CarbonPrimaryButton(if (method == AbhaVerifyMethod.FIND_MOBILE) "Find ABHAs" else "Send OTP", enabled = !flow.busy, modifier = Modifier.testTag("abha-send-otp"), onClick = {
            tried = true
            if (Abha.lookupProblem(method, value) == null) scope.launch { flow.run { api.start(method, value, via) } }
        })
        return
    }
    when (step.stage) {
        AbhaStage.OTP_SENT -> {
            Text(step.message ?: "ABDM has sent the patient an OTP.", style = MaterialTheme.typography.bodyLarge)
            OtpField(flow)
            CarbonPrimaryButton("Verify", enabled = !flow.busy && flow.otp.length == Abha.OTP_LENGTH, modifier = Modifier.testTag("abha-verify-otp"), onClick = { scope.launch { flow.run { api.submitOtp(step.id, flow.otp) } } })
            // An Aadhaar login sends the number again: the server never keeps it.
            ResendControl(flow) { scope.launch { flow.run { api.resend(step.id, value.takeIf { method == AbhaVerifyMethod.AADHAAR }) } } }
        }
        AbhaStage.CHOOSE_ACCOUNT, AbhaStage.SEARCH_RESULTS -> {
            val found = step.stage == AbhaStage.SEARCH_RESULTS
            step.message?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
            CarbonSectionTitle(if (found) "Which ABHA is the patient's? ABDM sends the OTP to it." else "Several ABHAs use this mobile — which is the patient's?")
            step.accounts.forEach { a ->
                CarbonChoiceRow("${a.name ?: "Unnamed"} · ${a.abha_number}", listOfNotNull(a.abha_address, a.gender, a.year_of_birth).joinToString(" · "), chosen == a.abha_number, { chosen = a.abha_number }, Modifier.testTag("abha-account-${a.abha_number}"))
            }
            CarbonPrimaryButton(if (found) "Send OTP to this ABHA" else "Continue", enabled = chosen != null && !flow.busy, modifier = Modifier.testTag("abha-account-continue"), onClick = {
                chosen?.let { number -> scope.launch { flow.run { api.chooseAccount(step.id, number) } } }
            })
        }
        else -> step.profile?.let { AbhaVerifiedSection(step, it, ours, confirmLabel, onConfirm) }
    }
}

/**
 * Create an ABHA with the patient's Aadhaar: consent read out, Aadhaar OTP,
 * the mobile for the ABHA (its own OTP if not the Aadhaar one), an address.
 * If they already have one, ABDM answers with it.
 */
@Composable
private fun AbhaCreateFlow(ours: OurDetails, formMobile: String, confirmLabel: String, onConfirm: suspend (AbhaConfirmation) -> String?) {
    val client = LocalApiClient.current
    val api = remember(client) { AbhaApi(client) }
    val scope = rememberCoroutineScope()
    val flow = remember { AbhaFlowState() }
    var consent by remember { mutableStateOf(false) }
    // Held only while the first OTP is outstanding; never stored, saved or logged.
    var aadhaar by remember { mutableStateOf("") }
    var mobile by remember { mutableStateOf(Abha.mobile(formMobile).orEmpty()) }
    LaunchedEffect(flow.sent) { while (flow.wait > 0) { delay(SECOND_MS); flow.wait -= 1 } }
    var address by remember { mutableStateOf("") }
    fun run(op: suspend () -> AbhaVerificationStep) = scope.launch {
        flow.run(op)
        // Not needed past the first OTP: dropped as soon as it is used.
        if (flow.step?.stage != AbhaStage.OTP_SENT) aadhaar = ""
    }
    FailureNote(flow.failure)
    val step = flow.step
    if (step == null) {
        CarbonNotification(NotificationKind.Info, "Terms and Conditions — read these to the patient", Abha.ENROL_CONSENT)
        Row(Modifier.fillMaxWidth().toggleable(consent, role = Role.Checkbox, onValueChange = { consent = it }).testTag("abha-consent"), verticalAlignment = Alignment.CenterVertically) {
            Checkbox(consent, onCheckedChange = null)
            Text("I agree — the patient consents to creating their ABHA with Aadhaar (ABDM consent v${Abha.ENROL_CONSENT_VERSION})", style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(start = 8.dp))
        }
        CarbonTextField(aadhaar, { aadhaar = Abha.aadhaarInput(it) }, "Aadhaar number — 12 digits, sent to ABDM encrypted, not saved here", Modifier.testTag("abha-aadhaar"),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword, autoCorrectEnabled = false), visualTransformation = PasswordVisualTransformation())
        CarbonPrimaryButton("Send OTP to the Aadhaar mobile", enabled = consent && aadhaar.length == Abha.AADHAAR_LENGTH && !flow.busy, modifier = Modifier.testTag("abha-aadhaar-send"), onClick = {
            val a = aadhaar; val c = consent
            run { api.startEnrolment(a, c) }
        })
        return
    }
    when (step.stage) {
        AbhaStage.OTP_SENT -> {
            Text(step.message ?: "ABDM has sent an OTP to the Aadhaar mobile.", style = MaterialTheme.typography.bodyLarge)
            OtpField(flow)
            CarbonTextField(mobile, { mobile = Abha.mobileInput(it) }, "Mobile for the ABHA — a different one gets its own OTP next", Modifier.testTag("abha-mobile"), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone))
            CarbonPrimaryButton("Create ABHA", enabled = !flow.busy && flow.otp.length == Abha.OTP_LENGTH && mobile.length == Abha.MOBILE_LENGTH, modifier = Modifier.testTag("abha-create"), onClick = {
                val otp = flow.otp; val m = mobile
                run { api.enrolmentOtp(step.id, otp, m) }
            })
            ResendControl(flow) {
                val a = aadhaar
                run { api.resendEnrolment(step.id, a) }
            }
        }
        AbhaStage.MOBILE_OTP_SENT -> {
            Text(step.message ?: "ABDM has sent an OTP to the new mobile.", style = MaterialTheme.typography.bodyLarge)
            OtpField(flow)
            CarbonPrimaryButton("Verify mobile", enabled = !flow.busy && flow.otp.length == Abha.OTP_LENGTH, modifier = Modifier.testTag("abha-verify-mobile"), onClick = {
                val otp = flow.otp
                run { api.enrolmentMobileOtp(step.id, otp) }
            })
            ResendControl(flow) { run { api.resendEnrolment(step.id, null) } }
        }
        AbhaStage.CHOOSE_ADDRESS -> {
            CarbonSectionTitle("Choose an ABHA address — the patient's easy-to-remember health ID")
            step.suggestions.forEach { s -> CarbonChoiceRow(s, null, address == s, { address = s }) }
            CarbonTextField(address, { address = it.trim() }, "Or type one — letters, numbers, dot or underscore; ABDM adds the @ part", Modifier.testTag("abha-address"),
                error = if (address.isEmpty()) null else Abha.addressProblem(address), keyboardOptions = KeyboardOptions(autoCorrectEnabled = false))
            CarbonPrimaryButton("Create ABHA address", enabled = !flow.busy && Abha.addressProblem(address) == null, modifier = Modifier.testTag("abha-address-create"), onClick = {
                val a = address
                run { api.chooseAddress(step.id, a) }
            })
        }
        else -> step.profile?.let { AbhaVerifiedSection(step, it, ours, confirmLabel, onConfirm) }
    }
}
