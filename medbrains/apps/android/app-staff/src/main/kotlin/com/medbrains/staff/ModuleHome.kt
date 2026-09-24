package com.medbrains.staff

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.medbrains.kit.AppModule
import com.medbrains.kit.AuthStore
import com.medbrains.kit.TenantIdentity
import com.medbrains.kit.accessibleTo
import com.medbrains.ui.CarbonRow
import com.medbrains.ui.CarbonSectionTitle
import com.medbrains.ui.CarbonTile
import com.medbrains.ui.Eyebrow

/** A phone bar holds four modules well; the rest live behind More, as iOS does past five tabs. */
private const val BAR_SLOTS = 4

/**
 * One destination per permitted module, in registry order, so each role
 * lands on its own work. Up to four modules sit in the bar; a role with
 * more (an administrator) gets a More sheet listing the rest, so the bar
 * never squeezes thirteen labels into a phone's width.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ModuleHome(auth: AuthStore, identity: TenantIdentity, modules: List<AppModule>, initialModule: String?) {
    val visible = remember(identity) { modules.accessibleTo(identity) }
    if (visible.isEmpty()) {
        EmptyRole(auth)
        return
    }
    var selected by remember { mutableStateOf(visible.firstOrNull { it.id == initialModule } ?: visible.first()) }
    var menuOpen by remember { mutableStateOf(false) }
    var moreOpen by remember { mutableStateOf(false) }
    val overflow = visible.size > BAR_SLOTS
    val inBar = if (overflow) visible.take(BAR_SLOTS - 1) else visible
    val inMore = if (overflow) visible.drop(BAR_SLOTS - 1) else emptyList()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(selected.displayName, style = MaterialTheme.typography.headlineSmall) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
                actions = {
                    IconButton(onClick = { menuOpen = true }) {
                        Icon(Icons.Filled.AccountCircle, contentDescription = "Account")
                    }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        DropdownMenuItem(text = { Text(identity.fullName) }, onClick = {}, enabled = false)
                        DropdownMenuItem(text = { Text("Sign out") }, onClick = { menuOpen = false; auth.signOut() })
                    }
                },
            )
        },
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.background) {
                inBar.forEach { module ->
                    NavigationBarItem(
                        selected = module.id == selected.id,
                        onClick = { selected = module },
                        icon = { Icon(module.icon, contentDescription = null) },
                        label = { Text(module.displayName, style = MaterialTheme.typography.labelMedium, maxLines = 1) },
                        modifier = Modifier.testTag("module-${module.id}"),
                    )
                }
                if (overflow) {
                    NavigationBarItem(
                        selected = selected in inMore,
                        onClick = { moreOpen = true },
                        icon = { Icon(Icons.Filled.MoreHoriz, contentDescription = null) },
                        label = { Text("More", style = MaterialTheme.typography.labelMedium) },
                        modifier = Modifier.testTag("module-more"),
                    )
                }
            }
        },
    ) { padding ->
        Column(Modifier.padding(padding)) { selected.home() }
    }

    if (moreOpen) {
        ModalBottomSheet(onDismissRequest = { moreOpen = false }) {
            CarbonSectionTitle("More modules")
            LazyColumn {
                items(inMore, key = { it.id }) { module ->
                    ListItem(
                        leadingContent = { Icon(module.icon, contentDescription = null) },
                        modifier = Modifier.testTag("module-${module.id}").clickable { selected = module; moreOpen = false },
                    ) { Text(module.displayName) }
                }
            }
        }
    }
}

@Composable
private fun EmptyRole(auth: AuthStore) {
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Nothing assigned to you here", style = MaterialTheme.typography.headlineSmall, modifier = Modifier.testTag("nothing-assigned"))
        Text("Your role has no module on this app. Ask an administrator, or sign in on the right app.")
        TextButton(onClick = { auth.signOut() }) { Text("Sign out") }
    }
}

/** A module home not yet converted: says so, and shows what the role will get. */
@Composable
fun PlaceholderModuleHome(module: AppModule, phase: Int) {
    LazyColumn(Modifier.fillMaxSize()) {
        item {
            CarbonTile(Modifier.padding(16.dp)) {
                Eyebrow("Converting in phase $phase")
                Text(
                    "${module.displayName} keeps running on the current app until this screen lands natively.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                )
            }
        }
        item { CarbonSectionTitle("Surfaces") }
        items(module.appCodes) { CarbonRow(it, mono = true) }
        item { CarbonSectionTitle("Requires") }
        items(module.requiredPermissions) { CarbonRow(it, mono = true) }
    }
}
