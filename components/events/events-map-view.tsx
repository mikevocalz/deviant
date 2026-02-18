/**
 * EventsMapView — Apple Maps / Google Maps view of events with markers.
 * Uses expo-maps which requires a dev build (not Expo Go).
 */

import { View, Text, Pressable, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useColorScheme } from "@/lib/hooks";
import { MapPin } from "lucide-react-native";
import type { Event } from "@/lib/hooks/use-events";

// Conditionally import expo-maps (requires dev build)
let AppleMaps: any = null;
let GoogleMaps: any = null;
try {
  const expoMaps = require("expo-maps");
  AppleMaps = expoMaps.AppleMaps;
  GoogleMaps = expoMaps.GoogleMaps;
} catch {
  // expo-maps not available
}

interface EventsMapViewProps {
  events: Event[];
}

export function EventsMapView({ events }: EventsMapViewProps) {
  const router = useRouter();
  const { colors } = useColorScheme();

  // Filter events with valid coordinates
  const mappableEvents = events.filter(
    (e) => e.locationLat != null && e.locationLng != null,
  );

  // No maps available (Expo Go)
  if (!AppleMaps && !GoogleMaps) {
    return (
      <View className="flex-1 items-center justify-center px-8 gap-3">
        <MapPin size={48} color={colors.mutedForeground} />
        <Text className="text-lg font-semibold text-muted-foreground text-center">
          Map View Unavailable
        </Text>
        <Text className="text-sm text-muted-foreground text-center">
          Map view requires a development build. It&apos;s not available in Expo
          Go.
        </Text>
      </View>
    );
  }

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

  // Compute initial region from event coordinates
  const lats = mappableEvents.map((e) => e.locationLat!);
  const lngs = mappableEvents.map((e) => e.locationLng!);
  const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
  const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
  const latDelta =
    Math.max(...lats) - Math.min(...lats) + 0.02;
  const lngDelta =
    Math.max(...lngs) - Math.min(...lngs) + 0.02;

  const MapComponent =
    Platform.OS === "ios" ? AppleMaps : GoogleMaps || AppleMaps;

  if (!MapComponent) return null;

  const markers = mappableEvents.map((event) => ({
    id: event.id,
    latitude: event.locationLat!,
    longitude: event.locationLng!,
    title: event.title,
    snippet: `${event.date} • ${event.location}`,
  }));

  return (
    <View className="flex-1">
      <MapComponent
        style={{ flex: 1 }}
        cameraPosition={{
          coordinates: {
            latitude: centerLat,
            longitude: centerLng,
          },
          zoom: 12,
        }}
        markers={markers.map((m) => ({
          id: m.id,
          coordinates: {
            latitude: m.latitude,
            longitude: m.longitude,
          },
          title: m.title,
          snippet: m.snippet,
        }))}
        onMarkerClick={(e: any) => {
          const markerId = e?.id || e?.nativeEvent?.id;
          if (markerId) {
            router.push(`/(protected)/events/${markerId}` as any);
          }
        }}
        properties={{
          isMyLocationEnabled: true,
          selectionEnabled: true,
        }}
      />
    </View>
  );
}
