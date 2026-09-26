package com.medbrains.staff.camp

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.medbrains.kit.ApiError
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.NotificationKind
import kotlinx.coroutines.launch

/**
 * The camp's first table: a name, an age, a sex and a phone if they have
 * one, then the number they keep to the pharmacy — shown big enough to read
 * out with whose it is, and the form cleared for the next person in the line.
 */
@Composable
fun CampRegisterScreen(api: CampApi, station: CampStation) {
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf("") }
    var age by remember { mutableStateOf("") }
    var gender by remember { mutableStateOf("female") }
    var phone by remember { mutableStateOf("") }
    var issued by remember { mutableStateOf<Pair<String, String>?>(null) }
    var busy by remember { mutableStateOf(false) }
    var failure by remember { mutableStateOf<String?>(null) }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().testTag("screen-camp-register")) {
        CarbonPageHeader(station.camp_name, "Register", "Each person gets one number for every station.")
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            issued?.let { (number, who) ->
                Column(Modifier.semantics { liveRegion = LiveRegionMode.Polite }) {
                    Text("Their number", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(number, fontSize = 56.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, modifier = Modifier.testTag("camp-issued-number"))
                    Text(who, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.testTag("camp-issued-to"))
                }
            }
            CarbonTextField(name, { name = it }, "Name", Modifier.testTag("field-camp-name"))
            CarbonTextField(age, { v -> age = v.filter { it.isDigit() }.take(3) }, "Age in years", Modifier.testTag("field-camp-age"), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
            Column {
                Text("Sex", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().padding(top = 8.dp).testTag("field-camp-gender")) {
                    listOf("female" to "Female", "male" to "Male", "other" to "Other").forEachIndexed { i, (v, label) ->
                        SegmentedButton(selected = gender == v, onClick = { gender = v }, shape = SegmentedButtonDefaults.itemShape(i, 3)) { Text(label) }
                    }
                }
            }
            CarbonTextField(phone, { phone = it }, "Phone (if they have one)", Modifier.testTag("field-camp-phone"), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone))
            failure?.let { CarbonNotification(NotificationKind.Error, "Not registered", it) }
            CarbonPrimaryButton("Register and give number", enabled = !busy && name.isNotBlank(), modifier = Modifier.testTag("camp-register-submit"), onClick = {
                scope.launch {
                    busy = true; failure = null
                    try {
                        val who = name.trim()
                        val done = api.register(CampRegistrationBody(station.camp_id, who, age.toIntOrNull(), gender, phone.ifBlank { null }, true))
                        issued = (done.token_number ?: "Registered — this camp has no stations") to who
                        name = ""; age = ""; phone = ""
                    } catch (e: ApiError) { failure = e.message } catch (e: Exception) { failure = "Could not reach the hospital server. Nobody was registered." } finally { busy = false }
                }
            })
        }
    }
}
