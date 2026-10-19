import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// Search results shown, at most; the server sends no more.
private let resultLimit = 40
private let tabs = [("prescriptions", "My prescriptions"), ("shop", "Shop"), ("cart", "Cart"), ("orders", "Orders")]

/// The hospital pharmacy, ordered from: a prescription written here in one
/// tap, the shop, the cart (with the prescription it rides on and pickup or
/// delivery), and the orders with the pharmacist's answer per medicine.
struct StoreView: View {
    @State private var tab = "prescriptions"
    @State private var prescriptionId: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                CarbonPageHeader(eyebrow: "Pharmacy", title: "Order medicines", subtitle: "From the hospital's own pharmacy. A pharmacist checks every prescription.")
                Picker("Section", selection: $tab) {
                    ForEach(tabs, id: \.0) { Text($0.1).tag($0.0) }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .accessibilityIdentifier("store-tabs")
                Group {
                    switch tab {
                    case "prescriptions": StorePrescriptionsView { prescriptionId = $0; tab = "cart" }
                    case "shop": StoreShopView()
                    case "cart": StoreCartView(prescriptionId: prescriptionId) { tab = "orders" }
                    default: StoreOrdersView()
                    }
                }
                .padding(.horizontal, 16)
            }
        }
        .background(MedBrainsTheme.canvas).navigationTitle("Pharmacy").navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-pharmacy")
    }
}

private var today: String { Date().formatted(.iso8601.year().month().day()) }

private struct StorePrescriptionsView: View {
    let onOrdered: (String) -> Void
    @Environment(\.portalApi) private var portal
    @State private var remote = Remote<[PortalRefill]>()
    @State private var note: String?

    var body: some View {
        RemoteContentView(id: "store-prescriptions", state: remote.state, unavailableTitle: "Couldn't load your prescriptions", unavailableMessage: "Try again in a moment.", isEmpty: { rows in !rows.contains { Storefront.usable(validUntil: $0.validUntil, today: today) } }, emptyTitle: "No current prescriptions", emptyMessage: "Prescriptions from this hospital appear here.", retry: { Task { await load() } }) { rows in
            VStack(alignment: .leading, spacing: 12) {
                ForEach(rows.filter { Storefront.usable(validUntil: $0.validUntil, today: today) }) { r in
                    Text(r.drugs.joined(separator: ", ")).font(CarbonType.heading02)
                    Text("\(r.doctorName.map { "\($0) · " } ?? "")\(ServerTime.short(r.prescribedAt))").font(CarbonType.helper)
                    Button("Order these medicines") { Task { await order(r.prescriptionId) } }
                        .buttonStyle(CarbonPrimaryButtonStyle())
                        .accessibilityIdentifier("order-rx-\(r.prescriptionId)")
                }
                if let note { CarbonNotification(kind: .info, title: "Not everything is in your cart", message: note) }
            }
        }
        .task { await load() }
    }

    private func load() async {
        guard let portal else { return }
        await remote.load { try await portal.refills() }
    }

    private func order(_ id: String) async {
        guard let portal else { return }
        do {
            let filled = try await portal.orderPrescription(id)
            let left = filled.leftOut.map { "\($0.drugName): \($0.reason)" }.joined(separator: " · ")
            note = left.isEmpty ? nil : left
            onOrdered(filled.prescriptionId)
        } catch {
            note = error.localizedDescription
        }
    }
}

private struct StoreShopView: View {
    @Environment(\.portalApi) private var portal
    @State private var q = ""
    @State private var items: [StoreItem] = []
    @State private var message: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("Search by brand or generic name", text: $q).textFieldStyle(.roundedBorder).accessibilityIdentifier("store-search")
            Button("Search") { Task { await search() } }.buttonStyle(CarbonPrimaryButtonStyle()).accessibilityIdentifier("store-search-go")
            if let message { Text(message).font(CarbonType.helper) }
            ForEach(items) { item in StoreItemRow(item: item) { Task { await add(item) } } }
        }
    }

    private func search() async {
        guard let portal else { return }
        do {
            let found = try await portal.searchStore(tenantCode: AppConfig.hospitalCode, q: q.trimmingCharacters(in: .whitespaces))
            items = Array(found.items.prefix(resultLimit))
            message = found.items.isEmpty ? "Nothing found. Try the generic name." : nil
        } catch {
            message = "The pharmacy isn't taking orders online right now."
        }
    }

    private func add(_ item: StoreItem) async {
        guard let portal else { return }
        do {
            _ = try await portal.setQuantity(itemId: item.id, quantity: 1)
            message = "\(item.name) is in your cart"
        } catch {
            message = error.localizedDescription
        }
    }
}

private struct StoreItemRow: View {
    let item: StoreItem
    let onAdd: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(item.name).font(CarbonType.heading02).foregroundStyle(MedBrainsTheme.ink)
            Text([item.inn, item.pack].compactMap { $0 }.joined(separator: " · ")).font(CarbonType.helper)
            HStack(spacing: 4) {
                if let s = item.schedule { CarbonTag("Schedule \(s)", tone: .warning) }
                if item.prescriptionNeeded { CarbonTag("Prescription needed", tone: .info) }
                CarbonTag(Storefront.label(Storefront.stockLabels, item.stock), tone: item.stock == "out" ? .neutral : .success)
            }
            Text(item.price.map { "₹\($0)\(item.mrp.flatMap { $0 != item.price ? " · MRP ₹\($0)" : nil } ?? "")" } ?? "Price at the pharmacy").font(CarbonType.body)
            if let note = item.note { Text(note).font(CarbonType.helper) }
            if Storefront.canAdd(onSale: item.onSale, saleClass: item.saleClass, price: item.price, stock: item.stock) {
                Button("Add to cart", action: onAdd).buttonStyle(.carbonGhost).accessibilityIdentifier("add-\(item.id)")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("store-item-\(item.id)")
    }
}

private struct StoreOrdersView: View {
    @Environment(\.portalApi) private var portal
    @State private var remote = Remote<[StoreOrder]>()

    var body: some View {
        RemoteContentView(id: "store-orders", state: remote.state, unavailableTitle: "Couldn't load your orders", unavailableMessage: "Try again in a moment.", isEmpty: \.isEmpty, emptyTitle: "No orders yet", emptyMessage: "Medicines you order appear here.", retry: { Task { await load() } }) { rows in
            VStack(alignment: .leading, spacing: 12) {
                ForEach(rows) { o in
                    VStack(alignment: .leading, spacing: 4) {
                        CarbonTag(Storefront.label(Storefront.orderStatusLabels, o.status), tone: o.status == "rejected" ? .danger : .info)
                        ForEach(o.lines, id: \.catalogItemId) { l in
                            Text("\(l.drugName) × \(l.approvedQuantity ?? l.quantity)\(l.rejectReason.map { " — not approved: \(Storefront.label(Storefront.rejectReasonLabels, $0))" } ?? "")").font(CarbonType.body)
                        }
                        if let n = o.decisionNote { Text("Pharmacist: \(n)").font(CarbonType.helper) }
                        Text("Total ₹\(o.total) · \(o.fulfilment == "delivery" ? "home delivery" : "collect at the pharmacy")").font(CarbonType.helper)
                    }
                    .accessibilityIdentifier("store-order-\(o.id)")
                }
            }
        }
        .task { await load() }
    }

    private func load() async {
        guard let portal else { return }
        await remote.load { try await portal.storeOrders() }
    }
}
