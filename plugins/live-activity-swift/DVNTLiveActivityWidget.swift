import ActivityKit
import SwiftUI
import UIKit
import WidgetKit

private let APP_GROUP = "group.com.dvnt.app"

private let dvntPurple = Color(red: 0.541, green: 0.251, blue: 0.812)
private let dvntCyan = Color(red: 0.247, green: 0.863, blue: 1.0)

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
    return logoImage(size: size)
}

private func countdownString(from isoDate: String?) -> String? {
    guard let dateStr = isoDate,
          let date = ISO8601DateFormatter().date(from: dateStr) else { return nil }
    let diff = date.timeIntervalSinceNow
    guard diff > 0 else { return nil }
    let hours = Int(diff) / 3600
    let minutes = (Int(diff) % 3600) / 60
    if hours > 0 { return "in \(hours)h \(minutes)m" }
    return "in \(minutes)m"
}

struct Tile1View: View {
    let state: DVNTLiveAttributes.ContentState
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            if let path = state.tile1HeroLocalPath, !path.isEmpty,
               let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: APP_GROUP),
               let img = UIImage(contentsOfFile: container.appendingPathComponent(path).path) {
                Image(uiImage: img)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(width: 56, height: 56)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(state.tile1Title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.white)
                    .lineLimit(2)
                if let startAt = state.tile1StartAt {
                    HStack(spacing: 4) {
                        if state.tile1IsUpcoming, let countdown = countdownString(from: startAt) {
                            Text(countdown).font(.system(size: 12, weight: .medium)).foregroundColor(dvntPurple)
                        }
                        if let venue = state.tile1VenueName {
                            Text(venue).font(.system(size: 12)).foregroundColor(.white.opacity(0.7)).lineLimit(1)
                        }
                        if let city = state.tile1City {
                            Text("· \(city)").font(.system(size: 12)).foregroundColor(.white.opacity(0.5)).lineLimit(1)
                        }
                    }
                }
            }
            Spacer(minLength: 0)
        }
    }
}

struct Tile2View: View {
    let state: DVNTLiveAttributes.ContentState
    private let columns = [
        GridItem(.flexible(), spacing: 4),
        GridItem(.flexible(), spacing: 4),
        GridItem(.flexible(), spacing: 4),
    ]
    var body: some View {
        LazyVGrid(columns: columns, spacing: 4) {
            ForEach(0..<min(state.tile2Ids.count, 6), id: \.self) { index in
                let deepLink = index < state.tile2DeepLinks.count ? state.tile2DeepLinks[index] : state.tile2RecapDeepLink
                Link(destination: URL(string: deepLink)!) {
                    tile2Cell(index: index)
                }
            }
        }
    }
    private func tile2Cell(index: Int) -> some View {
        if index < state.tile2LocalPaths.count,
           !state.tile2LocalPaths[index].isEmpty,
           let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: APP_GROUP),
           let img = UIImage(contentsOfFile: container.appendingPathComponent(state.tile2LocalPaths[index]).path) {
            return AnyView(
                Image(uiImage: img)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(minWidth: 0, maxWidth: .infinity)
                    .aspectRatio(1, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
            )
        }
        return AnyView(placeholderCell)
    }

    private var placeholderCell: some View {
        RoundedRectangle(cornerRadius: 6)
            .fill(Color.white.opacity(0.08))
            .aspectRatio(1, contentMode: .fit)
            .overlay(Image(systemName: "plus").font(.system(size: 14, weight: .medium)).foregroundColor(.white.opacity(0.4)))
    }
}

struct Tile3View: View {
    let state: DVNTLiveAttributes.ContentState
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(0..<min(state.tile3EventIds.count, 3), id: \.self) { index in
                let deepLink = index < state.tile3DeepLinks.count ? state.tile3DeepLinks[index] : state.tile3SeeAllDeepLink
                Link(destination: URL(string: deepLink)!) {
                    HStack(spacing: 8) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(index < state.tile3Titles.count ? state.tile3Titles[index] : "Event")
                                .font(.system(size: 13, weight: .semibold)).foregroundColor(.white).lineLimit(1)
                            if index < state.tile3StartAts.count {
                                Text(formatShortDate(state.tile3StartAts[index]))
                                    .font(.system(size: 11)).foregroundColor(.white.opacity(0.6))
                            }
                        }
                        Spacer()
                        Image(systemName: "chevron.right").font(.system(size: 10, weight: .semibold)).foregroundColor(.white.opacity(0.3))
                    }
                    .padding(.vertical, 6).padding(.horizontal, 8)
                    .background(Color.white.opacity(0.06))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
            if !state.tile3SeeAllDeepLink.isEmpty {
                Link(destination: URL(string: state.tile3SeeAllDeepLink)!) {
                    Text("See all").font(.system(size: 11, weight: .medium)).foregroundColor(dvntPurple)
                }
            }
        }
    }
    private func formatShortDate(_ iso: String) -> String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: iso) else { return iso }
        let df = DateFormatter()
        df.dateFormat = "EEE, MMM d · h:mm a"
        return df.string(from: date)
    }
}

struct PageDots: View {
    let current: Int; let total: Int
    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<total, id: \.self) { i in
                Circle().fill(i == current ? Color.white : Color.white.opacity(0.3)).frame(width: 5, height: 5)
            }
        }
    }
}

struct WeatherRow: View {
    let icon: String?; let tempF: Int?; let label: String?
    var body: some View {
        if icon != nil || tempF != nil {
            HStack(spacing: 4) {
                Image(systemName: weatherSFSymbol(icon)).font(.system(size: 10)).foregroundColor(dvntCyan)
                if let temp = tempF { Text("\(temp)°").font(.system(size: 11, weight: .medium)).foregroundColor(.white.opacity(0.8)) }
                if let lbl = label { Text(lbl).font(.system(size: 10)).foregroundColor(.white.opacity(0.5)).lineLimit(1) }
            }
        }
    }
}

private let TILE_CONTENT_HEIGHT: CGFloat = 156

struct DVNTLockScreenView: View {
    let context: ActivityViewContext<DVNTLiveAttributes>
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(spacing: 6) {
                logoImage(size: 28)
                WeatherRow(icon: context.state.weatherIcon, tempF: context.state.weatherTempF, label: nil)
            }.frame(width: 32)
            VStack(alignment: .leading, spacing: 6) {
                Group {
                    switch context.state.currentTile {
                    case 0: Link(destination: URL(string: context.state.tile1DeepLink)!) { Tile1View(state: context.state) }
                    case 1: Tile2View(state: context.state)
                    case 2: Tile3View(state: context.state)
                    default: Link(destination: URL(string: context.state.tile1DeepLink)!) { Tile1View(state: context.state) }
                    }
                }
                .frame(minHeight: TILE_CONTENT_HEIGHT, alignment: .topLeading)
                HStack { Spacer(); PageDots(current: context.state.currentTile, total: 3); Spacer() }
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .activityBackgroundTint(.black.opacity(0.85))
    }
}

struct DVNTLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: DVNTLiveAttributes.self) { context in
            DVNTLockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 6) {
                        logoImage(size: 24)
                        if let path = context.state.tile1HeroLocalPath, !path.isEmpty,
                           let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: APP_GROUP),
                           let img = UIImage(contentsOfFile: container.appendingPathComponent(path).path) {
                            Image(uiImage: img)
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: 40, height: 40)
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                        }
                    }
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.state.tile1Title).font(.system(size: 13, weight: .semibold)).foregroundColor(.white).lineLimit(1)
                        if let venue = context.state.tile1VenueName {
                            Text(venue).font(.system(size: 11)).foregroundColor(.white.opacity(0.6)).lineLimit(1)
                        }
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if context.state.tile1IsUpcoming, let cd = countdownString(from: context.state.tile1StartAt) {
                        Text(cd).font(.system(size: 11, weight: .medium)).foregroundColor(dvntPurple)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack(spacing: 6) {
                        WeatherRow(icon: context.state.weatherIcon, tempF: context.state.weatherTempF, label: context.state.weatherLabel)
                        Spacer()
                        PageDots(current: context.state.currentTile, total: 3)
                    }.padding(.top, 4)
                }
            } compactLeading: {
                logoGlyphImage(size: 16)
            } compactTrailing: {
                if context.state.tile1IsUpcoming, let cd = countdownString(from: context.state.tile1StartAt) {
                    Text(cd).font(.system(size: 11, weight: .medium)).foregroundColor(dvntPurple).monospacedDigit()
                } else if let temp = context.state.weatherTempF {
                    Text("\(temp)°").font(.system(size: 11, weight: .medium)).foregroundColor(dvntCyan)
                }
            } minimal: {
                logoGlyphImage(size: 14)
            }
            .widgetURL(URL(string: context.state.tile1DeepLink))
        }
    }
}
