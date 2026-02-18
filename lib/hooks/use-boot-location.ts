import { useEffect, useRef } from "react";
import * as Location from "expo-location";
import { useEventsLocationStore } from "@/lib/stores/events-location-store";
import { useQueryClient } from "@tanstack/react-query";
import { cityKeys } from "@/lib/hooks/use-cities";
import { citiesApi } from "@/lib/api/cities";
import type { City } from "@/lib/stores/events-location-store";

/**
 * useBootLocation — runs ONCE on app boot inside ProtectedLayout.
 *
 * If location permission is already granted AND no activeCity is persisted,
 * silently fetches device coords, finds the nearest city, and sets it.
 * Never prompts the user — only uses already-granted permission.
 */
export function useBootLocation() {
  const didRun = useRef(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const activeCity = useEventsLocationStore.getState().activeCity;
    // Already have a city persisted — nothing to do
    if (activeCity) {
      console.log("[BootLocation] City already persisted:", activeCity.name);
      return;
    }

    (async () => {
      try {
        // Check permission WITHOUT prompting
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") {
          console.log("[BootLocation] No location permission yet — skipping");
          return;
        }

        console.log("[BootLocation] Permission granted — fetching coords");
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const { setDeviceLocation, setLocationMode, setActiveCity } =
          useEventsLocationStore.getState();
        setDeviceLocation(loc.coords.latitude, loc.coords.longitude);
        setLocationMode("device");

        // Get cities (from cache or fetch)
        let cities: City[] =
          queryClient.getQueryData<City[]>(cityKeys.list()) ?? [];
        if (cities.length === 0) {
          cities = await queryClient.fetchQuery({
            queryKey: cityKeys.list(),
            queryFn: () => citiesApi.getCities(),
            staleTime: 24 * 60 * 60 * 1000,
          });
        }

        if (cities.length === 0) return;

        // Find nearest city
        let nearest: City | null = null;
        let minDist = Infinity;
        for (const city of cities) {
          const dist = Math.sqrt(
            Math.pow(city.lat - loc.coords.latitude, 2) +
              Math.pow(city.lng - loc.coords.longitude, 2),
          );
          if (dist < minDist) {
            minDist = dist;
            nearest = city;
          }
        }

        if (nearest) {
          console.log("[BootLocation] Nearest city:", nearest.name);
          setActiveCity(nearest);
        }
      } catch (err) {
        console.warn("[BootLocation] Failed:", err);
      }
    })();
  }, [queryClient]);
}
