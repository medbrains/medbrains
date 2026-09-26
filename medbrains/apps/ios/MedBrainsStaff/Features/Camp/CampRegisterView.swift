import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// The camp's first table: a name, an age, a sex and a phone if they have
/// one, then the number they keep to the pharmacy — shown big enough to read
/// out, and the form cleared for the next person in the line.
struct CampRegisterView: View {
    let station: CampStation
    @Environment(\.apiClient) private var client
    @State private var name = ""
    @State private var age = ""
    @State private var gender = "female"
    @State private var phone = ""
    @State private var issued: String?
    @State private var issuedTo = ""
    @State private var busy = false
    @State private var failure: String?
    @FocusState private var focus: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                CarbonPageHeader(eyebrow: station.campName, title: "Register", subtitle: "Each person gets one number for every station.")
                if let issued {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Their number").font(CarbonType.label).foregroundStyle(MedBrainsTheme.inkSecondary)
                        Text(issued).font(.system(size: 56, weight: .bold, design: .monospaced)).accessibilityIdentifier("camp-issued-number")
                        Text(issuedTo).font(CarbonType.bodyCompact).accessibilityIdentifier("camp-issued-to")
                    }
                }
                CarbonField("Name", isFocused: focus == "name") {
                    TextField("Full name", text: $name).focused($focus, equals: "name").accessibilityIdentifier("field-camp-name")
                }
                CarbonField("Age in years", isFocused: focus == "age") {
                    TextField("Age", text: $age).keyboardType(.numberPad).focused($focus, equals: "age").accessibilityIdentifier("field-camp-age")
                }
                VStack(alignment: .leading, spacing: 8) {
                    Text("Sex").font(CarbonType.label).foregroundStyle(MedBrainsTheme.inkSecondary)
                    Picker("Sex", selection: $gender) {
                        Text("Female").tag("female")
                        Text("Male").tag("male")
                        Text("Other").tag("other")
                    }
                    .pickerStyle(.segmented).accessibilityIdentifier("field-camp-gender")
                }
                CarbonField("Phone (if they have one)", isFocused: focus == "phone") {
                    TextField("Phone", text: $phone).keyboardType(.phonePad).focused($focus, equals: "phone").accessibilityIdentifier("field-camp-phone")
                }
                if let failure { CarbonNotification(kind: .error, title: "Not registered", message: failure) }
                Button { Task { await register() } } label: { HStack { Text("Register and give number"); Spacer(); Image(systemName: "arrow.right") } }
                    .buttonStyle(.carbonPrimary).disabled(busy || name.trimmingCharacters(in: .whitespaces).isEmpty)
                    .accessibilityIdentifier("camp-register-submit")
            }
            .padding(16)
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Register").navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-camp-register")
        .onAppear { focus = "name" }
    }

    private func register() async {
        guard let client else { return }
        busy = true
        defer { busy = false }
        failure = nil
        do {
            let done = try await CampApi(client: client).register(CampRegistrationBody(
                campId: station.campId,
                personName: name.trimmingCharacters(in: .whitespaces),
                age: Int(age),
                gender: gender,
                phone: phone.isEmpty ? nil : phone,
                isWalkIn: true
            ))
            issued = done.tokenNumber ?? "Registered — this camp has no stations"
            issuedTo = name.trimmingCharacters(in: .whitespaces)
            UIAccessibility.post(notification: .announcement, argument: "\(issuedTo), number \(issued ?? "")")
            name = ""; age = ""; phone = ""
            focus = "name"
        } catch let e as ApiError {
            failure = e.message
        } catch {
            failure = "Could not reach the hospital server. Nobody was registered."
        }
    }
}
