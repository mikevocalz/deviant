/**
 * useCallKeepCoordinator
 *
 * Root-level hook that:
 * 1. Sets up CallKeep on mount
 * 2. Registers CallKeep event listeners ONCE
 * 3. Subscribes to Supabase call_signals and displays native incoming call UI
 * 4. On answer → navigates to call screen, joins Fishjam
 * 5. On end/decline → leaves Fishjam, updates signal status
 *
 * Must be called exactly ONCE from the protected layout.
 */

import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/lib/stores/auth-store";
import { callSignalsApi, type CallSignal } from "@/lib/api/call-signals";
import {
  setupCallKeep,
  registerCallKeepListeners,
  showIncomingCall,
  endCall,
  reportEndCall,
  setCallActive,
  setMuted,
  persistCallMapping,
  getSessionIdFromUUID,
  clearCallMapping,
  backToForeground,
} from "./callkeep";
import { useVideoRoomStore } from "@/src/video/stores/video-room-store";
import { RTCAudioSession } from "@fishjam-cloud/react-native-webrtc";
import {
  callTrace,
  callTraceError,
  setCallDebugContext,
  clearCallDebugContext,
} from "./call-debug";

// Track active signal so we can update its status on answer/decline
const _activeSignals = new Map<string, CallSignal>();

export function useCallKeepCoordinator(): void {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Use refs to avoid re-registering listeners on every render
  const routerRef = useRef(router);
  routerRef.current = router;

  const userRef = useRef(user);
  userRef.current = user;

  // Track if we've initialized to prevent double-init in strict mode
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    let cleanupListeners: (() => void) | undefined;
    let unsubscribeSignals: (() => void) | undefined;

    const init = async () => {
      // 1. Setup CallKeep
      try {
        await setupCallKeep();
      } catch (err) {
        console.error("[CallKeepCoordinator] Setup failed:", err);
        // Don't block — CallKeep may not be available in dev/simulator
        return;
      }

      // 2. Register CallKeep event listeners
      cleanupListeners = registerCallKeepListeners({
        onAnswer: ({ callUUID }) => {
          callTrace("CALLKEEP", "answerPressed", callUUID, { callUUID });

          // Look up the session ID from the mapping
          const callSessionId = getSessionIdFromUUID(callUUID);
          const signal = _activeSignals.get(callUUID);

          if (signal) {
            // Update signal status to accepted
            callSignalsApi
              .updateSignalStatus(signal.id, "accepted")
              .catch((err) =>
                callTraceError("CALLKEEP", "updateSignalFailed", String(err), {
                  callUUID,
                }),
              );
          }

          // Mark call active in OS
          setCallActive(callUUID);

          // Bring app to foreground (Android)
          backToForeground();

          // Navigate to call screen — callee joins Fishjam ONLY after this navigation
          // REF: Mandatory principle #3 — MUST NOT join Fishjam until AFTER CallKeep answer
          const roomId = signal?.room_id || callSessionId;
          const callType = signal?.call_type || "video";

          if (roomId) {
            setCallDebugContext({
              sessionId: roomId,
              callUUID,
              userId: userRef.current?.id,
            });
            callTrace(
              "LIFECYCLE",
              "navigatingToCallScreen",
              `roomId=${roomId} callType=${callType}`,
              { callUUID },
            );
            routerRef.current.push({
              pathname: "/(protected)/call/[roomId]",
              params: { roomId, callType },
            });
          } else {
            callTraceError("CALLKEEP", "noRoomIdForUUID", callUUID, {
              callUUID,
            });
            endCall(callUUID);
          }
        },

        onEnd: ({ callUUID }) => {
          callTrace("CALLKEEP", "endPressed", callUUID, { callUUID });

          const signal = _activeSignals.get(callUUID);

          if (signal) {
            // Determine if this was a decline (still ringing) or end (already accepted)
            const status = signal.status === "ringing" ? "declined" : "ended";
            callTrace(
              "SESSION",
              "statusChanged",
              `${signal.status} → ${status}`,
              { callUUID },
            );
            callSignalsApi
              .updateSignalStatus(signal.id, status)
              .catch((err) =>
                callTraceError("CALLKEEP", "updateSignalFailed", String(err), {
                  callUUID,
                }),
              );
            // Also end all ringing signals for this room (so caller sees decline)
            callSignalsApi.endCallSignals(signal.room_id).catch(() => {});
          }

          // If there's an active Fishjam call, trigger leave
          // The use-video-call.ts external end effect will handle Fishjam cleanup
          const store = useVideoRoomStore.getState();
          if (store.callPhase !== "idle" && store.callPhase !== "call_ended") {
            callTrace(
              "LIFECYCLE",
              "externalEnd",
              `phase=${store.callPhase} → call_ended`,
              { callUUID },
            );
            store.setCallPhase("call_ended");
          }

          // Cleanup
          _activeSignals.delete(callUUID);
          clearCallMapping(callUUID);
          clearCallDebugContext();
        },

        onDidDisplayIncoming: ({ callUUID, error }) => {
          if (error) {
            callTraceError("CALLKEEP", "displayIncomingFailed", error, {
              callUUID,
            });
            _activeSignals.delete(callUUID);
            clearCallMapping(callUUID);
          } else {
            callTrace("CALLKEEP", "displayedIncoming", callUUID, { callUUID });
          }
        },

        onToggleMute: ({ callUUID, muted }) => {
          callTrace("AUDIO", "muteToggled", `muted=${muted}`, { callUUID });
          const store = useVideoRoomStore.getState();
          store.setMicOn(!muted);
          setMuted(callUUID, muted);
        },

        onAudioSessionActivated: () => {
          callTrace("AUDIO", "audioSessionActivated", "notifying WebRTC");
          RTCAudioSession.audioSessionDidActivate();
        },
      });

      // 3. Subscribe to incoming call signals from Supabase
      const userId = user.id;
      callTrace("CALL", "subscribingToSignals", `userId=${userId}`);
      unsubscribeSignals = callSignalsApi.subscribeToIncomingCalls(
        userId,
        (signal: CallSignal) => {
          callTrace(
            "CALL",
            "incomingDetected",
            `from=${signal.caller_username} room=${signal.room_id} type=${signal.call_type}`,
          );

          // Generate a callUUID from the signal's room_id
          // Use room_id as the UUID since it's unique per call session
          const callUUID = signal.room_id;

          // Persist the mapping
          persistCallMapping(signal.room_id, callUUID);

          // Store the signal for later reference
          _activeSignals.set(callUUID, signal);

          // Display native incoming call UI
          // REF: Mandatory principle #3 — MUST NOT join Fishjam here, only show UI
          showIncomingCall({
            callUUID,
            handle: signal.caller_username || "Unknown",
            displayName: signal.caller_username || "Unknown Caller",
            hasVideo: signal.call_type === "video",
          });
          callTrace(
            "CALLKEEP",
            "displayedIncoming",
            `uuid=${callUUID} video=${signal.call_type === "video"}`,
            { callUUID },
          );
        },
      );
    };

    init();

    return () => {
      initializedRef.current = false;
      cleanupListeners?.();
      unsubscribeSignals?.();
      _activeSignals.clear();
    };
  }, [isAuthenticated, user?.id]);
}
