/**
 * Live Surface API Client
 * Fetches the LiveSurfacePayload from the edge function.
 */

import { supabase } from "@/lib/supabase/client";
import { requireBetterAuthToken } from "@/lib/auth/identity";
import { useEventsLocationStore } from "@/lib/stores/events-location-store";
import type { LiveSurfacePayload } from "./types";

interface LiveSurfaceResponse {
  ok: boolean;
  data?: LiveSurfacePayload;
  cached?: boolean;
  error?: string;
}

export async function fetchLiveSurface(): Promise<LiveSurfacePayload> {
  const token = await requireBetterAuthToken();
  const activeCity = useEventsLocationStore.getState().activeCity;
  const body = activeCity
    ? { lat: activeCity.lat, lng: activeCity.lng }
    : undefined;

  const { data, error } = await supabase.functions.invoke<LiveSurfaceResponse>(
    "live-surface",
    {
      body,
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (error) {
    throw new Error(`[LiveSurface] Edge function error: ${error.message}`);
  }

  if (!data?.ok || !data?.data) {
    throw new Error(`[LiveSurface] Bad response: ${data?.error ?? "no data"}`);
  }

  console.log(
    "[LiveSurface] Payload fetched, cached:",
    data.cached,
    "tiles:",
    data.data.tile2.items.length,
  );

  return data.data;
}
