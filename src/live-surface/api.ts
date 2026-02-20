/**
 * Live Surface API Client
 * Fetches the LiveSurfacePayload from the edge function.
 */

import { supabase } from "@/lib/supabase/client";
import { requireBetterAuthToken } from "@/lib/auth/identity";
import type { LiveSurfacePayload } from "./types";

interface LiveSurfaceResponse {
  ok: boolean;
  data?: LiveSurfacePayload;
  cached?: boolean;
  error?: string;
}

export async function fetchLiveSurface(): Promise<LiveSurfacePayload | null> {
  try {
    const token = await requireBetterAuthToken();

    const { data, error } =
      await supabase.functions.invoke<LiveSurfaceResponse>("live-surface", {
        headers: { Authorization: `Bearer ${token}` },
      });

    if (error) {
      console.error("[LiveSurface] Edge function error:", error.message);
      return null;
    }

    if (!data?.ok || !data?.data) {
      console.error("[LiveSurface] Bad response:", data?.error);
      return null;
    }

    console.log(
      "[LiveSurface] Payload fetched, cached:",
      data.cached,
      "tiles:",
      data.data.tile2.items.length,
    );

    return data.data;
  } catch (err) {
    console.error("[LiveSurface] fetchLiveSurface error:", err);
    return null;
  }
}
