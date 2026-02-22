import SwiftUI
import WidgetKit

private let APP_GROUP = "group.com.dvnt.app"

private extension View {
    @ViewBuilder
    func dvntContainerBackground() -> some View {
        if #available(iOS 17.0, *) {
            self.containerBackground(for: .widget) {
                Color.black.opacity(0.92)
            }
        } else {
            self.background(Color.black.opacity(0.92))
        }
    }
}
private let dvntPurple = Color(red: 0.541, green: 0.251, blue: 0.812)
private let dvntCyan = Color(red: 0.247, green: 0.863, blue: 1.0)

private func weatherSFSymbol(_ icon: String?) -> String {
    switch icon {
    case "sun": return "sun.max.fill"
    case "cloud": return "cloud.fill"
    case "rain": return "cloud.rain.fill"
    case "snow": return "snowflake"
    case "storm": return "cloud.bolt.fill"
    default: return "cloud.fill"
    }
}

private func logoImage(size: CGFloat) -> some View {
    if UIImage(named: "dvnt_logo", in: .main, with: nil) != nil {
        return AnyView(Image("dvnt_logo", bundle: .main).resizable().aspectRatio(contentMode: .fit).frame(width: size, height: size).clipShape(RoundedRectangle(cornerRadius: max(2, size * 0.22))))
    }
    return AnyView(Image(systemName: "sparkles.circle.fill").resizable().aspectRatio(contentMode: .fit).frame(width: size, height: size).foregroundColor(dvntPurple))
}

private extension WidgetConfiguration {
    func dvntContentMarginsDisabled() -> some WidgetConfiguration {
        if #available(iOSApplicationExtension 17.0, *) {
            return self.contentMarginsDisabled()
        } else {
            return self
        }
    }
}

struct DVNTHomeWidget: Widget {
    let kind: String = "DVNTHomeWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DVNTHomeProvider()) { entry in
            DVNTHomeWidgetView(entry: entry)
                .dvntContainerBackground()
        }
        .configurationDisplayName("DVNT")
        .description("Events, moments, and weather")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .dvntContentMarginsDisabled()
    }
}

struct DVNTHomeProvider: TimelineProvider {
    private static let previewEntry = DVNTHomeEntry(date: Date(), payload: SurfacePayload.preview())

    func placeholder(in context: Context) -> DVNTHomeEntry {
        Self.previewEntry
    }

    func getSnapshot(in context: Context, completion: @escaping (DVNTHomeEntry) -> Void) {
        if context.isPreview {
            completion(Self.previewEntry)
            return
        }
        let payload = loadPayload()
        let entry = DVNTHomeEntry(date: Date(), payload: payload ?? SurfacePayload.preview())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DVNTHomeEntry>) -> Void) {
        let payload = loadPayload()
        let entry = DVNTHomeEntry(date: Date(), payload: payload ?? SurfacePayload.preview())
        let policy: TimelineReloadPolicy = .after(Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date())
        completion(Timeline(entries: [entry], policy: policy))
    }

    private func loadPayload() -> SurfacePayload? {
        guard let defaults = UserDefaults(suiteName: APP_GROUP),
              let json = defaults.string(forKey: "surfacePayload"),
              let data = json.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return SurfacePayload(from: obj)
    }
}

struct SurfacePayload {
    let tile1: Tile1Data?
    let tile2: Tile2Data?
    let weather: WeatherData?
    let tile1HeroLocalPath: String?
    let tile2LocalPaths: [String]

    static func preview() -> SurfacePayload {
        let tile1 = Tile1Data(
            title: "Summer Block Party",
            startAt: "2026-03-15T20:00:00Z",
            venueName: "The Venue",
            city: "Brooklyn",
            isUpcoming: true,
            deepLink: "https://dvntlive.app/events"
        )
        let tile2 = Tile2Data(
            items: (0..<6).map { i in Tile2Item(id: "p\(i)", deepLink: "https://dvntlive.app") },
            recapDeepLink: "https://dvntlive.app"
        )
        let weather = WeatherData(icon: "sun", tempF: 72, label: "Sunny")
        return SurfacePayload(
            tile1: tile1,
            tile2: tile2,
            weather: weather,
            tile1HeroLocalPath: nil,
            tile2LocalPaths: []
        )
    }

    struct Tile1Data {
        let title: String
        let startAt: String?
        let venueName: String?
        let city: String?
        let isUpcoming: Bool
        let deepLink: String
    }
    struct Tile2Data {
        let items: [Tile2Item]
        let recapDeepLink: String
    }
    struct Tile2Item {
        let id: String
        let deepLink: String
    }
    struct WeatherData {
        let icon: String?
        let tempF: Int?
        let label: String?
    }

    init(tile1: Tile1Data?, tile2: Tile2Data?, weather: WeatherData?, tile1HeroLocalPath: String?, tile2LocalPaths: [String]) {
        self.tile1 = tile1
        self.tile2 = tile2
        self.weather = weather
        self.tile1HeroLocalPath = tile1HeroLocalPath
        self.tile2LocalPaths = tile2LocalPaths
    }

    init?(from obj: [String: Any]) {
        let tile1Obj = obj["tile1"] as? [String: Any]
        tile1 = tile1Obj.map { t in
            Tile1Data(
                title: t["title"] as? String ?? "DVNT",
                startAt: t["startAt"] as? String,
                venueName: t["venueName"] as? String,
                city: t["city"] as? String,
                isUpcoming: t["isUpcoming"] as? Bool ?? false,
                deepLink: t["deepLink"] as? String ?? "https://dvntlive.app/events"
            )
        }
        tile1HeroLocalPath = tile1Obj?["heroLocalPath"] as? String
        let tile2Obj = obj["tile2"] as? [String: Any]
        let localPaths = tile2Obj?["localPaths"] as? [String] ?? []
        tile2LocalPaths = localPaths
        let itemsArr = (tile2Obj?["items"] as? [[String: Any]]) ?? []
        tile2 = Tile2Data(
            items: itemsArr.prefix(6).map { i in
                Tile2Item(id: i["id"] as? String ?? "", deepLink: i["deepLink"] as? String ?? "https://dvntlive.app")
            },
            recapDeepLink: tile2Obj?["recapDeepLink"] as? String ?? "https://dvntlive.app"
        )
        let w = obj["weather"] as? [String: Any]
        weather = w.map { WeatherData(icon: $0["icon"] as? String, tempF: $0["tempF"] as? Int, label: $0["label"] as? String) }
    }
}

struct DVNTHomeEntry: TimelineEntry {
    let date: Date
    let payload: SurfacePayload?
}

private func countdownString(from isoDate: String?) -> String? {
    guard let dateStr = isoDate, let date = ISO8601DateFormatter().date(from: dateStr) else { return nil }
    let diff = date.timeIntervalSinceNow
    guard diff > 0 else { return nil }
    let h = Int(diff) / 3600
    let m = (Int(diff) % 3600) / 60
    if h > 0 { return "in \(h)h \(m)m" }
    return "in \(m)m"
}

private func formatTime(_ iso: String) -> String {
    guard let d = ISO8601DateFormatter().date(from: iso) else { return iso }
    let f = DateFormatter()
    f.dateFormat = "EEE, MMM d · h:mm a"
    return f.string(from: d)
}

struct DVNTHomeWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: DVNTHomeEntry

    var body: some View {
        let p = entry.payload
        switch family {
        case .systemSmall:
            SmallWidgetView(payload: p)
        case .systemMedium:
            MediumWidgetView(payload: p)
        case .systemLarge:
            LargeWidgetView(payload: p)
        default:
            SmallWidgetView(payload: p)
        }
    }
}

struct SmallWidgetView: View {
    let payload: SurfacePayload?

    var body: some View {
        let linkURL = URL(string: payload?.tile1?.deepLink ?? "https://dvntlive.app/events")!
        Link(destination: linkURL) {
            HStack(alignment: .top, spacing: 8) {
                VStack(alignment: .leading, spacing: 4) {
                    logoImage(size: 24)
                    if let w = payload?.weather {
                        HStack(spacing: 2) {
                            Image(systemName: weatherSFSymbol(w.icon)).font(.system(size: 10)).foregroundColor(dvntCyan)
                            if let t = w.tempF { Text("\(t)°").font(.system(size: 11, weight: .medium)).foregroundColor(.white.opacity(0.9)) }
                        }
                    }
                    Spacer(minLength: 0)
                }
                .frame(width: 36, alignment: .leading)
                VStack(alignment: .leading, spacing: 4) {
                    if let t1 = payload?.tile1 {
                        Text(t1.title)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.white)
                            .lineLimit(2)
                        if t1.isUpcoming, let cd = countdownString(from: t1.startAt) {
                            Text(cd).font(.system(size: 11, weight: .medium)).foregroundColor(dvntPurple)
                        }
                        if let v = t1.venueName {
                            Text(v).font(.system(size: 10)).foregroundColor(.white.opacity(0.6)).lineLimit(1)
                        }
                    } else {
                        Text("No upcoming events")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.white)
                        Text("Create one")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(dvntPurple)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(12)
        }
    }
}

struct MediumWidgetView: View {
    let payload: SurfacePayload?

    var body: some View {
        Link(destination: URL(string: payload?.tile1?.deepLink ?? "https://dvntlive.app/events")!) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    logoImage(size: 28)
                    if let w = payload?.weather {
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 4) {
                                Image(systemName: weatherSFSymbol(w.icon)).font(.system(size: 12)).foregroundColor(dvntCyan)
                                if let t = w.tempF { Text("\(t)°").font(.system(size: 14, weight: .semibold)).foregroundColor(.white) }
                            }
                            if let l = w.label { Text(l).font(.system(size: 10)).foregroundColor(.white.opacity(0.6)) }
                        }
                    }
                    Spacer(minLength: 0)
                }
                .frame(width: 44, alignment: .leading)
                VStack(alignment: .leading, spacing: 6) {
                    if let t1 = payload?.tile1 {
                        Text(t1.isUpcoming ? "UP NEXT" : "RECENT")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(dvntPurple)
                        Text(t1.title)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(.white)
                            .lineLimit(2)
                        if t1.isUpcoming, let cd = countdownString(from: t1.startAt) {
                            Text(cd).font(.system(size: 12, weight: .medium)).foregroundColor(dvntPurple)
                        }
                        if let s = t1.startAt { Text(formatTime(s)).font(.system(size: 11)).foregroundColor(.white.opacity(0.6)) }
                        if let v = t1.venueName, let c = t1.city {
                            Text("\(v) · \(c)").font(.system(size: 11)).foregroundColor(.white.opacity(0.5)).lineLimit(1)
                        }
                    } else {
                        Text("No upcoming events")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(.white)
                        Text("Create one")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(dvntPurple)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(14)
        }
    }
}

struct LargeWidgetView: View {
    let payload: SurfacePayload?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Link(destination: URL(string: payload?.tile1?.deepLink ?? "https://dvntlive.app/events")!) {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 8) {
                        logoImage(size: 32)
                        if let w = payload?.weather {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: 4) {
                                    Image(systemName: weatherSFSymbol(w.icon)).font(.system(size: 14)).foregroundColor(dvntCyan)
                                    if let t = w.tempF { Text("\(t)°").font(.system(size: 16, weight: .semibold)).foregroundColor(.white) }
                                }
                                if let l = w.label { Text(l).font(.system(size: 11)).foregroundColor(.white.opacity(0.6)) }
                            }
                        }
                        Spacer(minLength: 0)
                    }
                    .frame(width: 48, alignment: .leading)
                    VStack(alignment: .leading, spacing: 8) {
                        if let t1 = payload?.tile1 {
                            Text(t1.isUpcoming ? "UP NEXT" : "RECENT")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(dvntPurple)
                            Text(t1.title)
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundColor(.white)
                                .lineLimit(2)
                            if t1.isUpcoming, let cd = countdownString(from: t1.startAt) {
                                Text(cd).font(.system(size: 13, weight: .medium)).foregroundColor(dvntPurple)
                            }
                            if let s = t1.startAt { Text(formatTime(s)).font(.system(size: 12)).foregroundColor(.white.opacity(0.6)) }
                            if let v = t1.venueName, let c = t1.city {
                                Text("\(v) · \(c)").font(.system(size: 12)).foregroundColor(.white.opacity(0.5)).lineLimit(1)
                            }
                        } else {
                            Text("No upcoming events")
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundColor(.white)
                            Text("Create one")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundColor(dvntPurple)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(16)
            }
            if let p = payload, let t2 = p.tile2 {
                Divider().background(Color.white.opacity(0.2)).padding(.horizontal, 16)
                let cols = 3
                let recapLink = t2.recapDeepLink
                VStack(spacing: 6) {
                    ForEach(0..<2, id: \.self) { row in
                        HStack(spacing: 6) {
                            ForEach(0..<cols, id: \.self) { col in
                                let i = row * cols + col
                                let item = i < t2.items.count ? t2.items[i] : nil
                                let path = i < p.tile2LocalPaths.count && !p.tile2LocalPaths[i].isEmpty ? p.tile2LocalPaths[i] : nil
                                Link(destination: URL(string: item?.deepLink ?? recapLink)!) {
                                    momentCell(path: path, containerPath: APP_GROUP)
                                }
                            }
                        }
                    }
                }
                .padding(12)
            }
        }
    }

    private func momentCell(path: String?, containerPath: String) -> some View {
        Group {
            if let p = path, let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: containerPath),
               let img = UIImage(contentsOfFile: container.appendingPathComponent(p).path) {
                Image(uiImage: img)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } else {
                RoundedRectangle(cornerRadius: 6)
                    .fill(Color.white.opacity(0.08))
                    .overlay(Image(systemName: "photo").font(.system(size: 14)).foregroundColor(.white.opacity(0.4)))
            }
        }
        .frame(maxWidth: .infinity)
        .aspectRatio(1, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}
