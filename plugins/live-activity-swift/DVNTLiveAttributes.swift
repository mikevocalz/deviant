import ActivityKit
import Foundation

struct DVNTLiveAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var generatedAt: String
        var currentTile: Int
        var tile1EventId: String?
        var tile1Title: String
        var tile1StartAt: String?
        var tile1VenueName: String?
        var tile1City: String?
        var tile1HeroThumbUrl: String?
        var tile1IsUpcoming: Bool
        var tile1DeepLink: String
        var tile2WeekStartISO: String
        var tile2Ids: [String]
        var tile2ThumbUrls: [String]
        var tile2DeepLinks: [String]
        var tile2RecapDeepLink: String
        var tile3EventIds: [String]
        var tile3Titles: [String]
        var tile3StartAts: [String]
        var tile3VenueNames: [String]
        var tile3DeepLinks: [String]
        var tile3SeeAllDeepLink: String
        var weatherIcon: String?
        var weatherTempF: Int?
        var weatherLabel: String?
    }
}
