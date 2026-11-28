import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// A loaded admissions list with a search over name, UHID, IP number, bed and
/// ward, and a "Showing N of M" line, so a long ward never ends silently at
/// the first page. Shared by the nurse's shift and the doctor's rounds.
struct AdmissionWorklist<Row: View>: View {
    let paged: PagedRows<AdmissionRow>
    @ViewBuilder let row: (AdmissionRow) -> Row
    @State private var query = ""
    @FocusState private var focused: Bool

    var body: some View {
        let shown = paged.rows.filter { $0.matches(query) }
        VStack(alignment: .leading, spacing: 8) {
            CarbonField("Search", isFocused: focused) {
                TextField("Name, UHID, IP number or bed", text: $query).focused($focused)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                    .accessibilityIdentifier("admissions-search")
            }
            .padding(.horizontal, 16)
            Text(countLine(shown: shown.count)).font(CarbonType.helper)
                .foregroundStyle(MedBrainsTheme.inkSecondary).padding(.horizontal, 16)
                .accessibilityIdentifier("admissions-count")
            if shown.isEmpty {
                Text("No admitted patient matches \"\(query)\".").font(CarbonType.bodyCompact)
                    .foregroundStyle(MedBrainsTheme.inkSecondary).padding(16)
            }
            LazyVStack(spacing: 0) { ForEach(shown) { row($0) } }
        }
    }

    /// "Showing 40 of 340", and when the page cap stopped the read, that the
    /// rest are not on this list.
    private func countLine(shown: Int) -> String {
        let line = "Showing \(shown) of \(paged.total)"
        if paged.isComplete { return line }
        return line
            + ". Only the latest \(paged.rows.count) are loaded here; find others on the web."
    }
}
