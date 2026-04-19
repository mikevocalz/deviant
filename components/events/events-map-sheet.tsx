/**
 * EventsMapSheet
 *
 * P0-2: Detached Gorhom BottomSheetModal that presents the events map.
 * Replaces the previous full-screen map swap.
 *
 * Content rules:
 * - Shows events in the user's current state and nearby states (geographic
 *   proximity: within ±8 latitude/longitude degrees of activeCity — roughly
 *   covers adjacent states in the US).
 * - When the user has no activeCity, falls back to all mappable events.
 * - Tapping a marker routes to /events/[id] detail and dismisses the sheet.
 *
 * Implementation notes:
 * - `detached` mode floats the sheet with margins so it visually separates
 *   from the Events screen underneath.
 * - `snapPoints: ["60%", "92%"]` lets users expand to near-full-screen.
 * - Re-uses EventsMapView for marker rendering and navigation.
 */

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { View, Text, Pressable } from "react-native";
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { GlassSheetBackground } from "@/components/sheets/glass-sheet-background";
import { MapPin, X } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useColorScheme } from "@/lib/hooks";
import { useEventsLocationStore } from "@/lib/stores/events-location-store";
import { EventsMapView } from "@/components/events/events-map-view";
import type { Event } from "@/lib/hooks/use-events";
import { geocodeAddress } from "@/lib/utils/geocode";

interface EventsMapSheetProps {
  visible: boolean;
  onDismiss: () => void;
  events: Event[];
}

// Geographic bounding box (degrees) for "user state + nearby states".
// ~8° latitude ≈ 550 miles; enough to cover any US state and at least its
// immediate neighbors. Kept intentionally coarse — users expect to see a
// continuous regional map, not a pin-prick of their city.
const NEARBY_DEGREES = 8;

export const EventsMapSheet: React.FC<EventsMapSheetProps> = ({
  visible,
  onDismiss,
  events,
}) => {
  const sheetRef = useRef<BottomSheetModal>(null);
  // Guard against double-dismiss: X button + BottomSheet onChange(-1) can both
  // fire before the parent re-renders, causing toggleMapView to flip back to true.
  const dismissingRef = useRef(false);
  const { colors } = useColorScheme();
  const router = useRouter();

  const safeDismiss = useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    onDismiss();
    // Reset after next event loop tick so re-open works on a fresh press
    setTimeout(() => { dismissingRef.current = false; }, 500);
  }, [onDismiss]);

  const activeCity = useEventsLocationStore((s) => s.activeCity);
  const deviceLat = useEventsLocationStore((s) => s.deviceLat);
  const deviceLng = useEventsLocationStore((s) => s.deviceLng);

  const geocodedEventCoords = useEventsLocationStore((s) => s.geocodedEventCoords);
  const setGeocodedEventCoord = useEventsLocationStore((s) => s.setGeocodedEventCoord);

  useEffect(() => {
    if (!visible) return;
    const missing = events.filter(
      (e) =>
        (e.locationLat == null || e.locationLng == null) &&
        !geocodedEventCoords[e.id] &&
        (e.locationAddress || e.locationName || e.location),
    );
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const ev of missing) {
        if (cancelled) break;
        const addr = ev.locationAddress || ev.locationName || ev.location || "";
        const coords = await geocodeAddress(addr);
        if (coords && !cancelled) setGeocodedEventCoord(ev.id, coords);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, events, geocodedEventCoords, setGeocodedEventCoord]);

  // Prefer device coords if available (more accurate than city centroid),
  // fall back to activeCity coords for state-level filtering.
  const userLat =
    typeof deviceLat === "number"
      ? deviceLat
      : typeof activeCity?.lat === "number"
        ? activeCity.lat
        : null;
  const userLng =
    typeof deviceLng === "number"
      ? deviceLng
      : typeof activeCity?.lng === "number"
        ? activeCity.lng
        : null;

  const scopedEvents = useMemo(() => {
    // Merge geocoded fallback coords into events that were missing lat/lng
    const withCoords = events.map((e) => {
      if (e.locationLat != null && e.locationLng != null) return e;
      const gc = geocodedEventCoords[e.id];
      if (gc) return { ...e, locationLat: gc.lat, locationLng: gc.lng };
      return e;
    });

    const mappable = withCoords.filter(
      (e) => e.locationLat != null && e.locationLng != null,
    );

    if (userLat == null || userLng == null) return mappable;

    return mappable.filter((e) => {
      const dLat = Math.abs((e.locationLat as number) - userLat);
      const dLng = Math.abs((e.locationLng as number) - userLng);
      return dLat <= NEARBY_DEGREES && dLng <= NEARBY_DEGREES;
    });
  }, [events, userLat, userLng, geocodedEventCoords]);

  // Gorhom snap points — start at 60% so user can still see screen underneath;
  // allow expand to 92% for a near-full-screen view.
  const snapPoints = useMemo(() => ["60%", "92%"], []);

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) safeDismiss();
    },
    [safeDismiss],
  );

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  const headerLabel = useMemo(() => {
    if (activeCity?.state) {
      return `Near ${activeCity.name}, ${activeCity.state}`;
    }
    if (activeCity?.name) return `Near ${activeCity.name}`;
    return "Nearby Events";
  }, [activeCity]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      index={0}
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      backgroundComponent={GlassSheetBackground}
      handleIndicatorStyle={{ backgroundColor: colors.mutedForeground }}
      // ── Detached mode ────────────────────────────────────────────────
      // Floats the sheet with margins so it visually separates from the
      // Events screen underneath. This is the "detached sheet" shape
      // requested in P0-2.
      detached
      bottomInset={46}
      style={{ marginHorizontal: 12 }}
      enablePanDownToClose
    >
      <BottomSheetView style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingTop: 4,
            paddingBottom: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MapPin size={16} color={colors.primary} />
            <Text
              style={{
                color: colors.foreground,
                fontSize: 15,
                fontWeight: "700",
              }}
              numberOfLines={1}
            >
              {headerLabel}
            </Text>
            <Text
              style={{
                color: colors.mutedForeground,
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              {scopedEvents.length}
            </Text>
          </View>
          <Pressable
            onPress={safeDismiss}
            hitSlop={12}
            accessibilityLabel="Close map"
            style={{
              width: 32,
              height: 32,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.08)",
            }}
          >
            <X size={16} color={colors.foreground} />
          </Pressable>
        </View>
        <View
          style={{
            flex: 1,
            borderRadius: 20,
            overflow: "hidden",
            marginHorizontal: 12,
            marginBottom: 12,
          }}
        >
          <EventsMapView
            events={scopedEvents}
            onMarkerPress={(id) => {
              safeDismiss();
              router.push(`/(protected)/events/${id}` as any);
            }}
          />
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
};
