package com.medbrains.staff.doctor

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.CarbonTonedTile
import com.medbrains.ui.Eyebrow
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

private const val WITHHELD_MESSAGE = "Content withheld: your access to consultation notes is restricted."

/** One note on the case sheet as the paper margin reads it: the kind of note, who wrote it and when, signed or not, and what it says. */
@Composable
fun NoteBlock(note: Note) {
    val struck = note.status == "entered_in_error"
    val (label, tone) = when (note.status) {
        "entered_in_error" -> "entered in error" to CarbonTone.Danger
        "draft" -> "draft — not signed" to CarbonTone.Warning
        else -> (if (note.current_version > 1) "signed · revised" else "signed") to CarbonTone.Success
    }
    val lines = note.sections.mapNotNull { section ->
        val body = if (section.code == "examination") ConsultationDraft.findingsIn(note).joinToString("\n") { it.line } else plainText(section.text)
        if (body.isEmpty()) null else section.title to body
    }
    CarbonTonedTile(if (note.status == "draft") CarbonTone.Warning else CarbonTone.Neutral, Modifier.testTag("note-block")) {
        Eyebrow(if (note.amends_note_id == null) note.note_type_name else "Addendum")
        Text("${note.author_name} · ${note.author_role.replace('_', ' ')}", style = MaterialTheme.typography.bodyMedium)
        Text("Care at ${shortTime(note.service_at)}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        CarbonTag(label, tone, modifier = Modifier.padding(top = 4.dp).testTag("note-status-${note.status}"))
        if (note.cosigner_name != null && note.cosign_status != null) {
            Text(if (note.cosign_status == "pending") "Awaiting countersign by ${note.cosigner_name}" else "Countersigned by ${note.cosigner_name}",
                style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        note.entered_in_error_reason?.let { Text("Entered in error: $it", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.error) }
        Column(Modifier.padding(top = 8.dp)) {
            if (note.withheld) Text(WITHHELD_MESSAGE, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.testTag("note-withheld"))
            lines.forEach { (title, text) ->
                Eyebrow(title)
                Text(text, style = MaterialTheme.typography.bodyMedium, textDecoration = if (struck) TextDecoration.LineThrough else null)
            }
        }
    }
}

/** "2026-10-05T10:42:00Z" as the reader's local day and time. */
fun shortTime(iso: String): String = runCatching {
    OffsetDateTime.parse(iso).atZoneSameInstant(ZoneId.systemDefault())
        .format(DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT))
}.getOrDefault(iso)
