/**
 * Client-side API for fetching the Live Surface payload from the Supabase Edge Function.
 */
import { supabase } from "@/lib/supabase/client";

import type { LiveSurfacePayload } from "./types";

const EDGE_FUNCTION_NAME = "live-surface";

/**
 * Fetch the live surface payload for the current user's location.
 * Optionally pass coordinates for weather data; omitting them skips weather.
 */
export async function fetchLiveSurface(opts?: {
  lat?: number;
  lng?: number;
}): Promise<LiveSurfacePayload | null> {
  try {
    const params: Record<string, string> = {};
    if (opts?.lat != null && opts?.lng != null) {
      params.lat = String(opts.lat);
      params.lng = String(opts.lng);
    }

    const { data, error } = await supabase.functions.invoke(
      EDGE_FUNCTION_NAME,
      {
        body: params,
      },
    );

    if (error) {
      console.warn("[LiveSurface] Edge function error:", error.message);
      return null;
    }

    return data as LiveSurfacePayload;
  } catch (e) {
    console.warn("[LiveSurface] fetchLiveSurface failed:", e);
    return null;
  }
}
