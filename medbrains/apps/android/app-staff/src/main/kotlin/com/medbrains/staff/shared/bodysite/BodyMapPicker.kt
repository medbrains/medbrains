package com.medbrains.staff.shared.bodysite

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonRow
import com.medbrains.ui.CarbonTextField

/** A site as a chart prints it, with its side. */
data class PickedSite(val label: String, val laterality: Laterality?)

/** Height over width of the figure the zone fractions describe. */
private const val FIGURE_ASPECT = 2.2f
private const val FIGURE_HEIGHT_DP = 440
private val SIDE_CHOICES: List<Laterality?> = Laterality.entries + null

/**
 * Pick a body region on a 2D body map, or from the list beside it.
 *
 * The map and the list are two ways to the same choice: a tap on a zone sets
 * the region and its side; the list is the TalkBack and large-text path, so a
 * zone smaller than a fingertip never blocks anyone. Front view puts the
 * patient's right on the screen's left, as a clinician facing them sees it.
 * A sided region cannot be used until its side is known.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BodyMapPicker(title: String, onDismiss: () -> Unit, onPick: (PickedSite) -> Unit) {
    val regions = BodyRegion.all(LocalContext.current)
    var view by remember { mutableStateOf(BodyRegion.View.Front) }
    var region by remember { mutableStateOf<BodyRegion?>(null) }
    var side by remember { mutableStateOf<Laterality?>(null) }
    var query by remember { mutableStateOf("") }
    val needsSide = region?.sided == true && side?.word == null
    val matches = query.trim().let { q -> if (q.isEmpty()) regions else regions.filter { it.label.contains(q, ignoreCase = true) } }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.verticalScroll(rememberScrollState()).padding(16.dp).testTag("body-map"), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("Pick ${title.lowercase()}", style = MaterialTheme.typography.titleMedium)
            Segmented(BodyRegion.View.entries, view, { if (it == BodyRegion.View.Front) "Front" else "Back" }, "body-map-view") { view = it }
            BodyMap(regions, view, region, side) { r, s -> region = r; if (s != null) side = s }
            Segmented(SIDE_CHOICES, side, { it?.choice ?: "Not stated" }, "body-map-side") { side = it }
            val chosen = region
            val status = when { needsSide -> "Choose the side"; chosen != null -> "Selected: ${chosen.label(side)}"; else -> "Nothing selected yet" }
            Text(status, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.testTag("body-map-status"))
            CarbonPrimaryButton("Use this site", enabled = region != null && !needsSide, modifier = Modifier.testTag("body-map-use"), onClick = {
                region?.let { onPick(PickedSite(it.label(side), side)) }
            })
            CarbonTextField(query, { query = it }, "Find a region", Modifier.testTag("body-map-search"))
            matches.forEach { r ->
                Box(Modifier.clickable { region = r }.testTag("body-region-${r.id}")) { CarbonRow(r.label, if (r.sided) "Left or right" else null) }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun <T> Segmented(options: List<T>, selected: T, label: (T) -> String, tag: String, onSelect: (T) -> Unit) {
    SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().testTag(tag)) {
        options.forEachIndexed { i, option ->
            SegmentedButton(selected = option == selected, onClick = { onSelect(option) }, shape = SegmentedButtonDefaults.itemShape(i, options.size)) { Text(label(option), maxLines = 1) }
        }
    }
}

/**
 * The figure: every zone of the view, drawn and tappable. The back view lays
 * the front's zones underneath, unlabelled, so its few zones sit on a body.
 */
@Composable
private fun BodyMap(regions: List<BodyRegion>, view: BodyRegion.View, region: BodyRegion?, side: Laterality?, onTap: (BodyRegion, Laterality?) -> Unit) {
    val width = (FIGURE_HEIGHT_DP / FIGURE_ASPECT).dp
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        BoxWithConstraints(Modifier.size(width, FIGURE_HEIGHT_DP.dp)) {
            @Composable fun Zoned(z: BodyRegion.Zone, modifier: Modifier) = Box(
                Modifier.offset(maxWidth * z.x, maxHeight * z.y).size(maxWidth * z.w, maxHeight * z.h).then(modifier),
            )
            if (view == BodyRegion.View.Back) {
                regions.forEach { r -> r.zones(BodyRegion.View.Front).forEach { (_, z) ->
                    Zoned(z.mirrored, Modifier.clearAndSetSemantics {}.background(MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.shapes.extraSmall))
                } }
            }
            regions.forEach { r -> r.zones(view).forEach { (zoneSide, z) ->
                val chosen = region == r && (zoneSide == null || zoneSide == side)
                val name = zoneSide?.let { "Patient's ${it.name.lowercase()} ${r.label.lowercase()}" } ?: r.label
                Zoned(z, Modifier
                    .background(if (chosen) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.shapes.extraSmall)
                    .border(1.dp, MaterialTheme.colorScheme.outline, MaterialTheme.shapes.extraSmall)
                    .clickable(role = Role.Button) { onTap(r, zoneSide) }
                    .semantics { contentDescription = name; selected = chosen }
                    .testTag("body-zone-${r.id}${zoneSide?.let { "-${it.name.lowercase()}" } ?: ""}"))
            } }
        }
        // The patient's right is on the screen's left from the front, its right from behind.
        Row(Modifier.width(width), horizontalArrangement = Arrangement.SpaceBetween) {
            val (start, end) = if (view == BodyRegion.View.Front) "Patient's right" to "Patient's left" else "Patient's left" to "Patient's right"
            Text(start, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(end, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
