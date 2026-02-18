/**
 * DvntMap — Production MapLibre + MapTiler map component (iOS/Android)
 *
 * Renders a MapLibre GL map with MapTiler tiles. Supports markers,
 * user location, and camera control. Gracefully falls back if
 * the native module is unavailable or the API key is missing.
 */

import React, { useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Locate, ZoomIn, ZoomOut, MapPin } from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import { getMaptilerStyleUrl, isMapsEnabled } from "./maptiler";

// Lazy-load MapLibre to avoid crashes if native module isn't linked
let MapLibreGL: typeof import("@maplibre/maplibre-react-native") | null = null;
try {
  MapLibreGL = require("@maplibre/maplibre-react-native");
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

// ---------- GeoJSON helpers ----------

function markersToGeoJSON(markers: DvntMapMarker[]) {
  return {
    type: "FeatureCollection" as const,
    features: markers.map((m) => ({
      type: "Feature" as const,
      id: m.id,
      properties: {
        id: m.id,
        title: m.title || "",
        subtitle: m.subtitle || "",
        icon: m.icon || "pin",
      },
      geometry: {
        type: "Point" as const,
        coordinates: m.coordinate,
      },
    })),
  };
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

// ---------- Main Component ----------

function DvntMapInner({
  center = [-73.9857, 40.7484], // NYC default
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
  const cameraRef = useRef<any>(null);
  const mapRef = useRef<any>(null);

  // Memoize style URL (stable across renders)
  const styleUrl = useMemo(() => getMaptilerStyleUrl(), []);

  // Memoize GeoJSON to avoid re-creating on every render
  const geojson = useMemo(() => markersToGeoJSON(markers), [markers]);

  // Stable callback for marker press
  const handleShapePress = useCallback(
    (e: any) => {
      const feature = e?.features?.[0];
      const markerId = feature?.properties?.id || feature?.id;
      if (markerId && onMarkerPress) {
        onMarkerPress(String(markerId));
      }
    },
    [onMarkerPress],
  );

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    cameraRef.current?.zoomTo?.((zoom || 12) + 1, 300);
  }, [zoom]);

  const handleZoomOut = useCallback(() => {
    cameraRef.current?.zoomTo?.((zoom || 12) - 1, 300);
  }, [zoom]);

  const handleRecenter = useCallback(() => {
    cameraRef.current?.setCamera?.({
      centerCoordinate: center,
      zoomLevel: zoom,
      animationDuration: 500,
    });
  }, [center, zoom]);

  // Bail out if no native module or no style URL
  if (!MapLibreGL) {
    return (
      <MapUnavailable reason="MapLibre native module is not linked. Use a development build (not Expo Go)." />
    );
  }

  if (!styleUrl) {
    return (
      <MapUnavailable reason="MapTiler API key is not configured. Add EXPO_PUBLIC_MAPTILER_KEY to your .env file." />
    );
  }

  const MLMapView = MapLibreGL.MapView;
  const MLCamera = MapLibreGL.Camera;
  const MLShapeSource = MapLibreGL.ShapeSource;
  const MLCircleLayer = MapLibreGL.CircleLayer;
  const MLSymbolLayer = MapLibreGL.SymbolLayer;
  const MLUserLocation = MapLibreGL.UserLocation;

  return (
    <View className={`flex-1 ${className || ""}`}>
      <MLMapView
        ref={mapRef}
        style={{ flex: 1 }}
        mapStyle={styleUrl}
        logoEnabled={false}
        attributionEnabled={false}
        onDidFinishLoadingMap={onMapReady}
      >
        <MLCamera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: center,
            zoomLevel: zoom,
            pitch,
            heading: bearing,
          }}
          animationDuration={0}
        />

        {showUserLocation && <MLUserLocation visible animated />}

        {markers.length > 0 && (
          <MLShapeSource
            id="dvnt-markers"
            shape={geojson as any}
            onPress={handleShapePress}
            hitbox={{ width: 44, height: 44 }}
          >
            <MLCircleLayer
              id="dvnt-marker-circles"
              style={{
                circleRadius: 8,
                circleColor: colors.primary,
                circleStrokeWidth: 2,
                circleStrokeColor: "#ffffff",
              }}
            />
          </MLShapeSource>
        )}
      </MLMapView>

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
          <Pressable
            onPress={handleZoomIn}
            className="w-10 h-10 rounded-full bg-card border border-border items-center justify-center"
            style={{
              elevation: 4,
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            <ZoomIn size={18} color={colors.foreground} />
          </Pressable>
          <Pressable
            onPress={handleZoomOut}
            className="w-10 h-10 rounded-full bg-card border border-border items-center justify-center"
            style={{
              elevation: 4,
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            <ZoomOut size={18} color={colors.foreground} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

export const DvntMap = React.memo(DvntMapInner);
