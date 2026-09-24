package com.medbrains.patient

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.medbrains.kit.ApiClient
import com.medbrains.kit.AuthState
import com.medbrains.kit.AuthStore
import com.medbrains.kit.LocalApiClient
import com.medbrains.kit.LocalAuthStore
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.SecretStore
import com.medbrains.ui.MedBrainsTheme

/**
 * The patient app: a code sent to the phone on the patient's record, then the
 * hospital's record of them — and, only when the hospital licensed it, the
 * daily companion. The shell is :kit, shared with the staff app unchanged.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val secrets = SecretStore(applicationContext)
        val client = ApiClient(baseUrl = AppConfig.baseUrl(intent), variant = "patient", secrets = secrets)
        val auth = AuthStore(applicationContext, client, secrets)
        val portal = PortalApi(client)
        setContent {
            MedBrainsTheme {
                CompositionLocalProvider(LocalApiClient provides client, LocalAuthStore provides auth, LocalPortalApi provides portal, LocalHospitalCode provides AppConfig.hospitalCode(intent)) {
                    Root(auth)
                }
            }
        }
    }
}

/**
 * Where the hospital lives, and which hospital. Intent extras override in debug builds only
 * (emulator runs and tests): the activity is exported, so in a release build any app on the
 * phone could point it — and the patient's session — at its own server.
 */
object AppConfig {
    fun baseUrl(intent: Intent?): String = debugExtra(intent, "baseUrl") ?: "http://10.0.2.2:3000"
    fun hospitalCode(intent: Intent?): String = debugExtra(intent, "hospitalCode") ?: "DEFAULT"

    private fun debugExtra(intent: Intent?, key: String): String? =
        if (BuildConfig.DEBUG) intent?.getStringExtra(key) else null
}

@Composable
private fun Root(auth: AuthStore) {
    val state by auth.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { auth.hydrate() }
    when (val s = state) {
        AuthState.Hydrating -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        AuthState.SignedOut -> PatientLoginScreen(auth)
        is AuthState.SignedIn -> CompositionLocalProvider(LocalIdentity provides s.identity) { PatientHome(auth) }
    }
}
