import MedBrainsKit
import MedBrainsUI
import PhotosUI
import SwiftUI

/// JPEG quality for a prescription photo: legible, well under the server's 8 MB.
private let photoQuality = 0.8

/// The cart: quantities, the prescription it rides on (one of the patient's
/// own from this hospital, or a photo), pickup or part 3's home delivery,
/// and placing the order.
struct StoreCartView: View {
    let prescriptionId: String?
    let onPlaced: () -> Void
    @Environment(\.portalApi) private var portal
    @State private var cart: StoreCart?
    @State private var refills: [PortalRefill] = []
    @State private var hospitalRx: String?
    @State private var offer: PortalDeliveryOffer?
    @State private var delivering = false
    @State private var address = ""
    @State private var phone = ""
    @State private var payment: String?
    @State private var photo: PhotosPickerItem?
    @State private var message: String?
    @State private var placing = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let cart, !cart.lines.isEmpty {
                ForEach(cart.lines) { l in
                    HStack {
                        Text("\(l.item.name) × \(l.quantity)\(l.lineTotal.map { " · ₹\($0)" } ?? "")").font(CarbonType.body)
                        Spacer()
                        Button("Remove") { Task { await remove(l.item.id) } }.buttonStyle(.carbonGhost).accessibilityIdentifier("remove-\(l.item.id)")
                    }
                }
                Text("Total ₹\(cart.total)").font(CarbonType.heading02)
                if cart.prescriptionNeeded { prescriptionSection(cart) }
                deliverySection(cart)
                if let message { CarbonNotification(kind: .error, title: "Not ordered", message: message).accessibilityIdentifier("store-message") }
                Button("Place order") { Task { await place(cart) } }
                    .buttonStyle(CarbonPrimaryButtonStyle()).disabled(placing).accessibilityIdentifier("place-order")
            } else {
                Text("Your cart is empty. Search for a medicine, or order a prescription.").font(CarbonType.body)
            }
        }
        .task { await load() }
        .onChange(of: photo) { _, item in Task { await upload(item) } }
    }

    @ViewBuilder private func prescriptionSection(_ cart: StoreCart) -> some View {
        CarbonSectionTitle("Prescription")
        let today = Date().formatted(.iso8601.year().month().day())
        let usable = refills.filter { Storefront.usable(validUntil: $0.validUntil, today: today) }
        CarbonPicker("One of your prescriptions from this hospital", options: usable.map { .init(id: $0.prescriptionId, label: "\(ServerTime.short($0.prescribedAt)) · \($0.drugs.joined(separator: ", "))") }, selection: $hospitalRx, placeholder: "Choose, or upload one")
            .accessibilityIdentifier("store-rx")
        PhotosPicker(cart.prescriptionUploaded ? "Upload a different photo" : "Upload a photo of it", selection: $photo, matching: .images)
            .accessibilityIdentifier("upload-rx")
    }

    @ViewBuilder private func deliverySection(_ cart: StoreCart) -> some View {
        let collect = cart.lines.filter(\.item.pickupOnly).map(\.item.name)
        if !collect.isEmpty { Text("\(collect.joined(separator: ", ")) can't be delivered: collect at the pharmacy.").font(CarbonType.helper) }
        if let offer, offer.available {
            Picker("How you'll get it", selection: $delivering) {
                Text("Collect").tag(false)
                Text("Home delivery").tag(true)
            }
            .pickerStyle(.segmented)
            .accessibilityIdentifier("store-fulfilment")
            if delivering {
                TextField("Deliver to", text: $address, axis: .vertical).textContentType(.fullStreetAddress).accessibilityIdentifier("store-address")
                TextField("Phone for the delivery", text: $phone).keyboardType(.phonePad).textContentType(.telephoneNumber)
                Picker("How you'll pay", selection: $payment) {
                    ForEach(offer.payments, id: \.self) { Text(HomeDelivery.paymentLabels[$0] ?? $0).tag(Optional($0)) }
                }
                .pickerStyle(.segmented)
            }
        } else if let reason = offer?.reason {
            Text(reason).font(CarbonType.helper)
        }
    }

    private func load() async {
        guard let portal else { return }
        hospitalRx = prescriptionId
        cart = try? await portal.cart()
        refills = (try? await portal.refills()) ?? []
        offer = try? await portal.storeDeliveryOptions()
        address = offer?.addresses.first?.address ?? ""
        phone = offer?.contactPhone ?? ""
        payment = offer?.payments.first
    }

    private func remove(_ id: String) async {
        guard let portal else { return }
        cart = (try? await portal.setQuantity(itemId: id, quantity: 0)) ?? cart
    }

    private func upload(_ item: PhotosPickerItem?) async {
        guard let portal, let item else { return }
        guard let data = try? await item.loadTransferable(type: Data.self), let jpeg = UIImage(data: data)?.jpegData(compressionQuality: photoQuality) else {
            message = "That photo couldn't be read"
            return
        }
        do { cart = try await portal.uploadPrescription(jpeg: jpeg) } catch { message = error.localizedDescription }
    }

    private func place(_ cart: StoreCart) async {
        guard let portal else { return }
        let checkout = Storefront.checkout(lines: cart.lines.count, allOnSale: cart.lines.allSatisfy(\.item.onSale), prescriptionNeeded: cart.prescriptionNeeded, hospitalId: hospitalRx, uploaded: cart.prescriptionUploaded)
        guard case let .ready(source, prescriptionId) = checkout else {
            if case let .problem(reason) = checkout { message = reason }
            return
        }
        var choice: HomeDelivery.Choice?
        if delivering {
            if let problem = HomeDelivery.problem(address: address, phone: phone, payment: payment, offered: offer?.payments ?? []) {
                message = problem
                return
            }
            choice = HomeDelivery.choice(address: address, landmark: "", pincode: nil, phone: phone, slot: nil, payment: payment ?? "")
        }
        placing = true
        defer { placing = false }
        do {
            _ = try await portal.checkout(source: source, prescriptionId: prescriptionId, delivery: choice)
            onPlaced()
        } catch {
            message = error.localizedDescription
        }
    }
}
