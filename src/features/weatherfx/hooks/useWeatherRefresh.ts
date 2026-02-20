/**
 * Weather Refresh Hook
 *
 * Fetches weather from Open-Meteo when Events tab becomes visible,
 * then refreshes periodically. Supports event-time forecast override.
 *
 * Uses TanStack Query for caching (15min staleTime) so re-entering
 * the tab doesn't re-fetch unnecessarily.
 */
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWeatherFXStore } from "../WeatherFXStore";
import {
  fetchCurrentWeather,
  applyWeatherToStore,
} from "../WeatherDecisionEngine";
import { Debouncer } from "@tanstack/react-pacer";

const WEATHER_STALE_TIME = 15 * 60 * 1000; // 15 minutes

/**
 * Call in the Events screen to keep weather data fresh.
 * Requires lat/lng from the events location store.
 */
export function useWeatherRefresh(
  lat: number | undefined,
  lng: number | undefined,
) {
  const weatherAmbianceEnabled = useWeatherFXStore(
    (s) => s.weatherAmbianceEnabled,
  );

  // TanStack Query handles caching + dedup
  const { data } = useQuery({
    queryKey: ["weatherFX", lat, lng],
    queryFn: async () => {
      if (lat == null || lng == null) return null;
      const result = await fetchCurrentWeather(lat, lng);
      return result;
    },
    enabled: lat != null && lng != null && weatherAmbianceEnabled,
    staleTime: WEATHER_STALE_TIME,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Apply to store when data changes (Debouncer prevents rapid re-applies)
  const applyDebouncer = useRef(
    new Debouncer(
      (code: number, metrics: any) => applyWeatherToStore(code, metrics),
      { wait: 200 },
    ),
  );

  useEffect(() => {
    if (data?.code != null && data?.metrics) {
      applyDebouncer.current.maybeExecute(data.code, data.metrics);
    }
  }, [data]);
}
