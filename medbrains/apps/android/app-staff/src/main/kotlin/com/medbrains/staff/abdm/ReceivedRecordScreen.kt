package com.medbrains.staff.abdm

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Base64
import android.webkit.MimeTypeMap
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import com.medbrains.kit.AbdmRecords
import com.medbrains.kit.AbdmRecordsApi
import com.medbrains.kit.FhirSections
import com.medbrains.kit.LocalApiClient
import com.medbrains.kit.Remote
import com.medbrains.kit.ServerTime
import com.medbrains.kit.isNotAvailable
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonSectionTitle
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch
import java.io.File

/** Where a document another hospital sent is written for a viewer; emptied when the record closes. */
private const val DOCUMENT_DIR = "abdm-documents"

/** The record with its bundle read once, not on every recomposition. */
private class ReadRecord(val record: AbdmRecords.ReceivedRecord, val document: FhirSections.Document)

/** One record another hospital sent, read into sections, while it may be held. A copy whose consent ended answers 404: it reads as erased. */
@Composable
fun ReceivedRecordScreen(recordId: String) {
    val api = AbdmRecordsApi(LocalApiClient.current)
    val context = LocalContext.current
    val remote = remember { Remote<ReadRecord>() }
    val scope = rememberCoroutineScope()
    var openFailure by remember { mutableStateOf<String?>(null) }
    suspend fun load() = remote.load { api.record(recordId).let { ReadRecord(it, FhirSections.read(it.bundle)) } }
    LaunchedEffect(recordId) { load() }
    // Nothing another hospital sent outlives the screen that showed it.
    DisposableEffect(Unit) { onDispose { File(context.cacheDir, DOCUMENT_DIR).deleteRecursively() } }
    val state by remote.state.collectAsState()
    val failedStatus by remote.failedStatus.collectAsState()

    Column(Modifier.fillMaxSize().testTag("screen-abdm-record")) {
        if (isNotAvailable(failedStatus)) {
            CarbonNotification(NotificationKind.Warning, "This record is not available", "The consent may have been withdrawn or expired, and the copy erased.",
                Modifier.padding(16.dp).testTag("abdm-record-erased"))
            return@Column
        }
        RemoteContent(
            id = "abdm-record", state = state,
            unavailableTitle = "Could not open the record", unavailableMessage = "The record could not be loaded.",
            isEmpty = { false }, emptyTitle = "", emptyMessage = "", retry = { scope.launch { load() } },
        ) { read ->
            val r = read.record
            val doc = read.document
            LazyColumn(Modifier.fillMaxSize().testTag("abdm-record-sections"), contentPadding = PaddingValues(bottom = 32.dp)) {
                item {
                    CarbonPageHeader(AbdmRecords.hiTypeLabel(r.hi_type), doc.title ?: AbdmRecords.hiTypeLabel(r.hi_type),
                        listOfNotNull(r.source_hip_name ?: r.source_hip_id, ServerTime.dateOf(doc.date ?: r.received_at), doc.author).joinToString(" · "))
                    Text("Shared through ABDM with the patient's consent; erased by ${ServerTime.dateOf(r.erase_at)}.", style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(horizontal = 16.dp))
                }
                openFailure?.let { item { CarbonNotification(NotificationKind.Error, "Could not open the document", it, Modifier.padding(16.dp)) } }
                if (doc.sections.isEmpty()) item {
                    Text("This record has no sections this screen can read.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(16.dp).testTag("abdm-record-no-sections"))
                }
                doc.sections.forEach { section ->
                    item(key = section.key) { CarbonSectionTitle(section.title) }
                    items(section.items, key = { "${section.key}/${it.key}" }) { item ->
                        ItemRow(item) { link -> openFailure = open(context, link) }
                    }
                }
            }
        }
    }
}

@Composable
private fun ItemRow(item: FhirSections.Item, onOpen: (FhirSections.Link) -> Unit) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text(item.text, style = MaterialTheme.typography.bodyLarge)
        item.detail?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        item.link?.let { link -> TextButton(onClick = { onOpen(link) }, modifier = Modifier.heightIn(min = 48.dp)) { Text(link.label) } }
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
}

/**
 * A web link opens in the browser. Inline content is never trusted to open
 * itself: it is written to this app's cache and handed, read-only, to the
 * viewer the person picks. Returns why it could not open, or null.
 */
private fun open(context: Context, link: FhirSections.Link): String? = try {
    val intent = when (link) {
        is FhirSections.Link.Web -> Intent(Intent.ACTION_VIEW, Uri.parse(link.url))
        is FhirSections.Link.Inline -> {
            val ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(link.contentType)
            val name = File(link.fileName).name.let { if (ext != null && '.' !in it) "$it.$ext" else it }
            val file = File(context.cacheDir, DOCUMENT_DIR).apply { mkdirs() }.resolve(name)
            file.writeBytes(Base64.decode(link.base64, Base64.DEFAULT))
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
            Intent(Intent.ACTION_VIEW).setDataAndType(uri, link.contentType).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }
    context.startActivity(Intent.createChooser(intent, link.label))
    null
} catch (e: ActivityNotFoundException) {
    "No app on this device can open it."
} catch (e: IllegalArgumentException) {
    "The document arrived damaged."
} catch (e: java.io.IOException) {
    "The document could not be saved for viewing."
}
