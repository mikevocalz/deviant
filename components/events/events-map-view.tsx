/**
 * EventsMapView — native maps view of events with markers.
 * Uses DvntMap, which renders expo-maps on native and a web fallback.
 */

import { useMemo, useCallback } from "react";
import { useRouter } from "expo-router";
import { DvntMap } from "@/src/components/map";
import type { DvntMapMarker } from "@/src/components/map";
import type { Event } from "@/lib/hooks/use-events";

interface EventsMapViewProps {
  events: Event[];
  /**
   * Optional override for marker press. When provided, the caller is
   * responsible for navigation — e.g. the EventsMapSheet uses this to
   * dismiss the detached sheet before routing to event detail.
   */
  onMarkerPress?: (id: string) => void;
  /** [lng, lat] to center the map when there are no event markers yet */
  userCenter?: [number, number];
}

export function EventsMapView({ events, onMarkerPress, userCenter }: EventsMapViewProps) {
  const router = useRouter();

  // Filter events with valid coordinates
  const mappableEvents = useMemo(
    () => events.filter((e) => e.locationLat != null && e.locationLng != null),
    [events],
  );

  // Center on event markers if available, otherwise use user location or NYC default
  const center = useMemo<[number, number]>(() => {
    if (mappableEvents.length > 0) {
      const lngs = mappableEvents.map((e) => e.locationLng!);
      const lats = mappableEvents.map((e) => e.locationLat!);
      return [
        lngs.reduce((a, b) => a + b, 0) / lngs.length,
        lats.reduce((a, b) => a + b, 0) / lats.length,
      ];
    }
    return userCenter ?? [-73.9857, 40.7484];
  }, [mappableEvents, userCenter]);

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

  // Stable callback — navigate to event detail on marker press.
  // If a parent passes `onMarkerPress` (e.g. EventsMapSheet), delegate
  // so the parent can dismiss a containing sheet before routing.
  const handleMarkerPress = useCallback(
    (id: string) => {
      if (onMarkerPress) {
        onMarkerPress(id);
        return;
      }
      router.push(`/(protected)/events/${id}` as any);
    },
    [router, onMarkerPress],
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
