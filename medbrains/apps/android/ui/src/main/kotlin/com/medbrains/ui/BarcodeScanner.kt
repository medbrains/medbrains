package com.medbrains.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.MultiFormatReader
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.common.HybridBinarizer
import java.util.concurrent.Executors

/**
 * The one barcode reader every device screen uses. Hands the caller exactly
 * one result per `resumeKey`: the analyser fires per frame, and without a
 * lock a single tube held to the lens fires thirty lookups a second.
 * Permission has three states, not two. A device with no camera (the
 * emulator's virtual scene, a broken lens) offers typed entry: the server
 * compares whatever it receives.
 */
@Composable
fun BarcodeScanner(title: String, hint: String, resumeKey: Int, onScan: (String) -> Unit, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    var granted by remember { mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) }
    var asked by remember { mutableStateOf(false) }
    val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted = it; asked = true }
    val hasCamera = context.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)

    Column(modifier.fillMaxWidth().padding(16.dp).testTag("barcode-scanner")) {
        Text(title, style = MaterialTheme.typography.titleMedium)
        Text(hint, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(12.dp))
        // Typing the code is always offered: a wristband that will not read is the
        // common case, and it must not wait on a permission prompt.
        val reason = when {
            !hasCamera -> "This device has no camera."
            granted -> { CameraPane(resumeKey, onScan); "Or, if the code will not read:" }
            !asked -> { CarbonPrimaryButton("Allow the camera", onClick = { ask.launch(Manifest.permission.CAMERA) }); "Or type the code:" }
            else -> { CarbonNotification(NotificationKind.Warning, "Camera access is off", "Turn it on in Settings › MedBrains to scan. You can type the code below meanwhile."); null }
        }
        Spacer(Modifier.height(12.dp))
        ManualEntry(reason, onScan)
    }
}

@Composable
private fun ManualEntry(reason: String?, onScan: (String) -> Unit) {
    var typed by remember { mutableStateOf("") }
    fun submit() {
        val v = typed.trim()
        if (v.isEmpty()) return
        typed = ""
        onScan(v)
    }
    Column {
        if (reason != null) Text(reason, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        CarbonTextField(
            value = typed,
            onValueChange = { typed = it },
            label = "Type the code",
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { submit() }),
            modifier = Modifier.testTag("barcode-manual"),
        )
        Spacer(Modifier.height(8.dp))
        CarbonTertiaryButton("Use this code", onClick = ::submit, enabled = typed.isNotBlank(), modifier = Modifier.fillMaxWidth().testTag("barcode-manual-submit"))
    }
}

/** Linear codes for tubes and asset tags, plus QR and Data Matrix — narrower than zxing supports, on purpose. */
private val clinicalFormats = listOf(BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.EAN_13, BarcodeFormat.DATA_MATRIX)

@Composable
private fun CameraPane(resumeKey: Int, onScan: (String) -> Unit) {
    val context = LocalContext.current
    val owner = LocalLifecycleOwner.current
    val executor = remember { Executors.newSingleThreadExecutor() }
    val reader = remember { MultiFormatReader().apply { setHints(mapOf(DecodeHintType.POSSIBLE_FORMATS to clinicalFormats)) } }
    var lockedKey by remember { mutableStateOf(-1) }
    val previewView = remember { PreviewView(context) }

    DisposableEffect(owner) {
        val future = ProcessCameraProvider.getInstance(context)
        var provider: ProcessCameraProvider? = null
        future.addListener({
            provider = future.get()
            val preview = Preview.Builder().build().also { it.surfaceProvider = previewView.surfaceProvider }
            val analysis = ImageAnalysis.Builder().setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build()
            analysis.setAnalyzer(executor) { image ->
                if (lockedKey != resumeKey) {
                    decode(image, reader)?.let { value ->
                        lockedKey = resumeKey
                        previewView.post { onScan(value) }
                    }
                }
                image.close()
            }
            runCatching {
                provider?.unbindAll()
                provider?.bindToLifecycle(owner, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis)
            }
        }, ContextCompat.getMainExecutor(context))
        // Tear the camera down with the screen: a session left running is a battery and a privacy problem.
        onDispose { provider?.unbindAll(); executor.shutdown() }
    }
    AndroidView(factory = { previewView }, modifier = Modifier.fillMaxWidth().height(280.dp))
}

private fun decode(image: ImageProxy, reader: MultiFormatReader): String? {
    val plane = image.planes.firstOrNull() ?: return null
    val buffer = plane.buffer
    val bytes = ByteArray(buffer.remaining()).also { buffer.get(it) }
    val source = PlanarYUVLuminanceSource(bytes, plane.rowStride, image.height, 0, 0, image.width, image.height, false)
    return try {
        reader.decodeWithState(BinaryBitmap(HybridBinarizer(source))).text
    } catch (_: Exception) {
        null
    } finally {
        reader.reset()
    }
}
