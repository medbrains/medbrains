package com.medbrains.staff

import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.medbrains.testkit.Evidence
import org.junit.Rule
import org.junit.rules.RuleChain
import org.junit.Test
import org.junit.runner.RunWith

/** MJ-SEC-001: each built-in role opens the app at its own desk. */
@RunWith(AndroidJUnit4::class)
class RoleLandingTest {
    val compose = createAndroidComposeRule<MainActivity>()

    @get:Rule
    val chain: RuleChain = RuleChain.outerRule(compose).around(Evidence { compose })
    private val api = Api.admin()

    private val landing = listOf(
        "doctor" to "doctor", "nurse" to "nurse", "receptionist" to "reception", "front_office_staff" to "reception",
        "pharmacist" to "pharmacy", "lab_technician" to "lab", "blood_bank_tech" to "blood-bank", "billing_clerk" to "billing",
        "biomed_engineer" to "bme", "security_guard" to "security", "hr_officer" to "hr", "hospital_admin" to "doctor",
        "dietitian" to null, "canteen_staff" to null,
    )

    @Test
    fun everyRoleOpensAtItsOwnDesk() {
        for ((role, module) in landing) {
            val who = api.provision(role)
            with(Session) { compose.ensureSignedOut() }
            compose.onNodeWithTag("username").performTextInput(who.username)
            compose.onNodeWithTag("password").performTextInput(who.password)
            compose.onNodeWithTag("signIn").performClick()
            if (module != null) {
                compose.waitUntil(15_000) { with(Session) { compose.has("module-$module") } }
                compose.onNodeWithTag("module-$module").assertIsSelected()
            } else {
                compose.waitUntil(15_000) { with(Session) { compose.has("nothing-assigned") } }
                compose.onNodeWithText("Sign out").performClick()
            }
            api.retire(who)
        }
    }
}
