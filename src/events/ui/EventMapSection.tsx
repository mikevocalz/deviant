/**
 * Event Map Section
 * Shows event location on a map with a Directions CTA that opens native Maps
 */

import { View, Text, Pressable, ActivityIndicator, Platform } from "react-native";
import { MapPin, Navigation } from "lucide-react-native";
import { DvntMap } from "@/src/components/map";
import type { NormalizedLocation } from "@/lib/types/location";
import { openDirections, hasValidCoordinates } from "@/lib/utils/location";
import { useCallback, useState } from "react";

const ACCENT = "#3EA4E5";
const ACCENT_BG = "rgba(62,164,229,0.12)";
const ACCENT_BORDER = "rgba(62,164,229,0.25)";

interface EventMapSectionProps {
  location: NormalizedLocation | null;
  eventTitle?: string;
  fallbackAddress?: string;
}

export function EventMapSection({
  location,
  eventTitle,
  fallbackAddress,
}: EventMapSectionProps) {
  const [isOpeningDirections, setIsOpeningDirections] = useState(false);

  const hasCoords = hasValidCoordinates(location);
  const displayName = location?.name || eventTitle || "Event Location";
  const displayAddress = location?.formattedAddress || fallbackAddress || "";

  const handleGetDirections = useCallback(async () => {
    if (!location || !hasCoords) return;
    setIsOpeningDirections(true);
    try {
      await openDirections(location, { label: eventTitle });
    } finally {
      setIsOpeningDirections(false);
    }
  }, [location, hasCoords, eventTitle]);

  if (!location && !fallbackAddress) return null;

  // No coords — address-only card
  if (!hasCoords) {
    return (
      <View
        style={{
          backgroundColor: "#111",
          borderRadius: 20,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <View style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: ACCENT_BG,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: ACCENT_BORDER,
              }}
            >
              <MapPin size={20} color={ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>
                {displayName}
              </Text>
              {displayAddress ? (
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 3 }}>
                  {displayAddress}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Full map + directions
  return (
    <View
      style={{
        backgroundColor: "#111",
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      {/* Map */}
      <View style={{ height: 180 }}>
        <DvntMap
          center={[location!.longitude, location!.latitude]}
          zoom={15}
          markers={[
            {
              id: "event-location",
              coordinate: [location!.longitude, location!.latitude],
              title: displayName,
            },
          ]}
          showControls={false}
        />
      </View>

      {/* Location row */}
      <View style={{ padding: 14, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: ACCENT_BG,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: ACCENT_BORDER,
            }}
          >
            <MapPin size={20} color={ACCENT} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>
              {displayName}
            </Text>
            {displayAddress ? (
              <Text
                style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 3 }}
                numberOfLines={2}
              >
                {displayAddress}
              </Text>
            ) : null}
            {location?.city ? (
              <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 2 }}>
                {[location.city, location.country].filter(Boolean).join(", ")}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Directions button */}
        <Pressable
          onPress={handleGetDirections}
          disabled={isOpeningDirections}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            paddingVertical: 13,
            paddingHorizontal: 16,
            borderRadius: 14,
            backgroundColor: isOpeningDirections ? ACCENT_BG : ACCENT,
            opacity: pressed ? 0.85 : 1,
            borderWidth: isOpeningDirections ? 1 : 0,
            borderColor: ACCENT_BORDER,
          })}
        >
          {isOpeningDirections ? (
            <ActivityIndicator size="small" color={ACCENT} />
          ) : (
            <Navigation size={16} color="#fff" />
          )}
          <Text
            style={{
              color: isOpeningDirections ? ACCENT : "#fff",
              fontSize: 14,
              fontWeight: "700",
            }}
          >
            {isOpeningDirections ? "Opening Maps..." : "Directions"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// Loading skeleton
export function EventMapSectionSkeleton() {
  return (
    <View
      style={{
        backgroundColor: "#111",
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <View style={{ height: 180, backgroundColor: "rgba(255,255,255,0.06)" }} />
      <View style={{ padding: 14, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)" }} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ height: 16, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.08)", width: "70%" }} />
            <View style={{ height: 13, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.05)", width: "50%" }} />
          </View>
        </View>
        <View style={{ height: 46, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.06)" }} />
      </View>
    </View>
  );
}
