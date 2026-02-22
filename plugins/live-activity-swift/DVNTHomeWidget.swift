import SwiftUI
import WidgetKit

private let APP_GROUP = "group.com.dvnt.app"

// ── Brand Colors ──
private let dvntPurple = Color(red: 0.541, green: 0.251, blue: 0.812)
private let dvntCyan = Color(red: 0.247, green: 0.863, blue: 1.0)
private let dvntRed = Color(red: 0.988, green: 0.145, blue: 0.227)
private let cardBg = Color(red: 0.11, green: 0.11, blue: 0.12)

// ── Helpers ──
private extension View {
    @ViewBuilder
    func dvntContainerBackground() -> some View {
        if #available(iOS 17.0, *) {
            self.containerBackground(.fill.tertiary, for: .widget)
        } else {
            self.background(Color.black)
        }
    }
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

private func heroImage(localPath: String?, fallbackColor: Color = cardBg) -> some View {
    Group {
        if let p = localPath, !p.isEmpty,
           let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: APP_GROUP),
           let img = UIImage(contentsOfFile: container.appendingPathComponent(p).path) {
            Image(uiImage: img)
                .resizable()
                .aspectRatio(contentMode: .fill)
        } else {
            LinearGradient(
                colors: [dvntPurple.opacity(0.4), cardBg],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }
}

private func countdownString(from isoDate: String?) -> String? {
    guard let dateStr = isoDate, let date = ISO8601DateFormatter().date(from: dateStr) else { return nil }
    let diff = date.timeIntervalSinceNow
    guard diff > 0 else { return nil }
    let h = Int(diff) / 3600
    let m = (Int(diff) % 3600) / 60
    if h > 0 { return "\(h)h \(m)m" }
    return "\(m)m"
}

private func formatTime(_ iso: String) -> String {
    guard let d = ISO8601DateFormatter().date(from: iso) else { return iso }
    let f = DateFormatter()
    f.dateFormat = "EEE, MMM d · h:mm a"
    return f.string(from: d)
}

private func dateParts(from iso: String?) -> (day: String, month: String)? {
    guard let dateStr = iso, let date = ISO8601DateFormatter().date(from: dateStr) else { return nil }
    let dayF = DateFormatter(); dayF.dateFormat = "d"
    let monthF = DateFormatter(); monthF.dateFormat = "MMM"
    return (dayF.string(from: date), monthF.string(from: date).uppercased())
}

// ── Data Model ──
struct SurfacePayload {
    let tile1: Tile1Data?
    let tile2: Tile2Data?
    let weather: WeatherData?
    let tile1HeroLocalPath: String?
    let tile2LocalPaths: [String]
    let tile3Items: [Tile3Item]

    static func preview() -> SurfacePayload {
        let tile1 = Tile1Data(
            title: "Summer Block Party",
            startAt: "2026-03-15T20:00:00Z",
            venueName: "The Venue",
            city: "Brooklyn",
            category: "Music",
            isUpcoming: true,
            deepLink: "https://dvntlive.app/events",
            attendeeCount: 142
        )
        let tile2 = Tile2Data(
            items: (0..<6).map { i in Tile2Item(id: "p\(i)", deepLink: "https://dvntlive.app") },
            recapDeepLink: "https://dvntlive.app"
        )
        let weather = WeatherData(icon: "sun", tempF: 72, label: "Sunny", hiF: 78, loF: 65, precipPct: 10, feelsLikeF: 74)
        let upcoming = [
            Tile3Item(eventId: "2", title: "Rooftop Vibes", startAt: "2026-03-16T21:00:00Z", venueName: "Sky Lounge", deepLink: "https://dvntlive.app/events/2"),
            Tile3Item(eventId: "3", title: "Art After Dark", startAt: "2026-03-18T19:00:00Z", venueName: "Gallery One", deepLink: "https://dvntlive.app/events/3"),
        ]
        return SurfacePayload(tile1: tile1, tile2: tile2, weather: weather, tile1HeroLocalPath: nil, tile2LocalPaths: [], tile3Items: upcoming)
    }

    struct Tile1Data {
        let title: String
        let startAt: String?
        let venueName: String?
        let city: String?
        let category: String?
        let isUpcoming: Bool
        let deepLink: String
        let attendeeCount: Int?
    }
    struct Tile2Data { let items: [Tile2Item]; let recapDeepLink: String }
    struct Tile2Item { let id: String; let deepLink: String }
    struct Tile3Item { let eventId: String; let title: String; let startAt: String; let venueName: String?; let deepLink: String }
    struct WeatherData { let icon: String?; let tempF: Int?; let label: String?; let hiF: Int?; let loF: Int?; let precipPct: Int?; let feelsLikeF: Int? }

    init(tile1: Tile1Data?, tile2: Tile2Data?, weather: WeatherData?, tile1HeroLocalPath: String?, tile2LocalPaths: [String], tile3Items: [Tile3Item] = []) {
        self.tile1 = tile1; self.tile2 = tile2; self.weather = weather
        self.tile1HeroLocalPath = tile1HeroLocalPath; self.tile2LocalPaths = tile2LocalPaths; self.tile3Items = tile3Items
    }

    init?(from obj: [String: Any]) {
        let tile1Obj = obj["tile1"] as? [String: Any]
        tile1 = tile1Obj.map { t in
            Tile1Data(
                title: t["title"] as? String ?? "DVNT",
                startAt: t["startAt"] as? String,
                venueName: t["venueName"] as? String,
                city: t["city"] as? String,
                category: t["category"] as? String,
                isUpcoming: t["isUpcoming"] as? Bool ?? false,
                deepLink: t["deepLink"] as? String ?? "https://dvntlive.app/events",
                attendeeCount: t["attendeeCount"] as? Int
            )
        }
        tile1HeroLocalPath = tile1Obj?["heroLocalPath"] as? String
        let tile2Obj = obj["tile2"] as? [String: Any]
        tile2LocalPaths = tile2Obj?["localPaths"] as? [String] ?? []
        let itemsArr = (tile2Obj?["items"] as? [[String: Any]]) ?? []
        tile2 = Tile2Data(
            items: itemsArr.prefix(6).map { i in Tile2Item(id: i["id"] as? String ?? "", deepLink: i["deepLink"] as? String ?? "https://dvntlive.app") },
            recapDeepLink: tile2Obj?["recapDeepLink"] as? String ?? "https://dvntlive.app"
        )
        let tile3Obj = obj["tile3"] as? [String: Any]
        let tile3Arr = (tile3Obj?["items"] as? [[String: Any]]) ?? []
        tile3Items = tile3Arr.prefix(3).map { i in
            Tile3Item(eventId: i["eventId"] as? String ?? "", title: i["title"] as? String ?? "Event", startAt: i["startAt"] as? String ?? "", venueName: i["venueName"] as? String, deepLink: i["deepLink"] as? String ?? "https://dvntlive.app/events")
        }
        let w = obj["weather"] as? [String: Any]
        weather = w.map { WeatherData(icon: $0["icon"] as? String, tempF: $0["tempF"] as? Int, label: $0["label"] as? String, hiF: $0["hiF"] as? Int, loF: $0["loF"] as? Int, precipPct: $0["precipPct"] as? Int, feelsLikeF: $0["feelsLikeF"] as? Int) }
    }
}

// ── Widget Config ──
struct DVNTHomeWidget: Widget {
    let kind: String = "DVNTHomeWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DVNTHomeProvider()) { entry in
            DVNTHomeWidgetView(entry: entry).dvntContainerBackground()
        }
        .configurationDisplayName("DVNT Events")
        .description("Your next event at a glance")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .dvntContentMarginsDisabled()
    }
}

struct DVNTHomeEntry: TimelineEntry {
    let date: Date
    let payload: SurfacePayload?
}

struct DVNTHomeProvider: TimelineProvider {
    private static let previewEntry = DVNTHomeEntry(date: Date(), payload: SurfacePayload.preview())

    func placeholder(in context: Context) -> DVNTHomeEntry { Self.previewEntry }
    func getSnapshot(in context: Context, completion: @escaping (DVNTHomeEntry) -> Void) { completion(Self.previewEntry) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<DVNTHomeEntry>) -> Void) {
        let payload = loadPayload()
        let entry = DVNTHomeEntry(date: Date(), payload: payload ?? SurfacePayload.preview())
        let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
    private func loadPayload() -> SurfacePayload? {
        guard let defaults = UserDefaults(suiteName: APP_GROUP),
              let json = defaults.string(forKey: "surfacePayload"),
              let data = json.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return SurfacePayload(from: obj)
    }
}

// ── Widget View Router ──
struct DVNTHomeWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: DVNTHomeEntry
    var body: some View {
        switch family {
        case .systemSmall:  SmallEventWidget(payload: entry.payload)
        case .systemMedium: MediumEventWidget(payload: entry.payload)
        case .systemLarge:  LargeEventWidget(payload: entry.payload)
        default:            SmallEventWidget(payload: entry.payload)
        }
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SMALL — Event card: hero image fills background, date badge top-right, details bottom
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
struct SmallEventWidget: View {
    let payload: SurfacePayload?
    var body: some View {
        let t1 = payload?.tile1
        let linkURL = URL(string: t1?.deepLink ?? "https://dvntlive.app/events")!
        Link(destination: linkURL) {
            ZStack {
                // Background hero image
                heroImage(localPath: payload?.tile1HeroLocalPath)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipped()

                // Gradient overlay
                LinearGradient(
                    colors: [.clear, .black.opacity(0.3), .black.opacity(0.85)],
                    startPoint: .top,
                    endPoint: .bottom
                )

                // Content
                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        Spacer()
                        // Date badge (squircle)
                        if let parts = dateParts(from: t1?.startAt) {
                            VStack(spacing: 0) {
                                Text(parts.day)
                                    .font(.system(size: 20, weight: .bold, design: .rounded))
                                    .foregroundColor(.white)
                                Text(parts.month)
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundColor(.white.opacity(0.7))
                            }
                            .frame(width: 42, height: 42)
                            .background(Color.black.opacity(0.6))
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                    }
                    .padding(.top, 10).padding(.trailing, 10)

                    Spacer()

                    // Event details
                    VStack(alignment: .leading, spacing: 3) {
                        if let t = t1 {
                            Text(t.title)
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.white)
                                .lineLimit(2)
                            HStack(spacing: 4) {
                                if t.isUpcoming, let cd = countdownString(from: t.startAt) {
                                    Text(cd)
                                        .font(.system(size: 10, weight: .semibold))
                                        .foregroundColor(dvntPurple)
                                }
                                if let v = t.venueName {
                                    Text(v)
                                        .font(.system(size: 10))
                                        .foregroundColor(.white.opacity(0.7))
                                        .lineLimit(1)
                                }
                            }
                        } else {
                            logoImage(size: 20)
                            Text("No events")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(.white)
                        }
                    }
                    .padding(.horizontal, 12).padding(.bottom, 12)
                }
            }
        }
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MEDIUM — Event card: hero left, details right, weather badge
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
struct MediumEventWidget: View {
    let payload: SurfacePayload?
    var body: some View {
        let t1 = payload?.tile1
        let linkURL = URL(string: t1?.deepLink ?? "https://dvntlive.app/events")!
        Link(destination: linkURL) {
            ZStack {
                Color.black
                HStack(spacing: 0) {
                    // Left: hero image
                    ZStack(alignment: .topLeading) {
                        heroImage(localPath: payload?.tile1HeroLocalPath)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .clipped()
                        // Category pill
                        if let cat = t1?.category, !cat.isEmpty {
                            Text(cat)
                                .font(.system(size: 9, weight: .semibold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 6).padding(.vertical, 3)
                                .background(Color.white.opacity(0.25))
                                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                                .padding(8)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .padding(.leading, 6).padding(.vertical, 6)

                    // Right: event details
                    VStack(alignment: .leading, spacing: 6) {
                        // Logo + weather
                        HStack(spacing: 6) {
                            logoImage(size: 18)
                            Spacer()
                            if let w = payload?.weather, let temp = w.tempF {
                                HStack(spacing: 2) {
                                    Image(systemName: weatherSFSymbol(w.icon))
                                        .font(.system(size: 9))
                                        .foregroundColor(dvntCyan)
                                    Text("\(temp)°")
                                        .font(.system(size: 10, weight: .medium))
                                        .foregroundColor(.white.opacity(0.7))
                                }
                            }
                        }

                        if let t = t1 {
                            // Date badge inline
                            if let parts = dateParts(from: t.startAt) {
                                HStack(spacing: 6) {
                                    VStack(spacing: 0) {
                                        Text(parts.day).font(.system(size: 18, weight: .bold, design: .rounded)).foregroundColor(.white)
                                        Text(parts.month).font(.system(size: 8, weight: .bold)).foregroundColor(.white.opacity(0.6))
                                    }
                                    .frame(width: 36, height: 36)
                                    .background(Color.white.opacity(0.08))
                                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(t.title)
                                            .font(.system(size: 14, weight: .bold))
                                            .foregroundColor(.white)
                                            .lineLimit(2)
                                    }
                                }
                            } else {
                                Text(t.title).font(.system(size: 14, weight: .bold)).foregroundColor(.white).lineLimit(2)
                            }

                            Spacer(minLength: 0)

                            // Countdown + venue
                            VStack(alignment: .leading, spacing: 2) {
                                if t.isUpcoming, let cd = countdownString(from: t.startAt) {
                                    HStack(spacing: 4) {
                                        Image(systemName: "clock.fill").font(.system(size: 8)).foregroundColor(dvntPurple)
                                        Text(cd).font(.system(size: 11, weight: .semibold)).foregroundColor(dvntPurple)
                                    }
                                }
                                if let v = t.venueName {
                                    HStack(spacing: 4) {
                                        Image(systemName: "mappin").font(.system(size: 8)).foregroundColor(.white.opacity(0.5))
                                        Text(v).font(.system(size: 10)).foregroundColor(.white.opacity(0.6)).lineLimit(1)
                                    }
                                }
                                if let count = t.attendeeCount, count > 0 {
                                    HStack(spacing: 4) {
                                        Image(systemName: "person.2.fill").font(.system(size: 8)).foregroundColor(.white.opacity(0.5))
                                        Text("\(count) going").font(.system(size: 10)).foregroundColor(.white.opacity(0.6))
                                    }
                                }
                            }
                        } else {
                            Text("No upcoming events").font(.system(size: 13, weight: .semibold)).foregroundColor(.white)
                            Spacer()
                            Text("Tap to browse").font(.system(size: 11, weight: .medium)).foregroundColor(dvntPurple)
                        }
                    }
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LARGE — Featured event card top + upcoming events list below
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
struct LargeEventWidget: View {
    let payload: SurfacePayload?
    var body: some View {
        let t1 = payload?.tile1
        VStack(spacing: 0) {
            // Top: featured event card (hero image with overlay)
            Link(destination: URL(string: t1?.deepLink ?? "https://dvntlive.app/events")!) {
                ZStack(alignment: .bottom) {
                    heroImage(localPath: payload?.tile1HeroLocalPath)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .clipped()

                    LinearGradient(
                        colors: [.clear, .black.opacity(0.85)],
                        startPoint: .center,
                        endPoint: .bottom
                    )

                    // Date badge top-right
                    VStack {
                        HStack {
                            Spacer()
                            if let parts = dateParts(from: t1?.startAt) {
                                VStack(spacing: 0) {
                                    Text(parts.day).font(.system(size: 22, weight: .bold, design: .rounded)).foregroundColor(.white)
                                    Text(parts.month).font(.system(size: 9, weight: .bold)).foregroundColor(.white.opacity(0.7))
                                }
                                .frame(width: 48, height: 48)
                                .background(Color.black.opacity(0.5))
                                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                .padding(12)
                            }
                        }
                        Spacer()
                    }

                    // Bottom details
                    if let t = t1 {
                        VStack(alignment: .leading, spacing: 4) {
                            if let cat = t.category, !cat.isEmpty {
                                Text(cat)
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 8).padding(.vertical, 3)
                                    .background(Color.white.opacity(0.2))
                                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            }
                            Text(t.title)
                                .font(.system(size: 18, weight: .bold))
                                .foregroundColor(.white)
                                .lineLimit(2)
                            HStack(spacing: 8) {
                                if t.isUpcoming, let cd = countdownString(from: t.startAt) {
                                    HStack(spacing: 3) {
                                        Image(systemName: "clock.fill").font(.system(size: 9)).foregroundColor(dvntPurple)
                                        Text(cd).font(.system(size: 12, weight: .semibold)).foregroundColor(dvntPurple)
                                    }
                                }
                                if let v = t.venueName {
                                    Text(v).font(.system(size: 12)).foregroundColor(.white.opacity(0.7)).lineLimit(1)
                                }
                                if let c = t.city {
                                    Text("· \(c)").font(.system(size: 12)).foregroundColor(.white.opacity(0.5))
                                }
                            }
                        }
                        .padding(.horizontal, 14).padding(.bottom, 12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .frame(height: 200)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .padding(.horizontal, 8).padding(.top, 8)
            }

            // Divider
            Rectangle().fill(Color.white.opacity(0.08)).frame(height: 1).padding(.horizontal, 16).padding(.vertical, 6)

            // Bottom: upcoming events list
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text("COMING UP")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.white.opacity(0.4))
                    Spacer()
                    // Weather
                    if let w = payload?.weather, let temp = w.tempF {
                        HStack(spacing: 3) {
                            Image(systemName: weatherSFSymbol(w.icon)).font(.system(size: 10)).foregroundColor(dvntCyan)
                            Text("\(temp)°").font(.system(size: 11, weight: .medium)).foregroundColor(.white.opacity(0.7))
                        }
                    }
                }
                .padding(.horizontal, 14).padding(.bottom, 6)

                if let items = payload?.tile3Items, !items.isEmpty {
                    ForEach(0..<min(items.count, 3), id: \.self) { idx in
                        let item = items[idx]
                        Link(destination: URL(string: item.deepLink)!) {
                            HStack(spacing: 10) {
                                // Date mini badge
                                if let parts = dateParts(from: item.startAt) {
                                    VStack(spacing: 0) {
                                        Text(parts.day).font(.system(size: 14, weight: .bold, design: .rounded)).foregroundColor(.white)
                                        Text(parts.month).font(.system(size: 7, weight: .bold)).foregroundColor(.white.opacity(0.5))
                                    }
                                    .frame(width: 32, height: 32)
                                    .background(Color.white.opacity(0.08))
                                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                                }
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.title)
                                        .font(.system(size: 13, weight: .semibold))
                                        .foregroundColor(.white)
                                        .lineLimit(1)
                                    if let v = item.venueName {
                                        Text(v).font(.system(size: 10)).foregroundColor(.white.opacity(0.5)).lineLimit(1)
                                    }
                                }
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundColor(.white.opacity(0.25))
                            }
                            .padding(.horizontal, 14).padding(.vertical, 5)
                        }
                    }
                } else {
                    Text("No more events this week")
                        .font(.system(size: 12))
                        .foregroundColor(.white.opacity(0.4))
                        .padding(.horizontal, 14)
                }
            }
            Spacer(minLength: 0)
        }
        .background(Color.black)
    }
}
