import ActivityKit
import Foundation
import React
import UIKit

private let APP_GROUP = "group.com.dvnt.app"

@objc(DVNTLiveActivity)
@available(iOS 16.2, *)
class DVNTLiveActivityModule: NSObject {

    @objc static func requiresMainQueueSetup() -> Bool { return false }

    @objc func areLiveActivitiesEnabled(_ resolve: @escaping RCTPromiseResolveBlock,
                                         rejecter reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 16.2, *) {
            resolve(ActivityAuthorizationInfo().areActivitiesEnabled)
        } else {
            resolve(false)
        }
    }

    @objc func updateLiveActivity(_ jsonPayload: String) {
        guard #available(iOS 16.2, *) else { return }
        guard let data = jsonPayload.data(using: .utf8),
              let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            print("[DVNTLiveActivity] Failed to parse payload JSON")
            return
        }
        let existingActivities = Activity<DVNTLiveAttributes>.activities
        Task {
            let (tile1HeroPath, tile2LocalPaths) = await downloadAllImagesToAppGroup(payload: payload)
            let state = buildContentState(from: payload, tile1HeroLocalPath: tile1HeroPath, tile2LocalPaths: tile2LocalPaths)
            if let existing = existingActivities.first {
                await existing.update(ActivityContent(state: state, staleDate: Date().addingTimeInterval(3600)))
                print("[DVNTLiveActivity] Updated existing activity")
            } else {
                do {
                    let attributes = DVNTLiveAttributes()
                    let content = ActivityContent(state: state, staleDate: Date().addingTimeInterval(3600))
                    let _ = try Activity<DVNTLiveAttributes>.request(attributes: attributes, content: content, pushType: .token)
                    print("[DVNTLiveActivity] Started new activity")
                } catch {
                    print("[DVNTLiveActivity] Failed to start activity: \(error)")
                }
            }
            persistToUserDefaults(payload: payload, tile1HeroLocalPath: tile1HeroPath, tile2LocalPaths: tile2LocalPaths)
        }
    }

    private func persistToUserDefaults(payload: [String: Any], tile1HeroLocalPath: String?, tile2LocalPaths: [String]) {
        guard let defaults = UserDefaults(suiteName: APP_GROUP) else { return }
        var augmented = payload
        if var tile1 = augmented["tile1"] as? [String: Any] {
            tile1["heroLocalPath"] = tile1HeroLocalPath
            augmented["tile1"] = tile1
        }
        if var tile2 = augmented["tile2"] as? [String: Any] {
            tile2["localPaths"] = tile2LocalPaths
            augmented["tile2"] = tile2
        }
        if let jsonData = try? JSONSerialization.data(withJSONObject: augmented),
           let json = String(data: jsonData, encoding: .utf8) {
            defaults.set(json, forKey: "surfacePayload")
            defaults.synchronize()
        }
    }

    private func downloadAllImagesToAppGroup(payload: [String: Any]) async -> (String?, [String]) {
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: APP_GROUP) else {
            print("[DVNTLiveActivity] App Group container nil — check entitlements")
            return (nil, Array(repeating: "", count: 6))
        }
        let thumbsDir = container.appendingPathComponent("la_thumbs", isDirectory: true)
        try? FileManager.default.createDirectory(at: thumbsDir, withIntermediateDirectories: true)

        // Voltra's <Image source={{ assetName }} /> reads from voltra_images/{key}.
        // Voltra's own preloadImages enforces a 4KB limit that hero images exceed.
        // We bypass that by writing directly to the same directory Voltra reads from.
        let voltraDir = container.appendingPathComponent("voltra_images", isDirectory: true)
        try? FileManager.default.createDirectory(at: voltraDir, withIntermediateDirectories: true)

        var tile1HeroPath: String?
        let tile1 = payload["tile1"] as? [String: Any] ?? [:]
        let heroStr = tile1["heroThumbUrl"] as? String
        if let urlStr = heroStr, !urlStr.isEmpty, let heroUrl = URL(string: urlStr) {
            do {
                let (data, _) = try await URLSession.shared.data(from: heroUrl)
                if UIImage(data: data) != nil {
                    // Save to la_thumbs (legacy native widget path)
                    let fileURL = thumbsDir.appendingPathComponent("hero.png")
                    try data.write(to: fileURL, options: .atomic)
                    tile1HeroPath = "la_thumbs/hero.png"
                    // Save to voltra_images so Voltra's <Image assetName="event-hero-0"> resolves
                    let voltraURL = voltraDir.appendingPathComponent("event-hero-0")
                    try data.write(to: voltraURL, options: .atomic)
                    print("[DVNTLiveActivity] Tile1 hero ok (\(data.count)B)")
                } else {
                    print("[DVNTLiveActivity] Tile1 hero: invalid image data")
                }
            } catch {
                print("[DVNTLiveActivity] Tile1 hero failed: \(error.localizedDescription)")
            }
        } else {
            print("[DVNTLiveActivity] Tile1 hero: no URL (\(heroStr ?? "null"))")
        }

        // Tile3 upcoming events → voltra_images/event-hero-1, event-hero-2
        let tile3 = payload["tile3"] as? [String: Any] ?? [:]
        let tile3Items = tile3["items"] as? [[String: Any]] ?? []
        for (i, item) in tile3Items.prefix(2).enumerated() {
            if let urlStr = item["heroThumbUrl"] as? String, !urlStr.isEmpty, let url = URL(string: urlStr) {
                do {
                    let (data, _) = try await URLSession.shared.data(from: url)
                    if UIImage(data: data) != nil {
                        let voltraURL = voltraDir.appendingPathComponent("event-hero-\(i + 1)")
                        try data.write(to: voltraURL, options: .atomic)
                        print("[DVNTLiveActivity] Tile3[\(i)] hero ok (\(data.count)B)")
                    }
                } catch {
                    print("[DVNTLiveActivity] Tile3[\(i)] hero failed: \(error.localizedDescription)")
                }
            }
        }

        let tile2 = payload["tile2"] as? [String: Any] ?? [:]
        let items = tile2["items"] as? [[String: Any]] ?? []
        var localPaths: [String] = []
        for (i, item) in items.prefix(6).enumerated() {
            guard let urlStr = item["thumbUrl"] as? String, !urlStr.isEmpty,
                  let url = URL(string: urlStr) else {
                localPaths.append("")
                if i == 0 { print("[DVNTLiveActivity] Tile2[\(i)]: no thumbUrl") }
                continue
            }
            do {
                let (data, _) = try await URLSession.shared.data(from: url)
                if UIImage(data: data) != nil {
                    let filename = "t2_\(i).png"
                    let fileURL = thumbsDir.appendingPathComponent(filename)
                    try data.write(to: fileURL, options: .atomic)
                    localPaths.append("la_thumbs/\(filename)")
                } else {
                    localPaths.append("")
                    print("[DVNTLiveActivity] Tile2[\(i)]: invalid image data")
                }
            } catch {
                localPaths.append("")
                print("[DVNTLiveActivity] Tile2[\(i)]: \(error.localizedDescription)")
            }
        }
        while localPaths.count < 6 { localPaths.append("") }
        let okCount = localPaths.filter { !$0.isEmpty }.count
        print("[DVNTLiveActivity] Tile2: \(okCount)/6 downloaded")
        return (tile1HeroPath, Array(localPaths.prefix(6)))
    }

    @objc func endLiveActivity() {
        guard #available(iOS 16.2, *) else { return }
        Task {
            for activity in Activity<DVNTLiveAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            print("[DVNTLiveActivity] Ended all activities")
        }
    }

    private func buildContentState(from payload: [String: Any], tile1HeroLocalPath: String? = nil, tile2LocalPaths: [String] = []) -> DVNTLiveAttributes.ContentState {
        let tile1 = payload["tile1"] as? [String: Any] ?? [:]
        let tile2 = payload["tile2"] as? [String: Any] ?? [:]
        let tile3 = payload["tile3"] as? [String: Any] ?? [:]
        let weather = payload["weather"] as? [String: Any]
        let tile2Items = tile2["items"] as? [[String: Any]] ?? []
        let tile3Items = tile3["items"] as? [[String: Any]] ?? []

        let tileIndex = (payload["currentTile"] as? Int) ?? 0
        return DVNTLiveAttributes.ContentState(
            generatedAt: payload["generatedAt"] as? String ?? "",
            currentTile: max(0, min(tileIndex, 2)),
            tile1EventId: tile1["eventId"] as? String,
            tile1Title: tile1["title"] as? String ?? "DVNT",
            tile1StartAt: tile1["startAt"] as? String,
            tile1VenueName: tile1["venueName"] as? String,
            tile1City: tile1["city"] as? String,
            tile1HeroThumbUrl: tile1["heroThumbUrl"] as? String,
            tile1HeroLocalPath: tile1HeroLocalPath,
            tile1IsUpcoming: tile1["isUpcoming"] as? Bool ?? false,
            tile1DeepLink: tile1["deepLink"] as? String ?? "https://dvntlive.app/events",
            tile2WeekStartISO: tile2["weekStartISO"] as? String ?? "",
            tile2Ids: tile2Items.map { $0["id"] as? String ?? "" },
            tile2ThumbUrls: tile2Items.map { $0["thumbUrl"] as? String ?? "" },
            tile2LocalPaths: tile2LocalPaths,
            tile2DeepLinks: tile2Items.map { $0["deepLink"] as? String ?? "" },
            tile2RecapDeepLink: tile2["recapDeepLink"] as? String ?? "",
            tile3EventIds: tile3Items.map { $0["eventId"] as? String ?? "" },
            tile3Titles: tile3Items.map { $0["title"] as? String ?? "" },
            tile3StartAts: tile3Items.map { $0["startAt"] as? String ?? "" },
            tile3VenueNames: tile3Items.map { $0["venueName"] as? String ?? "" },
            tile3DeepLinks: tile3Items.map { $0["deepLink"] as? String ?? "" },
            tile3SeeAllDeepLink: tile3["seeAllDeepLink"] as? String ?? "",
            weatherIcon: weather?["icon"] as? String,
            weatherTempF: weather?["tempF"] as? Int,
            weatherLabel: weather?["label"] as? String
        )
    }
}
