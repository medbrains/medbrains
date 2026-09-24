package com.medbrains.staff

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.medbrains.kit.LocalApiClient
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.Remote
import com.medbrains.kit.value
import com.medbrains.staff.nurse.CodeBlueEvent
import com.medbrains.staff.nurse.EmergencyCodeActivation
import com.medbrains.staff.nurse.NurseApi
import com.medbrains.ui.Carbon
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import uniffi.edge_rn.CodeBlueRef
import uniffi.edge_rn.EmergencyCodeRef
import uniffi.edge_rn.OpenEmergencyCode
import uniffi.edge_rn.emergencyOpenCodes
import uniffi.edge_rn.emergencyRegisterTap

private const val POLL_MS = 10_000L

/**
 * The whole phone becomes the alarm. While any emergency code is open this
 * sits above every screen, blinking at 1 Hz (WCAG 2.2 SC 2.3.1) in the
 * code's fixed colour with the word beside it; reduced motion gets a solid
 * banner. Triple-tap silences on this phone only and is deliberately not
 * "I'm responding". A failed poll keeps the last good list.
 */
@Composable
fun EmergencyFlash() {
    val identity = LocalIdentity.current ?: return
    val api = NurseApi(LocalApiClient.current)
    val codeBlues = remember { Remote<List<CodeBlueEvent>>() }
    val erCodes = remember { Remote<List<EmergencyCodeActivation>>() }
    val silenced = remember { mutableStateListOf<String>() }
    LaunchedEffect(identity.userId) {
        coroutineScope {
            // Each feed is gated on its own permission: a phone without one still gets the other.
            if (identity.can("nurse.code_blue.view")) async { codeBlues.poll(POLL_MS) { api.listActiveCodeBlues() } }
            if (identity.can("emergency.codes.list")) async { erCodes.poll(POLL_MS) { api.listOpenEmergencyCodes() } }
        }
    }
    val cbs by codeBlues.state.collectAsState()
    val ers by erCodes.state.collectAsState()
    val open = emergencyOpenCodes(
        cbs.value.orEmpty().map { CodeBlueRef(it.id, it.location) },
        ers.value.orEmpty().map { EmergencyCodeRef(it.id, it.code_type, it.location) },
        silenced.toList(),
    )
    open.firstOrNull()?.let { current ->
        FlashBanner(api, current, open.size - 1, identity.can("nurse.code_blue.respond")) { silenced.add(current.key) }
    }
}

private fun colours(codeType: String): Pair<Color, Color> = when (codeType) {
    "code_blue" -> Carbon.EmergencyCode.blue to Color.White
    "code_red" -> Carbon.EmergencyCode.red to Color.White
    "code_pink" -> Carbon.EmergencyCode.pink to Color.White
    "code_black" -> Carbon.EmergencyCode.black to Color.White
    "code_yellow" -> Carbon.EmergencyCode.yellow to Carbon.EmergencyCode.black
    "code_orange" -> Carbon.EmergencyCode.orange to Color.White
    else -> Carbon.EmergencyCode.red to Color.White
}

@Composable
private fun FlashBanner(api: NurseApi, code: OpenEmergencyCode, others: Int, canRespond: Boolean, onSilence: () -> Unit) {
    val (fill, ink) = colours(code.codeType)
    val context = LocalContext.current
    val reduceMotion = remember { android.provider.Settings.Global.getFloat(context.contentResolver, android.provider.Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f }
    val alpha = if (reduceMotion) 1f else rememberInfiniteTransition(label = "flash").animateFloat(1f, 0.15f, infiniteRepeatable(tween(500, easing = LinearEasing), RepeatMode.Reverse), label = "blink").value
    var taps by remember { mutableStateOf<List<Long>>(emptyList()) }
    var responded by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Box(
        Modifier.fillMaxSize().testTag("emergency-flash")
            .semantics { contentDescription = "${code.label} at ${code.location}. Triple-tap to silence this alarm on this phone. Silencing does not say you are responding." }
            .pointerInput(code.key) {
                detectTapGestures {
                    val out = emergencyRegisterTap(taps, System.currentTimeMillis())
                    taps = out.tapsMs
                    if (out.triple) onSilence()
                }
            },
    ) {
        Box(Modifier.fillMaxSize().graphicsLayer { this.alpha = alpha }.background(fill))
        Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(code.label, fontSize = 44.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp, color = ink, textAlign = TextAlign.Center)
            Text(code.location, style = MaterialTheme.typography.headlineSmall, color = ink, textAlign = TextAlign.Center)
            if (others > 0) Text("+$others more code${if (others == 1) "" else "s"} open", color = ink)
            Text("Triple-tap to silence on this phone", style = MaterialTheme.typography.bodyMedium, color = ink.copy(alpha = 0.9f))
            // The gesture is for a gloved hand; the button is for everyone else (WCAG 2.5.1 — no gesture-only path).
            TextButton(onClick = onSilence, modifier = Modifier.height(44.dp).testTag("emergency-flash-silence").semantics { contentDescription = "Silence this alarm on this phone. Silencing does not say you are responding." }) {
                Text("Silence on this phone", color = ink)
            }
            code.codeBlueId?.takeIf { canRespond }?.let { id ->
                Button(
                    onClick = { scope.launch { busy = true; try { api.respondToCodeBlue(id); responded = true } catch (_: Exception) {} finally { busy = false } } },
                    enabled = !busy && !responded,
                    shape = MaterialTheme.shapes.small,
                    colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = fill),
                    modifier = Modifier.height(48.dp).testTag("emergency-flash-respond").semantics { contentDescription = if (responded) "You are responding to this code blue" else "Respond to this code blue" },
                ) { Text(if (responded) "You are responding" else "I'm responding") }
            }
        }
    }
}
