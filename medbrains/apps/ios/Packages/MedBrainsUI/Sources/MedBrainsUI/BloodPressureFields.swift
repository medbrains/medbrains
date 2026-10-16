import MedBrainsKit
import SwiftUI

/// One blood-pressure reading as two numbers side by side: systolic (high)
/// then diastolic (low), in mmHg. Errors show once a field is left, or on
/// every field when `showErrors` is set after a refused save. Return on a
/// hardware keyboard moves from systolic to diastolic.
public struct BloodPressureFields: View {
    @Binding var systolic: String
    @Binding var diastolic: String
    let showErrors: Bool
    @FocusState private var focus: Side?
    @State private var left: Set<Side> = []

    private enum Side: Hashable { case systolic, diastolic }

    public init(systolic: Binding<String>, diastolic: Binding<String>, showErrors: Bool = false) {
        _systolic = systolic
        _diastolic = diastolic
        self.showErrors = showErrors
    }

    public var body: some View {
        let errors = BloodPressure.validate(systolic: systolic, diastolic: diastolic)
        VStack(alignment: .leading, spacing: 8) {
            Text("Blood pressure").font(CarbonType.label).foregroundStyle(MedBrainsTheme.inkSecondary)
            HStack(alignment: .top, spacing: 8) {
                field("Systolic (high)", $systolic, .systolic, shown(errors.systolic, .systolic))
                    .submitLabel(.next)
                    .onSubmit { focus = .diastolic }
                field("Diastolic (low)", $diastolic, .diastolic, shown(errors.diastolic, .diastolic))
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Blood pressure")
        .onChange(of: focus) { old, _ in if let old { left.insert(old) } }
    }

    private func shown(_ error: String?, _ side: Side) -> String? {
        showErrors || left.contains(side) ? error : nil
    }

    private func field(_ label: String, _ text: Binding<String>, _ side: Side, _ error: String?) -> some View {
        CarbonField(label, helper: "mmHg", error: error, isFocused: focus == side) {
            TextField(label, text: text)
                .keyboardType(.numberPad)
                .focused($focus, equals: side)
                .accessibilityIdentifier(side == .systolic ? "bp-systolic" : "bp-diastolic")
        }
    }
}
