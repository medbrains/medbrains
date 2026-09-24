package com.medbrains.kit

import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The gate decides what a role sees. These pin the same decisions
 * mobile-shell's `userHasModuleAccess` made, so the conversion cannot quietly
 * show a module to someone the server would refuse.
 */
class ModuleGatingTest {
    private fun module(all: List<String> = emptyList(), any: List<String> = emptyList(), apps: List<String> = emptyList()) =
        AppModule("m", "M", all, any, apps, ImageVector.Builder("i", 1.dp, 1.dp, 1f, 1f).build()) {}

    private fun nurse(permissions: List<String>) =
        TenantIdentity("t", "u", "n", "Nurse", "nurse", permissions, emptyList())

    @Test fun nobodySignedInSeesNothing() = assertFalse(module().isAccessible(null))

    @Test fun ungatedModuleIsOpenToAnyoneSignedIn() = assertTrue(module().isAccessible(nurse(emptyList())))

    @Test fun bypassRolesSeeEverything() {
        val admin = TenantIdentity("t", "u", "a", "Admin", "hospital_admin", emptyList(), emptyList())
        assertTrue(module(all = listOf("nurse.dashboard.view")).isAccessible(admin))
    }

    @Test fun allOfNeedsEveryCode() {
        val m = module(all = listOf("a", "b"))
        assertTrue(m.isAccessible(nurse(listOf("a", "b", "c"))))
        assertFalse(m.isAccessible(nurse(listOf("a"))))
    }

    @Test fun anyOfNeedsOneCodeOnTopOfAllOf() {
        val m = module(all = listOf("a"), any = listOf("x", "y"))
        assertTrue(m.isAccessible(nurse(listOf("a", "y"))))
        assertFalse(m.isAccessible(nurse(listOf("a"))))
        assertFalse(m.isAccessible(nurse(listOf("x"))))
    }

    @Test fun appCodesRestrictSurfaces() {
        assertTrue(module(apps = listOf("Mobile-Nurse")).belongsTo("Mobile-Nurse"))
        assertFalse(module(apps = listOf("Mobile-Nurse")).belongsTo("Mobile-Doctor"))
        assertTrue(module().belongsTo("Mobile-Doctor"))
    }

    @Test fun registryOrderIsPreservedByFiltering() {
        val registry = listOf(module(all = listOf("x")), module(all = listOf("y")), module(all = listOf("z")))
        assertEquals(listOf(listOf("x"), listOf("z")), registry.accessibleTo(nurse(listOf("z", "x"))).map { it.requiredPermissions })
    }
}
