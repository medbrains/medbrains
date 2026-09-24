package com.medbrains.kit

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.spec.GCMParameterSpec

/** Keys the shell keeps. Mirrors mobile-shell's SECRET_KEYS. */
enum class SecretKey(val key: String) {
    JWT("medbrains.jwt"),
    REFRESH_TOKEN("medbrains.refresh_token"),
    NODE_SECRET("medbrains.node_secret"),
    CAMP_KEY("medbrains.camp_key"),
}

/**
 * Secrets sealed by a key that never leaves the Android Keystore.
 *
 * AES-256-GCM with a fresh 12-byte nonce per write; the ciphertext sits in
 * app-private SharedPreferences, which the OS sandboxes per app and excludes
 * from cloud backup for this file. The key is generated once, hardware-backed
 * where the device offers it, and cannot be exported — a copied preferences
 * file is noise without the device that wrote it. Jetpack Security's
 * EncryptedSharedPreferences did the same and is deprecated; a credential
 * store for a clinical app should not sit on a deprecated primitive.
 */
class SecretStore(context: Context, private val alias: String = "medbrains.secrets") {
    private val prefs = context.getSharedPreferences("medbrains.secrets", Context.MODE_PRIVATE)

    private fun key(): javax.crypto.SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(alias, null) as? javax.crypto.SecretKey)?.let { return it }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        gen.init(
            KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setRandomizedEncryptionRequired(true)
                .build(),
        )
        return gen.generateKey()
    }

    fun read(key: SecretKey): String? {
        val sealed = prefs.getString(key.key, null) ?: return null
        return runCatching {
            val bytes = Base64.decode(sealed, Base64.NO_WRAP)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes, 0, NONCE_BYTES))
            String(cipher.doFinal(bytes, NONCE_BYTES, bytes.size - NONCE_BYTES), Charsets.UTF_8)
        }.getOrNull() // A value the key can no longer open (key reset, tampering) reads as absent, never as garbage.
    }

    fun write(key: SecretKey, value: String) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val sealed = cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        prefs.edit().putString(key.key, Base64.encodeToString(sealed, Base64.NO_WRAP)).apply()
    }

    fun delete(key: SecretKey) {
        prefs.edit().remove(key.key).apply()
    }

    private companion object {
        const val NONCE_BYTES = 12
    }
}
