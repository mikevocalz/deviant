import ActivityKit
import Foundation
import React

@objc(DVNTLiveActivity)
class DVNTLiveActivityModule: NSObject {

    @objc static func requiresMainQueueSetup() -> Bool { return false }

    @objc func areLiveActivitiesEnabled(_ resolve: @escaping RCTPromiseResolveBlock,
                                         rejecter reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 16.1, *) {
            resolve(ActivityAuthorizationInfo().areActivitiesEnabled)
        } else {
            resolve(false)
        }
    }

    @objc func updateLiveActivity(_ jsonPayload: String) {
        guard #available(iOS 16.1, *) else { return }
        guard let data = jsonPayload.data(using: .utf8),
              let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            print("[DVNTLiveActivity] Failed to parse payload JSON")
            return
        }
        let state = buildContentState(from: payload)
        let existingActivities = Activity<DVNTLiveAttributes>.activities
        if let existing = existingActivities.first {
            Task {
                await existing.update(ActivityContent(state: state, staleDate: Date().addingTimeInterval(3600)))
                print("[DVNTLiveActivity] Updated existing activity")
            }
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
    }

    @objc func endLiveActivity() {
        guard #available(iOS 16.1, *) else { return }
        Task {
            for activity in Activity<DVNTLiveAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            print("[DVNTLiveActivity] Ended all activities")
        }
    }

    private func buildContentState(from payload: [String: Any]) -> DVNTLiveAttributes.ContentState {
        let tile1 = payload["tile1"] as? [String: Any] ?? [:]
        let tile2 = payload["tile2"] as? [String: Any] ?? [:]
        let tile3 = payload["tile3"] as? [String: Any] ?? [:]
        let weather = payload["weather"] as? [String: Any]
        let tile2Items = tile2["items"] as? [[String: Any]] ?? []
        let tile3Items = tile3["items"] as? [[String: Any]] ?? []

        return DVNTLiveAttributes.ContentState(
            generatedAt: payload["generatedAt"] as? String ?? "",
            currentTile: 0,
            tile1EventId: tile1["eventId"] as? String,
            tile1Title: tile1["title"] as? String ?? "DVNT",
            tile1StartAt: tile1["startAt"] as? String,
            tile1VenueName: tile1["venueName"] as? String,
            tile1City: tile1["city"] as? String,
            tile1HeroThumbUrl: tile1["heroThumbUrl"] as? String,
            tile1IsUpcoming: tile1["isUpcoming"] as? Bool ?? false,
            tile1DeepLink: tile1["deepLink"] as? String ?? "https://dvntlive.app/events",
            tile2WeekStartISO: tile2["weekStartISO"] as? String ?? "",
            tile2Ids: tile2Items.map { $0["id"] as? String ?? "" },
            tile2ThumbUrls: tile2Items.map { $0["thumbUrl"] as? String ?? "" },
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
