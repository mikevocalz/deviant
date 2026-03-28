/**
 * EventsMapView — MapLibre + MapTiler map of events with markers.
 * Uses DvntMap which wraps @maplibre/maplibre-react-native on native
 * and provides a graceful web fallback.
 */

import { useMemo, useCallback } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { useColorScheme } from "@/lib/hooks";
import { MapPin } from "lucide-react-native";
import { DvntMap } from "@/src/components/map";
import type { DvntMapMarker } from "@/src/components/map";
import type { Event } from "@/lib/hooks/use-events";

interface EventsMapViewProps {
  events: Event[];
}

export function EventsMapView({ events }: EventsMapViewProps) {
  const router = useRouter();
  const { colors } = useColorScheme();

  // Filter events with valid coordinates
  const mappableEvents = useMemo(
    () => events.filter((e) => e.locationLat != null && e.locationLng != null),
    [events],
  );

  // No events with coordinates
  if (mappableEvents.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8 gap-3">
        <MapPin size={48} color={colors.mutedForeground} />
        <Text className="text-lg font-semibold text-muted-foreground text-center">
          No Locations
        </Text>
        <Text className="text-sm text-muted-foreground text-center">
          None of the current events have location coordinates for the map.
        </Text>
      </View>
    );
  }

  // Compute center from event coordinates
  const center = useMemo<[number, number]>(() => {
    const lngs = mappableEvents.map((e) => e.locationLng!);
    const lats = mappableEvents.map((e) => e.locationLat!);
    return [
      lngs.reduce((a, b) => a + b, 0) / lngs.length,
      lats.reduce((a, b) => a + b, 0) / lats.length,
    ];
  }, [mappableEvents]);

  // Convert events to DvntMap markers (memoized)
  const markers = useMemo<DvntMapMarker[]>(
    () =>
      mappableEvents.map((event) => ({
        id: event.id,
        coordinate: [event.locationLng!, event.locationLat!],
        title: event.title,
        subtitle: `${event.date} • ${event.location}`,
        icon: "event" as const,
      })),
    [mappableEvents],
  );

  // Stable callback — navigate to event detail on marker press
  const handleMarkerPress = useCallback(
    (id: string) => {
      router.push(`/(protected)/events/${id}` as any);
    },
    [router],
  );

  return (
    <DvntMap
      center={center}
      zoom={12}
      markers={markers}
      onMarkerPress={handleMarkerPress}
      showUserLocation
      showControls
    />
  );
}
