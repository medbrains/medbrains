package com.medbrains.staff.abdm

import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import com.medbrains.kit.Abha
import com.medbrains.kit.AbhaApi
import com.medbrains.kit.AbhaField
import com.medbrains.kit.AbhaVerificationStep
import com.medbrains.kit.AbhaVerifiedProfile
import com.medbrains.kit.LocalApiClient
import com.medbrains.kit.OurDetails
import com.medbrains.kit.Remote
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonSegmented
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.CarbonTonedTile
import com.medbrains.ui.Eyebrow
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

/** Where the card waits for the share sheet: the app's own cache, the only path its FileProvider exposes. */
private const val SHARE_DIR = "abha"

/** The last step of Verify and Create: compare, the card, use it. Registration starts with ABHA's where ours differs. */
@Composable
fun AbhaVerifiedSection(step: AbhaVerificationStep, profile: AbhaVerifiedProfile, ours: OurDetails, confirmLabel: String, onConfirm: suspend (AbhaConfirmation) -> String?) {
    val scope = rememberCoroutineScope()
    var apply by remember(step.id) { mutableStateOf(Abha.defaultApply(profile, ours)) }
    var image by remember { mutableStateOf<AbhaImage?>(null) }
    var busy by remember { mutableStateOf(false) }
    var failure by remember { mutableStateOf<String?>(null) }
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        step.message?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        AbhaCompare(profile, ours, apply, { apply = it })
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            CarbonTertiaryButton("ABHA card", onClick = { image = AbhaImage.CARD }, modifier = Modifier.weight(1f).testTag("abha-show-card"))
            CarbonTertiaryButton("Show QR", onClick = { image = AbhaImage.QR }, modifier = Modifier.weight(1f).testTag("abha-show-qr"))
        }
        image?.let { AbhaImagePanel(it, step.id) }
        val linked = step.already_linked
        if (linked != null) {
            CarbonNotification(NotificationKind.Warning, "This ABHA is already on another patient", "It belongs to ${linked.name} (${linked.uhid}). Open that record instead of registering the patient again.", Modifier.testTag("abha-already-linked"))
        } else {
            failure?.let { CarbonNotification(NotificationKind.Error, "Not done", it) }
            CarbonPrimaryButton(confirmLabel, enabled = !busy, modifier = Modifier.testTag("abha-confirm"), onClick = {
                scope.launch { busy = true; failure = onConfirm(AbhaConfirmation(step.id, profile, apply)); busy = false }
            })
        }
    }
}

/**
 * ABHA's details beside ours. Where they differ the desk chooses which to
 * keep — a local spelling may be deliberate; ABHA's comes from Aadhaar.
 */
@Composable
fun AbhaCompare(profile: AbhaVerifiedProfile, ours: OurDetails, apply: Set<AbhaField>, onApply: (Set<AbhaField>) -> Unit, oursLabel: String = "On our form") {
    val photo = remember(profile.photo) {
        profile.photo?.let { runCatching { Base64.decode(it, Base64.DEFAULT) }.getOrNull() }?.let { BitmapFactory.decodeByteArray(it, 0, it.size) }
    }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            photo?.let {
                Image(it.asImageBitmap(), contentDescription = "Photo on the ABHA, to confirm this is the patient", contentScale = ContentScale.Crop, modifier = Modifier.size(width = 72.dp, height = 88.dp))
            }
            Column {
                Text(profile.abha_number, style = MaterialTheme.typography.titleMedium, modifier = Modifier.testTag("abha-verified-number"))
                profile.abha_address?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
                Text((if (profile.kyc_verified) "KYC verified with Aadhaar" else "Not KYC verified") + (profile.mobile_masked?.let { " · mobile $it" } ?: ""), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        Abha.compareRows(profile, ours).forEach { row ->
            CarbonTonedTile(if (row.differs) CarbonTone.Warning else CarbonTone.Neutral, Modifier.testTag("abha-compare-${row.field.wire}")) {
                Eyebrow(row.label)
                Text("On ABHA: ${row.abha.ifEmpty { "—" }}", style = MaterialTheme.typography.bodyLarge)
                Text("$oursLabel: ${row.ours.ifEmpty { "—" }}", style = MaterialTheme.typography.bodyLarge)
                if (row.differs) {
                    CarbonSegmented("Which ${row.label.lowercase()} to keep", listOf(true to "Keep ABHA's", false to "Keep ours"), row.field in apply,
                        { useAbha -> onApply(if (useAbha) apply + row.field else apply - row.field) }, "abha-keep-${row.field.wire}")
                } else {
                    Text(if (row.matches) "Matches" else "Ours kept", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

enum class AbhaImage(val title: String, val file: String) { CARD("ABHA card", "abha-card.png"), QR("ABHA QR", "abha-qr.png") }

/** The card or QR as ABDM renders it, and the phone's share sheet — a printer app, or the patient's own phone. */
@Composable
private fun AbhaImagePanel(kind: AbhaImage, verificationId: String) {
    val client = LocalApiClient.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val remote = remember(kind) { Remote<ByteArray>() }
    val state by remote.state.collectAsState()
    val api = remember(client) { AbhaApi(client) }
    suspend fun fetch() = remote.load { if (kind == AbhaImage.CARD) api.card(verificationId) else api.qr(verificationId) }
    LaunchedEffect(kind) { fetch() }
    // The card names the patient: it leaves the cache as soon as this panel does.
    DisposableEffect(kind) { onDispose { File(File(context.cacheDir, SHARE_DIR), kind.file).delete() } }
    RemoteContent("abha-${kind.name.lowercase()}", state, "Couldn't load the ${kind.title}", "ABDM did not send it. Verify the ABHA again if the session has ended.", { it.isEmpty() }, "Nothing to show", "ABDM sent no picture.", { scope.launch { fetch() } }) { bytes ->
        val bitmap = remember(bytes) { BitmapFactory.decodeByteArray(bytes, 0, bytes.size) }
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            bitmap?.let { Image(it.asImageBitmap(), contentDescription = kind.title, modifier = Modifier.fillMaxWidth()) }
            CarbonPrimaryButton("Print or share", modifier = Modifier.testTag("abha-image-share"), onClick = { scope.launch { share(context, kind, bytes) } })
        }
    }
}

private suspend fun share(context: Context, kind: AbhaImage, bytes: ByteArray) {
    val file = withContext(Dispatchers.IO) { File(context.cacheDir, SHARE_DIR).apply { mkdirs() }.resolve(kind.file).apply { writeBytes(bytes) } }
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
    val send = Intent(Intent.ACTION_SEND).setType("image/*").putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    context.startActivity(Intent.createChooser(send, kind.title))
}
