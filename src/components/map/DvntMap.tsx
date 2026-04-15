/**
 * DvntMap — Production Expo Maps component (iOS/Android)
 *
 * Renders Google Maps (Android) or Apple Maps (iOS) using expo-maps.
 * Supports markers, user location, and camera control. Gracefully falls
 * back if the native module is unavailable.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Locate, MapPin } from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";

// Lazy-load expo-maps to avoid crashes if native module isn't linked
let GoogleMapsView: any = null;
let AppleMapsView: any = null;
try {
  if (Platform.OS === "android") {
    const { GoogleMaps } = require("expo-maps");
    GoogleMapsView = GoogleMaps.View;
  } else if (Platform.OS === "ios") {
    const { AppleMaps } = require("expo-maps");
    AppleMapsView = AppleMaps.View;
  }
} catch {
  // Not available (Expo Go or web)
}

// ---------- Types ----------

export interface DvntMapMarker {
  id: string;
  coordinate: [number, number]; // [lng, lat]
  title?: string;
  subtitle?: string;
  icon?: "pin" | "event" | "user";
}

export interface DvntMapProps {
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  markers?: DvntMapMarker[];
  onMarkerPress?: (id: string) => void;
  showUserLocation?: boolean;
  pitch?: number;
  bearing?: number;
  className?: string;
  /** Show overlay controls (recenter, zoom) */
  showControls?: boolean;
  /** Called when map finishes loading */
  onMapReady?: () => void;
}

// Convert [lng, lat] to {latitude, longitude}
function toLatLng(coord: [number, number]) {
  return { latitude: coord[1], longitude: coord[0] };
}

// ---------- Marker helpers ----------

function getMarkerColor(icon?: string): string {
  switch (icon) {
    case "event":
      return "#3EA4E5"; // Deviant primary blue
    case "user":
      return "#FF6DC1"; // Deviant accent pink
    default:
      return "#3EA4E5"; // Default to primary blue
  }
}

// ---------- Fallback ----------

function MapUnavailable({ reason }: { reason: string }) {
  const { colors } = useColorScheme();
  return (
    <View className="flex-1 items-center justify-center bg-card rounded-2xl px-6 gap-3">
      <MapPin size={40} color={colors.mutedForeground} />
      <Text className="text-base font-semibold text-muted-foreground text-center">
        Map Unavailable
      </Text>
      <Text className="text-xs text-muted-foreground text-center">
        {reason}
      </Text>
    </View>
  );
}

// ---------- Loading State ----------

function MapLoading() {
  const { colors } = useColorScheme();
  return (
    <View className="flex-1 items-center justify-center bg-card rounded-2xl">
      <ActivityIndicator size="large" color={colors.primary} />
      <Text className="mt-3 text-sm text-muted-foreground">Loading map...</Text>
    </View>
  );
}

// ---------- Main Component ----------

function DvntMapInner({
  center = [-73.9857, 40.7484], // NYC default [lng, lat]
  zoom = 12,
  markers = [],
  onMarkerPress,
  showUserLocation = false,
  pitch = 0,
  bearing = 0,
  className,
  showControls = true,
  onMapReady,
}: DvntMapProps) {
  const { colors } = useColorScheme();
  const mapRef = useRef<any>(null);
  const hasReportedReadyRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);

  const cameraPosition = useMemo(
    () => ({
      coordinates: toLatLng(center),
      zoom: zoom || 15,
    }),
    [center, zoom],
  );

  // Stable callback for marker press
  const handleMarkerPress = useCallback(
    (e: any) => {
      const markerId = e.nativeEvent?.id;
      if (markerId && onMarkerPress) {
        onMarkerPress(String(markerId));
      }
    },
    [onMarkerPress],
  );

  // Recenter map
  const handleRecenter = useCallback(() => {
    mapRef.current?.setCameraPosition?.(
      Platform.OS === "android"
        ? { ...cameraPosition, duration: 350 }
        : cameraPosition,
    );
  }, [cameraPosition]);

  const finishLoading = useCallback(() => {
    setIsLoading(false);
    if (!hasReportedReadyRef.current) {
      hasReportedReadyRef.current = true;
      onMapReady?.();
    }
  }, [onMapReady]);

  const handleMapLoaded = useCallback(() => {
    finishLoading();
  }, [finishLoading]);

  const handleCameraMove = useCallback(() => {
    finishLoading();
  }, [finishLoading]);

  useEffect(() => {
    hasReportedReadyRef.current = false;
    setIsLoading(true);

    const config =
      Platform.OS === "android"
        ? { ...cameraPosition, duration: 0 }
        : cameraPosition;

    mapRef.current?.setCameraPosition?.(config);

    // AppleMaps.View does not expose a "map loaded" callback, so we need a
    // small fallback to avoid a permanent loading state on iOS.
    const timeoutId = setTimeout(
      finishLoading,
      Platform.OS === "ios" ? 700 : 1500,
    );

    return () => clearTimeout(timeoutId);
  }, [cameraPosition, finishLoading]);

  // Bail out if no native module
  const MapView = Platform.OS === "android" ? GoogleMapsView : AppleMapsView;
  if (!MapView) {
    return (
      <MapUnavailable reason="expo-maps native module is not linked. Use a development build (not Expo Go)." />
    );
  }

  return (
    <View className={`flex-1 overflow-hidden ${className || ""}`}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        cameraPosition={cameraPosition}
        markers={markers.map((marker) => ({
          id: marker.id,
          coordinates: toLatLng(marker.coordinate),
          title: marker.title,
          subtitle: marker.subtitle,
          color: getMarkerColor(marker.icon),
        }))}
        onMarkerPress={handleMarkerPress}
        onCameraMove={handleCameraMove}
        {...(Platform.OS === "android" ? { onMapLoaded: handleMapLoaded } : {})}
        uiSettings={{
          myLocationButtonEnabled: false,
          compassEnabled: false,
          scaleControlsEnabled: false,
        }}
        properties={{
          showsUserLocation: showUserLocation,
        }}
      />
      {isLoading && (
        <View
          className="absolute inset-0 items-center justify-center bg-card/80"
          pointerEvents="none"
        >
          <MapLoading />
        </View>
      )}

      {/* Overlay Controls */}
      {showControls && (
        <View
          className="absolute right-3 bottom-6 gap-2"
          pointerEvents="box-none"
        >
          <Pressable
            onPress={handleRecenter}
            className="w-10 h-10 rounded-full bg-card border border-border items-center justify-center"
            style={{
              elevation: 4,
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            <Locate size={18} color={colors.foreground} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

export const DvntMap = React.memo(DvntMapInner);
