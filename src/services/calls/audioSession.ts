/**
 * audioSession.ts — Single source of truth for in-call audio session + routing.
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  This is the ONLY module that may:                                 ║
 * ║    - Start/stop in-call audio mode                                 ║
 * ║    - Set speaker on/off                                            ║
 * ║    - Set mic mute on/off                                           ║
 * ║    - Signal RTCAudioSession activation/deactivation                ║
 * ║                                                                    ║
 * ║  Uses react-native-incall-manager for cross-platform audio         ║
 * ║  session management. RTCAudioSession from Fishjam is used ONLY     ║
 * ║  for CallKit activation/deactivation signals on iOS.               ║
 * ║                                                                    ║
 * ║  INVARIANT: No other file may call InCallManager directly.         ║
 * ║  INVARIANT: No other file may call RTCAudioSession directly.       ║
 * ║                                                                    ║
 * ║  iOS AUDIO SESSION LIFECYCLE (CRITICAL FIX):                       ║
 * ║    1. start() → InCallManager.start() configures AVAudioSession    ║
 * ║       category/mode but does NOT call audioSessionDidActivate().   ║
 * ║    2. CallKit fires didActivateAudioSession → coordinator calls    ║
 * ║       audioSession.activateFromCallKit() which calls               ║
 * ║       RTCAudioSession.audioSessionDidActivate() + applies speaker. ║
 * ║    3. activateFromCallKit() ALSO calls pendingMicStartCallback     ║
 * ║       which actually starts the microphone AFTER session is live.  ║
 * ║    4. Only AFTER step 3 is audio actually flowing on iOS.          ║
 * ║                                                                    ║
 * ║  On Android, start() handles everything (no CallKit).              ║
 * ║                                                                    ║
 * ║  REF: https://docs.fishjam.io/how-to/react-native/connecting      ║
 * ║  REF: https://docs.fishjam.io/how-to/react-native/start-streaming ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import { Platform } from "react-native";
import InCallManager from "react-native-incall-manager";
import { RTCAudioSession } from "@fishjam-cloud/react-native-webrtc";
import { CT } from "@/src/services/calls/callTrace";

// ── Internal state ──────────────────────────────────────────────────

let _isActive = false;
let _isCallKitActivated = false;
let _isSpeakerOn = false;
let _isMicMuted = false;
let _pendingSpeakerOn: boolean | null = null;

// CRITICAL FIX: Callback to start mic AFTER CallKit activation on iOS
let _pendingMicStartCallback: (() => Promise<void>) | null = null;

// ── Public API ──────────────────────────────────────────────────────

export const audioSession = {
  /**
   * Start in-call audio session. Call when entering CONNECTING or IN_CALL.
   *
   * iOS: Configures AVAudioSession category/mode via InCallManager.
   *      Does NOT call RTCAudioSession.audioSessionDidActivate() — that
   *      MUST come from the CallKeep didActivateAudioSession handler via
   *      activateFromCallKit(). Speaker routing is deferred until activation.
   *      MIC START is also deferred via setPendingMicStart().
   *
   * Android: Sets audio mode to IN_COMMUNICATION, acquires audio focus,
   *          and applies speaker routing immediately (no CallKit on Android).
   *
   * @param speakerOn - Whether to default to speaker (true for video calls, false for audio)
   */
  start(
    speakerOn: boolean = true,
    mediaType: "audio" | "video" = "audio",
  ): void {
    CT.trace("AUDIO", "audioSession_starting", {
      speakerOn,
      mediaType,
      wasActive: _isActive,
      platform: Platform.OS,
    });

    try {
      // Reset pending state from any previous call — but do NOT reset
      // _isCallKitActivated here. CallKit fires didActivateAudioSession
      // ONCE per call. If it already fired (e.g., caller: after startOutgoingCall,
      // callee: after answering), resetting it would prevent setPendingMicStart()
      // from detecting that activation already happened → mic never starts.
      // _isCallKitActivated is only reset in stop() at end of call.
      _pendingMicStartCallback = null;
      _pendingSpeakerOn = null;

      // ALWAYS call InCallManager.start — even if _isActive is true.
      // A previous call may not have cleaned up properly.
      //
      // CRITICAL: mediaType controls AVAudioSession mode on iOS:
      //   "audio" → voiceChat (earpiece default)
      //   "video" → videoChat (speaker default, echo cancellation tuned for speaker)
      // Android: AudioManager mode = MODE_IN_COMMUNICATION, requests audio focus
      // REF: https://docs.fishjam.io/how-to/react-native/connecting
      InCallManager.start({ media: mediaType, auto: true });

      _isActive = true;

      if (Platform.OS === "android") {
        // Android: No CallKit, so apply speaker + mic state immediately.
        InCallManager.setForceSpeakerphoneOn(speakerOn);
        _isSpeakerOn = speakerOn;
        InCallManager.setMicrophoneMute(false);
        _isMicMuted = false;
        CT.trace("AUDIO", "audioSession_android_ready", { speakerOn });
      } else {
        // iOS: Defer speaker routing until CallKit activates the audio session.
        // Store the desired speaker state so activateFromCallKit() can apply it.
        _pendingSpeakerOn = speakerOn;
        _isMicMuted = false;
        CT.trace("AUDIO", "audioSession_ios_waiting_for_callkit", {
          pendingSpeaker: speakerOn,
        });
      }

      CT.trace("AUDIO", "audioSession_started", { speakerOn });
      console.log(
        `[AudioSession] Started (speaker=${speakerOn}, platform=${Platform.OS})`,
      );
    } catch (e: any) {
      CT.error("AUDIO", "audioSession_start_failed", { error: e?.message });
      console.error("[AudioSession] Start failed:", e);
    }
  },

  /**
   * CRITICAL FIX (iOS only): Set a callback that will start the microphone
   * AFTER CallKit activates the audio session. This ensures the mic track
   * is created on an ACTIVE audio session, not a dead one.
   *
   * Call this BEFORE start(), pass a callback that calls microphoneHook.startMicrophone().
   * On Android, the callback is invoked immediately (no CallKit).
   *
   * @param callback - Async function that starts the microphone
   */
  setPendingMicStart(callback: () => Promise<void>): void {
    if (Platform.OS === "android") {
      // Android: No CallKit, invoke immediately
      CT.trace("AUDIO", "mic_start_immediate_android");
      callback().catch((e: any) => {
        CT.error("AUDIO", "mic_start_failed_android", { error: e?.message });
      });
    } else if (_isCallKitActivated) {
      // iOS: CallKit ALREADY activated (race condition — callee answered before
      // joinCall() ran). Invoke immediately since the audio session is live.
      CT.trace("AUDIO", "mic_start_immediate_ios_already_activated");
      console.log(
        "[AudioSession] CallKit already activated — starting mic immediately",
      );
      callback().catch((e: any) => {
        CT.error("AUDIO", "mic_start_failed_ios_late", { error: e?.message });
      });
    } else {
      // iOS: Store for deferred execution in activateFromCallKit()
      _pendingMicStartCallback = callback;
      CT.trace("AUDIO", "mic_start_deferred_ios");
    }
  },

  /**
   * Called ONLY from the CallKeep didActivateAudioSession handler.
   * This is when iOS CallKit has actually activated the audio session
   * and WebRTC can start using it.
   *
   * CRITICAL: This is the moment audio starts flowing on iOS.
   * Without this call, the mic track is created on a dead session.
   *
   * CRITICAL FIX: This now ALSO invokes the pending mic start callback.
   */
  activateFromCallKit(): void {
    CT.trace("AUDIO", "activateFromCallKit_called", {
      wasActive: _isActive,
      wasCallKitActivated: _isCallKitActivated,
      pendingSpeaker: _pendingSpeakerOn ?? undefined,
      hasPendingMicStart: !!_pendingMicStartCallback,
    });

    if (Platform.OS !== "ios") {
      CT.warn("AUDIO", "activateFromCallKit_not_ios");
      return;
    }

    try {
      // Signal WebRTC that the audio session is now active
      RTCAudioSession.audioSessionDidActivate();
      _isCallKitActivated = true;

      // Apply deferred speaker routing now that session is active.
      // NOTE: _pendingSpeakerOn is set by start() based on callType:
      //   video → true (speaker default), audio → false (earpiece default)
      // If headphones/Bluetooth are connected, the OS will route to them
      // regardless of this setting — setForceSpeakerphoneOn only affects
      // the built-in speaker vs earpiece choice.
      const speakerOn = _pendingSpeakerOn ?? false;
      InCallManager.setForceSpeakerphoneOn(speakerOn);
      _isSpeakerOn = speakerOn;
      _pendingSpeakerOn = null;

      // Ensure mic is not muted (hardware level)
      InCallManager.setMicrophoneMute(false);
      _isMicMuted = false;

      CT.trace("AUDIO", "activateFromCallKit_done", { speakerOn });
      console.log(
        `[AudioSession] CallKit activated — audio session live (speaker=${speakerOn})`,
      );

      // CRITICAL FIX: NOW start the microphone (audio track is created on ACTIVE session)
      if (_pendingMicStartCallback) {
        const cb = _pendingMicStartCallback;
        _pendingMicStartCallback = null;
        CT.trace("AUDIO", "invoking_pending_mic_start");
        cb().catch((e: any) => {
          CT.error("AUDIO", "pending_mic_start_failed", { error: e?.message });
        });
      }
    } catch (e: any) {
      CT.error("AUDIO", "activateFromCallKit_failed", { error: e?.message });
      console.error("[AudioSession] activateFromCallKit failed:", e);
    }
  },

  /**
   * Stop in-call audio session. Call on ENDING/ENDED.
   */
  stop(): void {
    if (!_isActive) return;

    CT.trace("AUDIO", "audioSession_stopping");

    try {
      InCallManager.stop();

      if (Platform.OS === "ios") {
        RTCAudioSession.audioSessionDidDeactivate();
      }

      _isActive = false;
      _isCallKitActivated = false;
      _isSpeakerOn = false;
      _isMicMuted = false;
      _pendingSpeakerOn = null;
      _pendingMicStartCallback = null;

      CT.trace("AUDIO", "audioSession_stopped");
      console.log("[AudioSession] Stopped");
    } catch (e: any) {
      CT.error("AUDIO", "audioSession_stop_failed", { error: e?.message });
      console.error("[AudioSession] Stop failed:", e);
    }
  },

  /**
   * Set speaker on/off.
   * On iOS, if CallKit hasn't activated yet, stores the value for deferred apply.
   */
  setSpeakerOn(on: boolean): void {
    if (!_isActive) {
      CT.warn("AUDIO", "setSpeakerOn_inactive_attempting", { on });
    }

    // iOS: If CallKit hasn't activated yet, defer
    if (Platform.OS === "ios" && !_isCallKitActivated) {
      _pendingSpeakerOn = on;
      _isSpeakerOn = on; // Update state for UI, actual routing deferred
      CT.trace("SPEAKER", "speaker_deferred_until_callkit", { on });
      console.log(`[AudioSession] Speaker ${on ? "ON" : "OFF"} (deferred)`);
      return;
    }

    try {
      InCallManager.setForceSpeakerphoneOn(on);
      _isSpeakerOn = on;
      CT.trace("SPEAKER", on ? "speaker_enabled" : "speaker_disabled");
      console.log(`[AudioSession] Speaker ${on ? "ON" : "OFF"}`);
    } catch (e: any) {
      CT.error("SPEAKER", "setSpeakerOn_failed", { on, error: e?.message });
      console.error("[AudioSession] setSpeakerOn failed:", e);
    }
  },

  /**
   * Set mic mute on/off. This controls the hardware/OS-level mute.
   * The Fishjam track-level mute (MediaStreamTrack.enabled) is separate
   * and handled by the toggleMute function in use-video-call.ts.
   * Both should be kept in sync.
   */
  setMicMuted(muted: boolean): void {
    if (!_isActive) {
      CT.warn("AUDIO", "setMicMuted_inactive_attempting", { muted });
    }

    try {
      InCallManager.setMicrophoneMute(muted);
      _isMicMuted = muted;
      CT.trace("MUTE", muted ? "mic_muted_hw" : "mic_unmuted_hw");
      console.log(
        `[AudioSession] Mic ${muted ? "MUTED" : "UNMUTED"} (hardware)`,
      );
    } catch (e: any) {
      CT.error("MUTE", "setMicMuted_failed", { muted, error: e?.message });
      console.error("[AudioSession] setMicMuted failed:", e);
    }
  },

  /**
   * Get current state (for DEV HUD / diagnostics).
   */
  getState(): {
    isActive: boolean;
    isCallKitActivated: boolean;
    isSpeakerOn: boolean;
    isMicMuted: boolean;
  } {
    return {
      isActive: _isActive,
      isCallKitActivated: _isCallKitActivated,
      isSpeakerOn: _isSpeakerOn,
      isMicMuted: _isMicMuted,
    };
  },
};
