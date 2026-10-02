import MedBrainsUI
import SwiftUI

/// A site as a chart prints it, with its side.
struct PickedSite: Equatable, Sendable {
    let label: String
    let laterality: Laterality?
}

/// Pick a body region on a 2D body map, or from the list beside it.
///
/// The map and the list are two ways to the same choice: a tap on a zone
/// sets the region and its side; the list is the VoiceOver and large-text
/// path, so a zone smaller than a fingertip never blocks anyone. Front view
/// puts the patient's right on the screen's left, as a clinician facing them
/// sees it. A sided region cannot be used until its side is known.
struct BodyMapPicker: View {
    let title: String
    let onPick: (PickedSite) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var view: BodyRegion.View = .front
    @State private var region: BodyRegion?
    @State private var side: Laterality?
    @State private var query = ""

    private var needsSide: Bool { region?.sided == true && side?.word == nil }
    private var matches: [BodyRegion] {
        let q = query.trimmingCharacters(in: .whitespaces)
        return q.isEmpty ? BodyRegion.all : BodyRegion.all.filter { $0.label.localizedCaseInsensitiveContains(q) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Picker("View", selection: $view) {
                        Text("Front").tag(BodyRegion.View.front)
                        Text("Back").tag(BodyRegion.View.back)
                    }
                    .pickerStyle(.segmented).accessibilityIdentifier("body-map-view")
                    BodyMap(view: view, region: region, side: side) { picked, pickedSide in
                        region = picked
                        side = pickedSide ?? side
                    }
                    Picker("Side", selection: $side) {
                        ForEach(Laterality.allCases, id: \.self) { Text($0.choice).tag(Laterality?.some($0)) }
                        Text("Not stated").tag(Laterality?.none)
                    }
                    .pickerStyle(.segmented).accessibilityIdentifier("body-map-side")
                    Text(needsSide ? "Choose the side" : region.map { "Selected: \($0.label(side: side))" } ?? "Nothing selected yet")
                        .font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.ink)
                        .accessibilityIdentifier("body-map-status")
                    TextField("Find a region", text: $query).carbonFieldSurface()
                        .accessibilityIdentifier("body-map-search")
                    ForEach(matches) { r in
                        Button { region = r } label: { CarbonRow(r.label, detail: r.sided ? "Left or right" : nil) {} }
                            .buttonStyle(.plain).accessibilityIdentifier("body-region-\(r.id)")
                    }
                }
                .padding(16)
            }
            .navigationTitle("Pick \(title.lowercased())")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Use this site") {
                        guard let region else { return }
                        onPick(PickedSite(label: region.label(side: side), laterality: side))
                        dismiss()
                    }
                    .disabled(region == nil || needsSide).accessibilityIdentifier("body-map-use")
                }
            }
        }
    }
}

/// The figure: every zone of the view, drawn and tappable. The back view
/// lays the front's zones underneath, unlabelled, so its few zones sit on a body.
private struct BodyMap: View {
    let view: BodyRegion.View
    let region: BodyRegion?
    let side: Laterality?
    let onTap: (BodyRegion, Laterality?) -> Void

    /// Height over width of the figure the zone fractions describe.
    private static let aspect: CGFloat = 2.2
    private static let height: CGFloat = 440

    var body: some View {
        GeometryReader { geo in
            let size = geo.size
            ZStack(alignment: .topLeading) {
                if view == .back {
                    ForEach(BodyRegion.all) { r in
                        ForEach(Array(r.zones(on: .front).enumerated()), id: \.offset) { _, z in
                            place(z.zone.mirrored, in: size) { RoundedRectangle(cornerRadius: 4).fill(MedBrainsTheme.surface) }
                        }
                    }
                    .accessibilityHidden(true)
                }
                ForEach(BodyRegion.all) { r in
                    ForEach(Array(r.zones(on: view).enumerated()), id: \.offset) { _, z in
                        zone(r, z.side, z.zone, in: size)
                    }
                }
            }
        }
        .frame(width: Self.height / Self.aspect, height: Self.height)
        .frame(maxWidth: .infinity)
        .overlay(alignment: .bottom) {
            // The patient's right is on the screen's left from the front, its right from behind.
            HStack {
                Text(view == .front ? "Patient's right" : "Patient's left")
                Spacer()
                Text(view == .front ? "Patient's left" : "Patient's right")
            }
            .font(CarbonType.helper).foregroundStyle(MedBrainsTheme.inkSecondary)
            .offset(y: 20)
        }
        .padding(.bottom, 24)
    }

    private func zone(_ r: BodyRegion, _ zoneSide: Laterality?, _ z: BodyRegion.Zone, in size: CGSize) -> some View {
        let selected = region == r && (zoneSide == nil || zoneSide == side)
        let name = zoneSide.map { "Patient's \($0.rawValue) \(r.label.lowercased())" } ?? r.label
        return place(z, in: size) {
            Button { onTap(r, zoneSide) } label: {
                RoundedRectangle(cornerRadius: 4).fill(selected ? MedBrainsTheme.interactive : MedBrainsTheme.field)
                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(MedBrainsTheme.borderStrong, lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
        .accessibilityLabel(name)
        .accessibilityAddTraits(selected ? .isSelected : [])
        .accessibilityIdentifier("body-zone-\(r.id)\(zoneSide.map { "-\($0.rawValue)" } ?? "")")
    }

    /// The content sized and placed where the zone's fractions put it.
    private func place(_ z: BodyRegion.Zone, in size: CGSize, @ViewBuilder _ content: () -> some View) -> some View {
        content()
            .frame(width: z.w * size.width, height: z.h * size.height)
            .position(x: (z.x + z.w / 2) * size.width, y: (z.y + z.h / 2) * size.height)
    }
}
