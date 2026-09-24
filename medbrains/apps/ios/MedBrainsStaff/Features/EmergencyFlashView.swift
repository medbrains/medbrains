import MedBrainsCore
import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// The whole phone becomes the alarm. While any emergency code is open this
/// overlay sits above every screen, blinking in that code's fixed colour
/// with the code's name across it — the six colours are patient-safety
/// constants, identical on every device. One blink a second (WCAG 2.2 SC
/// 2.3.1); reduced motion gets a solid banner; the word is always beside
/// the colour. Triple-tap silences on this phone only and is deliberately
/// not "I'm responding": a nurse on another ward quieting her phone must
/// not become the code blue's first-on-scene. A failed poll keeps the last
/// good list rather than clearing the alarm.
struct EmergencyFlashOverlay: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    @State private var codeBlues = Remote<[CodeBlueEvent]>()
    @State private var erCodes = Remote<[EmergencyCodeActivation]>()
    @State private var silenced: [String] = []

    var body: some View {
        let open = emergencyOpenCodes(
            codeBlues: (codeBlues.value ?? []).map { CodeBlueRef(id: $0.id, location: $0.location) },
            erCodes: (erCodes.value ?? []).map { EmergencyCodeRef(id: $0.id, codeType: $0.codeType, location: $0.location) },
            silencedKeys: silenced
        )
        ZStack {
            if let current = open.first {
                // No fade: a fading overlay still takes touches, so the tap after
                // a silence landed on "I'm responding". An alarm appears and goes at once.
                FlashBanner(code: current, others: open.count - 1, canRespond: auth.identity?.can("nurse.code_blue.respond") ?? false) {
                    silenced.append(current.key)
                }
            }
        }
        .task(id: auth.identity?.userId) {
            guard let client, let who = auth.identity else { return }
            let api = NurseApi(client: client)
            // Each feed is gated on its own permission: a phone without one still gets the other.
            async let a: () = who.can("nurse.code_blue.view") ? codeBlues.poll(every: 10) { try await api.listActiveCodeBlues() } : ()
            async let b: () = who.can("emergency.codes.list") ? erCodes.poll(every: 10) { try await api.listOpenEmergencyCodes() } : ()
            _ = await (a, b)
        }
    }
}

private func codeColours(_ codeType: String) -> (fill: Color, ink: Color) {
    switch codeType {
    case "code_blue": (Carbon.EmergencyCode.blue, .white)
    case "code_red": (Carbon.EmergencyCode.red, .white)
    case "code_pink": (Carbon.EmergencyCode.pink, .white)
    case "code_black": (Carbon.EmergencyCode.black, .white)
    case "code_yellow": (Carbon.EmergencyCode.yellow, Carbon.EmergencyCode.black)
    case "code_orange": (Carbon.EmergencyCode.orange, .white)
    default: (Carbon.EmergencyCode.red, .white)
    }
}

private struct FlashBanner: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.apiClient) private var client
    let code: OpenEmergencyCode
    let others: Int
    let canRespond: Bool
    let onSilence: () -> Void
    @State private var dim = false
    @State private var responded = false
    @State private var busy = false

    var body: some View {
        let (fill, ink) = codeColours(code.codeType)
        ZStack {
            fill.opacity(dim ? 0.15 : 1).ignoresSafeArea()
            VStack(spacing: 16) {
                Text(code.label).font(.system(size: 44, weight: .black)).tracking(2).foregroundStyle(ink).multilineTextAlignment(.center)
                Text(code.location).font(CarbonType.heading03).foregroundStyle(ink).multilineTextAlignment(.center)
                if others > 0 { Text("+\(others) more code\(others == 1 ? "" : "s") open").font(CarbonType.body).foregroundStyle(ink) }
                Text("Triple-tap to silence on this phone").font(CarbonType.bodyCompact).foregroundStyle(ink.opacity(0.9))
                // The gesture is for a gloved hand; the button is for everyone else (WCAG 2.5.1 — no gesture-only path).
                Button("Silence on this phone", action: onSilence)
                    .font(CarbonType.bodyCompact).foregroundStyle(ink).frame(minHeight: 44)
                    .accessibilityLabel("Silence this alarm on this phone. Silencing does not say you are responding.")
                    .accessibilityIdentifier("emergency-flash-silence")
                if let id = code.codeBlueId, canRespond {
                    Button(responded ? "You are responding" : "I'm responding") { Task { await respond(id) } }
                        .font(CarbonType.body)
                        .foregroundStyle(fill)
                        .padding(.horizontal, 24).frame(minHeight: 48)
                        .background(Color.white)
                        .disabled(busy || responded)
                        .accessibilityLabel(responded ? "You are responding to this code blue" : "Respond to this code blue")
                        .accessibilityIdentifier("emergency-flash-respond")
                }
            }
            .padding(24)
        }
        .contentShape(Rectangle())
        .onTapGesture(count: 3, perform: onSilence)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(code.label) at \(code.location). Triple-tap to silence this alarm on this phone.")
        .accessibilityHint("Silencing does not say you are responding.")
        .accessibilityIdentifier("emergency-flash")
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.linear(duration: 0.5).repeatForever(autoreverses: true)) { dim = true }
        }
    }

    private func respond(_ id: String) async {
        guard let client else { return }
        busy = true
        defer { busy = false }
        if (try? await NurseApi(client: client).respondToCodeBlue(id)) != nil { responded = true }
    }
}
