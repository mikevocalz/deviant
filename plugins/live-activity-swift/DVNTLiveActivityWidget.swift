import ActivityKit
import SwiftUI
import UIKit
import WidgetKit

private let APP_GROUP = "group.com.dvnt.app"

// ── Brand Colors ──
private let dvntPurple = Color(red: 0.541, green: 0.251, blue: 0.812)
private let dvntCyan = Color(red: 0.247, green: 0.863, blue: 1.0)
private let dvntRed = Color(red: 0.988, green: 0.145, blue: 0.227)

private func weatherSFSymbol(_ icon: String?) -> String {
    switch icon {
    case "sun": return "sun.max.fill"
    case "cloud": return "cloud.fill"
    case "rain": return "cloud.rain.fill"
    case "snow": return "snowflake"
    case "storm": return "cloud.bolt.fill"
    case "fog": return "cloud.fog.fill"
    case "wind": return "wind"
    default: return "cloud.fill"
    }
}

private func logoImage(size: CGFloat) -> some View {
    let bundle = Bundle.main
    if UIImage(named: "dvnt_logo", in: bundle, with: nil) != nil {
        return AnyView(
            Image("dvnt_logo", bundle: bundle)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: size, height: size)
                .clipShape(RoundedRectangle(cornerRadius: max(2, size * 0.22)))
        )
    }
    return AnyView(
        Image(systemName: "sparkles.circle.fill")
            .resizable()
            .aspectRatio(contentMode: .fit)
            .frame(width: size, height: size)
            .foregroundColor(dvntPurple)
    )
}

private func logoGlyphImage(size: CGFloat) -> some View {
    let bundle = Bundle.main
    if UIImage(named: "dvnt_logo_glyph", in: bundle, with: nil) != nil {
        return AnyView(
            Image("dvnt_logo_glyph", bundle: bundle)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: size, height: size)
                .clipShape(RoundedRectangle(cornerRadius: max(2, size * 0.22)))
        )
    }
    return AnyView(logoImage(size: size))
}

private func heroLocalPathFromDefaults() -> String? {
    guard let defaults = UserDefaults(suiteName: APP_GROUP),
          let json = defaults.string(forKey: "surfacePayload"),
          let data = json.data(using: .utf8),
          let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let tile1 = obj["tile1"] as? [String: Any] else { return nil }
    return tile1["heroLocalPath"] as? String
}

private func resolvedHeroPath(contentStatePath: String?) -> String? {
    if let p = contentStatePath, !p.isEmpty { return p }
    return heroLocalPathFromDefaults()
}

private func heroImage(localPath: String?) -> some View {
    Group {
        if let p = resolvedHeroPath(contentStatePath: localPath), !p.isEmpty,
           let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: APP_GROUP),
           let img = UIImage(contentsOfFile: container.appendingPathComponent(p).path) {
            Image(uiImage: img)
                .resizable()
                .aspectRatio(contentMode: .fill)
        } else {
            LinearGradient(
                colors: [dvntPurple.opacity(0.5), Color(red: 0.11, green: 0.11, blue: 0.12)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }
}

private func countdownString(from isoDate: String?) -> String? {
    guard let dateStr = isoDate,
          let date = ISO8601DateFormatter().date(from: dateStr) else { return nil }
    let diff = date.timeIntervalSinceNow
    guard diff > 0 else { return nil }
    let hours = Int(diff) / 3600
    let minutes = (Int(diff) % 3600) / 60
    if hours > 0 { return "\(hours)h \(minutes)m" }
    return "\(minutes)m"
}

private func dateParts(from iso: String?) -> (day: String, month: String)? {
    guard let dateStr = iso, let date = ISO8601DateFormatter().date(from: dateStr) else { return nil }
    let dayF = DateFormatter(); dayF.dateFormat = "d"
    let monthF = DateFormatter(); monthF.dateFormat = "MMM"
    return (dayF.string(from: date), monthF.string(from: date).uppercased())
}

private func formatShortTime(_ iso: String?) -> String? {
    guard let dateStr = iso, let date = ISO8601DateFormatter().date(from: dateStr) else { return nil }
    let f = DateFormatter(); f.dateFormat = "h:mm a"
    return f.string(from: date)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOCK SCREEN — Event card: hero image left, event info right
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
struct DVNTLockScreenView: View {
    let context: ActivityViewContext<DVNTLiveAttributes>

    var body: some View {
        let s = context.state
        Link(destination: URL(string: s.tile1DeepLink)!) {
            HStack(spacing: 0) {
                // Left: hero image with date badge overlay
                ZStack(alignment: .bottomLeading) {
                    heroImage(localPath: s.tile1HeroLocalPath)
                        .frame(width: 100, height: 100)
                        .clipped()

                    // Date badge
                    if let parts = dateParts(from: s.tile1StartAt) {
                        VStack(spacing: 0) {
                            Text(parts.day)
                                .font(.system(size: 16, weight: .bold, design: .rounded))
                                .foregroundColor(.white)
                            Text(parts.month)
                                .font(.system(size: 8, weight: .bold))
                                .foregroundColor(.white.opacity(0.7))
                        }
                        .frame(width: 34, height: 34)
                        .background(Color.black.opacity(0.65))
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .padding(6)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .padding(.leading, 10).padding(.vertical, 10)

                // Right: event details
                VStack(alignment: .leading, spacing: 5) {
                    // Top row: logo + weather
                    HStack(spacing: 4) {
                        logoImage(size: 16)
                        Spacer()
                        if let icon = s.weatherIcon {
                            Image(systemName: weatherSFSymbol(icon))
                                .font(.system(size: 9))
                                .foregroundColor(dvntCyan)
                        }
                        if let temp = s.weatherTempF {
                            Text("\(temp)°")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(.white.opacity(0.6))
                        }
                    }

                    // Event title
                    Text(s.tile1Title)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(.white)
                        .lineLimit(2)

                    Spacer(minLength: 0)

                    // Countdown
                    if s.tile1IsUpcoming, let cd = countdownString(from: s.tile1StartAt) {
                        HStack(spacing: 4) {
                            Image(systemName: "clock.fill")
                                .font(.system(size: 8))
                                .foregroundColor(dvntPurple)
                            Text(cd)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(dvntPurple)
                        }
                    }

                    // Venue
                    HStack(spacing: 4) {
                        if let venue = s.tile1VenueName {
                            Image(systemName: "mappin")
                                .font(.system(size: 8))
                                .foregroundColor(.white.opacity(0.4))
                            Text(venue)
                                .font(.system(size: 11))
                                .foregroundColor(.white.opacity(0.6))
                                .lineLimit(1)
                        }
                        if let city = s.tile1City {
                            Text("· \(city)")
                                .font(.system(size: 11))
                                .foregroundColor(.white.opacity(0.4))
                                .lineLimit(1)
                        }
                    }
                }
                .padding(.horizontal, 12).padding(.vertical, 12)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .activityBackgroundTint(.black.opacity(0.9))
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DYNAMIC ISLAND — Event-focused layout
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
struct DVNTLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: DVNTLiveAttributes.self) { context in
            DVNTLockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                // ── Expanded: event card layout ──
                DynamicIslandExpandedRegion(.leading) {
                    // Hero thumbnail
                    ZStack {
                        heroImage(localPath: context.state.tile1HeroLocalPath)
                            .frame(width: 52, height: 52)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    .padding(.leading, 2)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(context.state.tile1Title)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                            .lineLimit(2)
                        if let venue = context.state.tile1VenueName {
                            HStack(spacing: 3) {
                                Image(systemName: "mappin")
                                    .font(.system(size: 8))
                                    .foregroundColor(.white.opacity(0.5))
                                Text(venue)
                                    .font(.system(size: 11))
                                    .foregroundColor(.white.opacity(0.6))
                                    .lineLimit(1)
                            }
                        }
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    // Date badge
                    if let parts = dateParts(from: context.state.tile1StartAt) {
                        VStack(spacing: 0) {
                            Text(parts.day)
                                .font(.system(size: 16, weight: .bold, design: .rounded))
                                .foregroundColor(.white)
                            Text(parts.month)
                                .font(.system(size: 8, weight: .bold))
                                .foregroundColor(dvntPurple)
                        }
                        .frame(width: 36, height: 36)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack(spacing: 8) {
                        // Countdown pill
                        if context.state.tile1IsUpcoming, let cd = countdownString(from: context.state.tile1StartAt) {
                            HStack(spacing: 4) {
                                Image(systemName: "clock.fill")
                                    .font(.system(size: 8))
                                    .foregroundColor(dvntPurple)
                                Text(cd)
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundColor(dvntPurple)
                            }
                            .padding(.horizontal, 8).padding(.vertical, 4)
                            .background(dvntPurple.opacity(0.15))
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        }
                        Spacer()
                        // Weather
                        if let icon = context.state.weatherIcon, let temp = context.state.weatherTempF {
                            HStack(spacing: 3) {
                                Image(systemName: weatherSFSymbol(icon))
                                    .font(.system(size: 9))
                                    .foregroundColor(dvntCyan)
                                Text("\(temp)°")
                                    .font(.system(size: 10, weight: .medium))
                                    .foregroundColor(.white.opacity(0.6))
                            }
                        }
                    }
                    .padding(.top, 4)
                }
            } compactLeading: {
                // Compact: logo glyph
                logoGlyphImage(size: 16)
            } compactTrailing: {
                // Compact: countdown or temp
                if context.state.tile1IsUpcoming, let cd = countdownString(from: context.state.tile1StartAt) {
                    Text(cd)
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundColor(dvntPurple)
                        .monospacedDigit()
                } else if let temp = context.state.weatherTempF {
                    Text("\(temp)°")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(dvntCyan)
                }
            } minimal: {
                // Minimal: just the logo
                logoGlyphImage(size: 14)
            }
            .widgetURL(URL(string: context.state.tile1DeepLink))
        }
    }
}
