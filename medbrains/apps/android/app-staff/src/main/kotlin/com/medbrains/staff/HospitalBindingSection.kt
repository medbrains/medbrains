package com.medbrains.staff

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.medbrains.kit.AuthStore
import com.medbrains.kit.BindingApi
import com.medbrains.kit.BindingRefused
import com.medbrains.kit.BindingStore
import com.medbrains.kit.BindingVerifier
import com.medbrains.kit.StoredBinding
import com.medbrains.ui.BarcodeScanner
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.NotificationKind
import kotlinx.coroutines.launch

/** Binds this device to one hospital from its signed QR, or forgets it. */
class StaffBinder(
    private val auth: AuthStore,
    private val store: BindingStore,
    val current: StoredBinding?,
    private val onChanged: () -> Unit,
) {
    /** Verify, redeem and keep the binding; the app then restarts against it. */
    suspend fun bind(qr: String) {
        val now = System.currentTimeMillis() / MILLIS_PER_SECOND
        val verified = BindingVerifier.verify(qr, now, current, allowCleartext = BuildConfig.DEBUG)
        val binding = BindingApi.redeem(verified, APP_VARIANT, now)
        store.write(binding)
        auth.rememberHospital(binding.tenant)
        onChanged()
    }

    fun forget() {
        store.forget()
        auth.forgetHospital()
        onChanged()
    }

    private companion object {
        const val APP_VARIANT = "Mobile-Staff"
        const val MILLIS_PER_SECOND = 1000L
    }
}

/**
 * Step 1's alternative to typing a code: scan the QR the hospital's admin
 * printed. A bound device offers to forget its hospital instead.
 */
@Composable
fun HospitalBindingSection(binder: StaffBinder) {
    var scanning by remember { mutableStateOf(false) }
    var binding by remember { mutableStateOf(false) }
    var problem by remember { mutableStateOf<String?>(null) }
    var resumeKey by remember { mutableIntStateOf(0) }
    val scope = rememberCoroutineScope()

    Spacer(Modifier.height(16.dp))
    problem?.let {
        CarbonNotification(NotificationKind.Error, "Could not use this hospital code", it)
        Spacer(Modifier.height(8.dp))
    }
    val bound = binder.current
    when {
        bound != null -> CarbonTertiaryButton(
            "Forget ${bound.tenant_name} on this device",
            onClick = { binder.forget() },
            modifier = Modifier.fillMaxWidth().testTag("forgetBinding"),
        )
        scanning -> BarcodeScanner(
            title = if (binding) "Checking the code…" else "Scan the hospital QR",
            hint = "Your IT desk shows it under Devices › Hospital binding.",
            resumeKey = resumeKey,
            onScan = { text ->
                if (!binding) {
                    binding = true
                    scope.launch {
                        try {
                            binder.bind(text)
                        } catch (e: BindingRefused) {
                            problem = e.message
                        } catch (e: Exception) {
                            problem = "Could not reach the hospital server, or its security key did not match."
                        }
                        binding = false
                        resumeKey++
                    }
                }
            },
            modifier = Modifier.testTag("bindingScanner"),
        )
        else -> CarbonTertiaryButton(
            "Scan hospital QR",
            onClick = { problem = null; scanning = true },
            modifier = Modifier.fillMaxWidth().testTag("scanBinding"),
        )
    }
}
