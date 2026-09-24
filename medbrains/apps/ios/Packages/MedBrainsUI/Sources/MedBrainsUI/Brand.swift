import SwiftUI

/// The MedBrains mark, drawn — the same five shapes as
/// apps/web/public/logo/medbrains-mark.svg, so it is crisp at any size and
/// carries no bitmap. Blue 60 ground, the trace in white, the pulse in Green 40.
public struct BrandMark: View {
    let size: CGFloat
    public init(size: CGFloat = 40) { self.size = size }

    public var body: some View {
        Canvas { context, box in
            let s = box.width / 44
            var ground = Path(roundedRect: CGRect(x: 0, y: 0, width: box.width, height: box.height), cornerRadius: 3 * s)
            context.fill(ground, with: .color(Carbon.blue[5]))
            ground = Path()
            var arc = Path()
            arc.addArc(center: CGPoint(x: 22 * s, y: 29 * s), radius: 13 * s, startAngle: .degrees(180), endAngle: .degrees(0), clockwise: false)
            context.stroke(arc, with: .color(.white.opacity(0.3)), style: StrokeStyle(lineWidth: 1.25 * s, lineCap: .round))
            var trace = Path()
            trace.move(to: CGPoint(x: 7 * s, y: 29 * s))
            for p in [(14, 29), (16.5, 24), (18.5, 33), (21, 16), (23.5, 29), (29, 29)] { trace.addLine(to: CGPoint(x: CGFloat(p.0) * s, y: CGFloat(p.1) * s)) }
            context.stroke(trace, with: .color(.white), style: StrokeStyle(lineWidth: 2 * s, lineCap: .round, lineJoin: .round))
            var tail = Path()
            tail.move(to: CGPoint(x: 29 * s, y: 29 * s))
            tail.addLine(to: CGPoint(x: 35 * s, y: 29 * s))
            context.stroke(tail, with: .color(Carbon.mint[3]), style: StrokeStyle(lineWidth: 2 * s, lineCap: .round))
            context.fill(Path(ellipseIn: CGRect(x: 27 * s, y: 27 * s, width: 4 * s, height: 4 * s)), with: .color(Carbon.mint[3]))
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// Mark plus the name, in the brand face. The login screens open with it.
public struct BrandWordmark: View {
    let height: CGFloat
    public init(height: CGFloat = 32) { self.height = height }

    public var body: some View {
        HStack(spacing: height * 0.3) {
            BrandMark(size: height)
            Text("MedBrains")
                .font(.custom("IBMPlexSans-SemiBold", size: height * 0.62, relativeTo: .title2))
                .tracking(-0.5)
                .foregroundStyle(MedBrainsTheme.ink)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("MedBrains")
    }
}
