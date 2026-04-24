/**
 * useSneakyLynkCaptureBroadcast
 *
 * Broadcasts local screenshot events to every other participant in the
 * same Sneaky Lynk room via a Supabase realtime broadcast channel, and
 * records incoming remote events into the capture store so the room
 * banner + per-tile pulse can render.
 *
 * DOES NOT subscribe to the local screenshot listener itself — that
 * responsibility belongs to `useSneakyLynkCaptureProtection` (it already
 * owns the protection + listener pair and accepts an `onScreenshot`
 * callback). Stacking two listeners would fire the broadcast twice.
 *
 * Intended usage (call site):
 *
 *     const broadcast = useSneakyLynkCaptureBroadcast({
 *       roomId, localUserId, localUsername, attributable: !anonymous,
 *     });
 *     useSneakyLynkCaptureProtection(broadcast.notifyLocalScreenshot);
 *
 * Why broadcast (not postgres_changes)?
 *   - Ephemeral: screenshot events don't belong in the DB.
 *   - Zero backend work. postgres_changes would need an edge function
 *     or permissive RLS on video_room_events.
 *   - Lower latency. Broadcast is in-memory on the realtime server.
 *
 * NOT in this hook (honest scope):
 *   - Screen RECORDING detection. expo-screen-capture has no recording
 *     event. iOS needs `UIScreen.main.isCaptured`; Android 14+ has
 *     ScreenCaptureCallback; older Android has nothing. Follow-up
 *     native-build commit.
 */

import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import {
  useSneakyLynkCaptureStore,
  type CaptureEvent,
} from "@/lib/stores/sneaky-lynk-capture-store";

interface Params {
  roomId: string | undefined;
  localUserId: string | undefined;
  localUsername: string | undefined;
  /** Set false for anonymous joiners — we broadcast a generic "Someone"
   *  attribution instead of their handle. */
  attributable?: boolean;
}

interface ReturnShape {
  /** Call this the moment a local screenshot is detected. Drives the
   *  local confirmation toast AND broadcasts to the rest of the room. */
  notifyLocalScreenshot: () => void;
}

const BANNER_DISMISS_MS = 6000;
const TILE_PULSE_MS = 1200;

export function useSneakyLynkCaptureBroadcast({
  roomId,
  localUserId,
  localUsername,
  attributable = true,
}: Params): ReturnShape {
  const recordCapture = useSneakyLynkCaptureStore((s) => s.recordCapture);
  const clearCapture = useSneakyLynkCaptureStore((s) => s.clearCapture);
  const clearPulse = useSneakyLynkCaptureStore((s) => s.clearPulse);
  const reset = useSneakyLynkCaptureStore((s) => s.reset);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const cancelledRef = useRef(false);

  // Stash the latest action refs so notifyLocalScreenshot below never
  // captures stale Zustand setters.
  const actionsRef = useRef({ recordCapture, clearCapture, clearPulse });
  actionsRef.current = { recordCapture, clearCapture, clearPulse };

  useEffect(() => {
    if (!roomId || !localUserId) return;
    cancelledRef.current = false;

    const channel = supabase.channel(`sneaky-capture-${roomId}`, {
      config: { broadcast: { self: false } },
    });

    channel.on("broadcast", { event: "capture" }, (msg) => {
      const payload = msg.payload as {
        kind?: string;
        actorId?: string;
        actorUsername?: string;
        at?: number;
      } | null;
      if (!payload || !payload.actorId) return;
      if (payload.actorId === localUserId) return;

      const kind: CaptureEvent["kind"] =
        payload.kind === "recording_start" ||
        payload.kind === "recording_stop"
          ? payload.kind
          : "screenshot";

      const event: CaptureEvent = {
        kind,
        actorId: payload.actorId,
        actorUsername: payload.actorUsername || "Someone",
        at: typeof payload.at === "number" ? payload.at : Date.now(),
        isSelf: false,
      };
      actionsRef.current.recordCapture(event);

      if (event.kind === "screenshot") {
        setTimeout(() => {
          if (cancelledRef.current) return;
          actionsRef.current.clearCapture();
        }, BANNER_DISMISS_MS);
        setTimeout(() => {
          if (cancelledRef.current) return;
          actionsRef.current.clearPulse(event.actorId);
        }, TILE_PULSE_MS);
      }
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      cancelledRef.current = true;
      try {
        supabase.removeChannel(channel);
      } catch {}
      channelRef.current = null;
      reset();
    };
  }, [roomId, localUserId, reset]);

  const notifyLocalScreenshot = useCallback(() => {
    if (cancelledRef.current) return;
    if (!localUserId) return;

    const event: CaptureEvent = {
      kind: "screenshot",
      actorId: localUserId,
      actorUsername: localUsername || "You",
      at: Date.now(),
      isSelf: true,
    };

    // Render the local "You took a screenshot" confirmation instantly.
    actionsRef.current.recordCapture(event);
    setTimeout(() => {
      if (cancelledRef.current) return;
      actionsRef.current.clearCapture();
    }, BANNER_DISMISS_MS);
    setTimeout(() => {
      if (cancelledRef.current) return;
      actionsRef.current.clearPulse(localUserId);
    }, TILE_PULSE_MS);

    // Fan-out. If the user is anonymous, broadcast a generic attribution
    // so the privacy signal still reaches the room without outing them.
    const broadcastUsername = attributable
      ? localUsername || "Someone"
      : "Someone";
    const channel = channelRef.current;
    if (!channel) return;
    channel
      .send({
        type: "broadcast",
        event: "capture",
        payload: {
          kind: "screenshot",
          actorId: localUserId,
          actorUsername: broadcastUsername,
          at: event.at,
          platform: Platform.OS,
        },
      })
      .catch((err) => {
        if (__DEV__) {
          console.warn("[SneakyLynkCapture] broadcast failed:", err);
        }
      });
  }, [attributable, localUserId, localUsername]);

  return { notifyLocalScreenshot };
}
