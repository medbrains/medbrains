package com.medbrains.staff.shared.forms

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import com.medbrains.ui.CarbonTertiaryButton
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

private val DAY = DateTimeFormatter.ofPattern("d MMM yyyy")
private val DAY_TIME = DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm")

private enum class Step { Date, Time }

/** A required calendar date, never later than [latest] when given (records from the past, say). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocalDateField(label: String, date: LocalDate, onChange: (LocalDate) -> Unit, tag: String, latest: LocalDate? = null) {
    var picking by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth()) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        CarbonTertiaryButton(DAY.format(date), onClick = { picking = true }, modifier = Modifier.fillMaxWidth().testTag(tag).semantics { contentDescription = "$label: ${DAY.format(date)}" })
    }
    if (picking) {
        val state = rememberDatePickerState(
            initialSelectedDateMillis = date.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(),
            selectableDates = object : SelectableDates {
                override fun isSelectableDate(utcTimeMillis: Long): Boolean =
                    latest == null || !Instant.ofEpochMilli(utcTimeMillis).atZone(ZoneOffset.UTC).toLocalDate().isAfter(latest)
            },
        )
        DatePickerDialog(
            onDismissRequest = { picking = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { onChange(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate()) }
                    picking = false
                }, modifier = Modifier.testTag("date-ok")) { Text("Use this date") }
            },
            dismissButton = { TextButton(onClick = { picking = false }) { Text("Cancel") } },
        ) { DatePicker(state = state) }
    }
}

/** A moment in the future: a date, then the time on it, in the device's zone. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FutureDateTimeField(label: String, at: Instant, onChange: (Instant) -> Unit, tag: String, zone: ZoneId = ZoneId.systemDefault()) {
    var step by remember { mutableStateOf<Step?>(null) }
    var day by remember { mutableStateOf(at.atZone(zone).toLocalDate()) }
    val shown = DAY_TIME.format(at.atZone(zone))
    Column(Modifier.fillMaxWidth()) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        CarbonTertiaryButton(shown, onClick = { step = Step.Date }, modifier = Modifier.fillMaxWidth().testTag(tag).semantics { contentDescription = "$label: $shown" })
    }
    when (step) {
        Step.Date -> {
            val today = LocalDate.now(zone)
            val state = rememberDatePickerState(
                initialSelectedDateMillis = day.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(),
                selectableDates = object : SelectableDates {
                    override fun isSelectableDate(utcTimeMillis: Long): Boolean = !Instant.ofEpochMilli(utcTimeMillis).atZone(ZoneOffset.UTC).toLocalDate().isBefore(today)
                },
            )
            DatePickerDialog(
                onDismissRequest = { step = null },
                confirmButton = {
                    TextButton(onClick = {
                        state.selectedDateMillis?.let { day = Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate() }
                        step = Step.Time
                    }) { Text("Next") }
                },
                dismissButton = { TextButton(onClick = { step = null }) { Text("Cancel") } },
            ) { DatePicker(state = state) }
        }
        Step.Time -> {
            val now = at.atZone(zone).toLocalTime()
            val state = rememberTimePickerState(initialHour = now.hour, initialMinute = now.minute)
            AlertDialog(
                onDismissRequest = { step = null },
                confirmButton = {
                    TextButton(onClick = {
                        onChange(day.atTime(LocalTime.of(state.hour, state.minute)).atZone(zone).toInstant())
                        step = null
                    }) { Text("Use this time") }
                },
                dismissButton = { TextButton(onClick = { step = null }) { Text("Cancel") } },
                text = { TimePicker(state = state) },
            )
        }
        null -> Unit
    }
}
