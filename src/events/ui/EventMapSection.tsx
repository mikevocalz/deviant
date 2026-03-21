/**
 * Event Map Section
 * Shows event location on a map with directions CTA
 * Used in event details screen
 */

import { View, Text, Pressable, Platform } from "react-native";
import { MapPin, Navigation, ExternalLink } from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import { DvntMap } from "@/src/components/map";
import type { NormalizedLocation } from "@/lib/types/location";
import { openDirections, hasValidCoordinates } from "@/lib/utils/location";
import { useCallback, useState } from "react";

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
  const { colors } = useColorScheme();
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

  // No location data at all
  if (!location && !fallbackAddress) {
    return null;
  }

  // Has address but no coordinates - show address card only
  if (!hasCoords) {
    return (
      <View
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: colors.card }}
      >
        <View className="p-4 gap-3">
          <View className="flex-row items-start gap-3">
            <View
              className="w-10 h-10 rounded-xl items-center justify-center"
              style={{ backgroundColor: colors.primary + "15" }}
            >
              <MapPin size={20} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground">
                {displayName}
              </Text>
              {displayAddress ? (
                <Text className="text-sm text-muted-foreground mt-1">
                  {displayAddress}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Full map section with coordinates
  return (
    <View
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: colors.card }}
    >
      {/* Map */}
      <View className="h-48">
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

      {/* Location Info + CTA */}
      <View className="p-4 gap-3">
        <View className="flex-row items-start gap-3">
          <View
            className="w-10 h-10 rounded-xl items-center justify-center"
            style={{ backgroundColor: colors.primary + "15" }}
          >
            <MapPin size={20} color={colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-foreground">
              {displayName}
            </Text>
            {displayAddress ? (
              <Text
                className="text-sm text-muted-foreground mt-1"
                numberOfLines={2}
              >
                {displayAddress}
              </Text>
            ) : null}
            {location?.city && location?.country && (
              <Text className="text-xs text-muted-foreground mt-1">
                {location.city}, {location.country}
              </Text>
            )}
          </View>
        </View>

        {/* Directions Button */}
        <Pressable
          onPress={handleGetDirections}
          disabled={isOpeningDirections}
          className="flex-row items-center justify-center gap-2 py-3 px-4 rounded-xl active:opacity-80"
          style={{ backgroundColor: colors.primary + "15" }}
        >
          {isOpeningDirections ? (
            <View
              className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent"
              style={{ transform: [{ rotate: "0deg" }] }}
            />
          ) : (
            <Navigation size={18} color={colors.primary} />
          )}
          <Text
            className="text-sm font-semibold"
            style={{ color: colors.primary }}
          >
            {isOpeningDirections ? "Opening Maps..." : "Get Directions"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// Loading skeleton
export function EventMapSectionSkeleton() {
  const { colors } = useColorScheme();

  return (
    <View
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: colors.card }}
    >
      {/* Map skeleton */}
      <View className="h-48" style={{ backgroundColor: colors.muted + "30" }} />

      {/* Info skeleton */}
      <View className="p-4 gap-3">
        <View className="flex-row items-start gap-3">
          <View
            className="w-10 h-10 rounded-xl"
            style={{ backgroundColor: colors.muted + "30" }}
          />
          <View className="flex-1 gap-2">
            <View
              className="h-5 rounded w-3/4"
              style={{ backgroundColor: colors.muted + "30" }}
            />
            <View
              className="h-4 rounded w-1/2"
              style={{ backgroundColor: colors.muted + "20" }}
            />
          </View>
        </View>
        <View
          className="h-12 rounded-xl"
          style={{ backgroundColor: colors.muted + "20" }}
        />
      </View>
    </View>
  );
}
