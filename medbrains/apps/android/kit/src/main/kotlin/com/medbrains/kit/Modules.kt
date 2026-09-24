package com.medbrains.kit

import androidx.compose.runtime.Composable

/**
 * A module a signed-in person may see. Mirrors mobile-shell's `Module`:
 * [requiredPermissions] are all needed, [requiredAnyPermissions] one of;
 * [appCodes] restricts the module to surfaces; order in the registry is
 * where a role lands on launch.
 */
data class AppModule(
    val id: String,
    val displayName: String,
    val requiredPermissions: List<String>,
    val requiredAnyPermissions: List<String> = emptyList(),
    val appCodes: List<String> = emptyList(),
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val home: @Composable () -> Unit,
) {
    /**
     * mobile-shell `userHasModuleAccess`, verbatim in intent: nobody signed in
     * sees nothing; an ungated module is open; bypass roles see everything;
     * otherwise every required code and, when listed, one of the any-of codes.
     */
    fun isAccessible(identity: TenantIdentity?): Boolean {
        if (identity == null) return false
        if (requiredPermissions.isEmpty() && requiredAnyPermissions.isEmpty()) return true
        if (identity.isBypassRole) return true
        val owned = identity.permissions.toHashSet()
        val hasAll = requiredPermissions.all { it in owned }
        val hasAny = requiredAnyPermissions.isEmpty() || requiredAnyPermissions.any { it in owned }
        return hasAll && hasAny
    }

    fun belongsTo(appCode: String): Boolean = appCodes.isEmpty() || appCode in appCodes
}

fun List<AppModule>.accessibleTo(identity: TenantIdentity?): List<AppModule> = filter { it.isAccessible(identity) }

fun List<AppModule>.forApp(appCode: String): List<AppModule> = filter { it.belongsTo(appCode) }
