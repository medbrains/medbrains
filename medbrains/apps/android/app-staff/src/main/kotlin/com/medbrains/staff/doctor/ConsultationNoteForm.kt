package com.medbrains.staff.doctor

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import com.medbrains.kit.ApiError
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonSectionTitle
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.NotificationKind
import kotlinx.coroutines.launch
import uniffi.edge_rn.consultationProblem

/**
 * The doctor's own consultation note while it is a draft: the four prose
 * fields and the findings at a site. Save keeps the draft; Sign makes it the
 * record. Buttons are disabled only while a write is in flight, never on
 * validity — pressing runs the check and the field says what is missing. A
 * failed write keeps every word on screen.
 */
@Composable
fun ConsultationNoteForm(api: NotesApi, encounterId: String, existing: Note?, canSign: Boolean, onChange: suspend () -> Unit) {
    var note by remember { mutableStateOf(existing) }
    var draft by remember { mutableStateOf(existing?.let(ConsultationDraft::of) ?: ConsultationDraft()) }
    var busy by remember { mutableStateOf(false) }
    var problem by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var lateReason by remember { mutableStateOf<String?>(null) }
    var savedDraft by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val prose = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences)

    fun save(sign: Boolean) {
        problem = consultationProblem(draft.chief, draft.exam, draft.assessment, draft.plan)
        if (problem != null) return
        scope.launch {
            busy = true; error = null; savedDraft = false
            try {
                val patches = draft.patches(note?.sections?.firstOrNull { it.code == "examination" }?.data)
                val saved = note?.let { api.saveDraft(it.id, patches) } ?: api.startConsultation(encounterId, patches)
                note = saved
                if (sign) {
                    api.sign(saved.id, lateReason?.trim()?.ifEmpty { null })
                    // Signed, it joins the sheet as the record.
                    onChange()
                } else {
                    savedDraft = true
                }
            } catch (e: ApiError) {
                // Care written up long after it happened must say why before it is signed.
                if (e.message?.contains("late entry", ignoreCase = true) == true) lateReason = lateReason ?: ""
                error = e.message
            } catch (e: Exception) {
                error = "Could not reach the hospital server."
            } finally { busy = false }
        }
    }

    Column(Modifier.testTag("consultation-form"), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        CarbonSectionTitle(if (note == null) "New consultation note" else "Your draft")
        CarbonTag(if (note == null) "not saved" else "draft — not signed", CarbonTone.Warning,
            modifier = Modifier.testTag(if (note == null) "consultation-unsaved" else "consultation-saved"))
        CarbonTextField(draft.chief, { draft = draft.copy(chief = it) }, "Chief complaint", Modifier.testTag("field-chief_complaint"), error = problem, keyboardOptions = prose, singleLine = false)
        CarbonTextField(draft.exam, { draft = draft.copy(exam = it) }, "Examination", Modifier.testTag("field-examination"), keyboardOptions = prose, singleLine = false)
        CarbonTextField(draft.assessment, { draft = draft.copy(assessment = it) }, "Assessment", Modifier.testTag("field-assessment"), keyboardOptions = prose, singleLine = false)
        CarbonTextField(draft.plan, { draft = draft.copy(plan = it) }, "Plan", Modifier.testTag("field-plan"), keyboardOptions = prose, singleLine = false)
        ExamFindingsSection(draft.findings, true) { draft = draft.copy(findings = it) }
        error?.let { CarbonNotification(NotificationKind.Error, "The note was not saved", it) }
        if (savedDraft) {
            CarbonNotification(NotificationKind.Success, "Draft saved", "Not part of the record until you sign it.", Modifier.testTag("consultation-draft-saved"))
        }
        lateReason?.let { reason ->
            CarbonTextField(reason, { lateReason = it }, "Why it is written now", Modifier.testTag("field-late-reason"), keyboardOptions = prose, singleLine = false)
        }
        CarbonTertiaryButton("Save draft", onClick = { save(sign = false) }, modifier = Modifier.testTag("consultation-save"), enabled = !busy)
        if (canSign) {
            CarbonPrimaryButton(if (lateReason == null) "Sign note" else "Sign as late entry", enabled = !busy,
                modifier = Modifier.testTag("consultation-sign").semantics { contentDescription = "Sign this consultation note" },
                onClick = { save(sign = true) })
        }
    }
}
