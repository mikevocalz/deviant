/**
 * audioSession.ts — Single source of truth for in-call audio session + routing.
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  This is the ONLY module that may:                                 ║
 * ║    - Start/stop in-call audio mode                                 ║
 * ║    - Set speaker on/off                                            ║
 * ║    - Set mic mute on/off                                           ║
 * ║                                                                    ║
 * ║  Uses react-native-incall-manager for cross-platform audio         ║
 * ║  session management. RTCAudioSession from Fishjam is used only     ║
 * ║  for CallKit activation/deactivation signals.                      ║
 * ║                                                                    ║
 * ║  INVARIANT: No other file may call InCallManager directly.         ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import { Platform } from "react-native";
import InCallManager from "react-native-incall-manager";
import { RTCAudioSession } from "@fishjam-cloud/react-native-webrtc";
import { CT } from "@/src/services/calls/callTrace";

// ── Internal state ──────────────────────────────────────────────────

let _isActive = false;
let _isSpeakerOn = false;
let _isMicMuted = false;

// ── Public API ──────────────────────────────────────────────────────

export const audioSession = {
  /**
   * Start in-call audio session. Call when entering CONNECTING or IN_CALL.
   *
   * iOS: Sets AVAudioSession to playAndRecord with allowBluetooth + defaultToSpeaker.
   * Android: Sets audio mode to IN_COMMUNICATION and acquires audio focus.
   *
   * @param speakerOn - Whether to default to speaker (true for video calls, false for audio)
   */
  start(speakerOn: boolean = true): void {
    CT.trace("AUDIO", "audioSession_starting", {
      speakerOn,
      wasActive: _isActive,
    });

    try {
      // ALWAYS call InCallManager.start — even if _isActive is true.
      // A previous call may not have cleaned up, or CallKeep may have
      // already activated the audio session. Re-calling is safe and
      // ensures the audio category/mode is correct.
      //
      // iOS: AVAudioSession category = playAndRecord, mode = voiceChat
      //      options = allowBluetooth | defaultToSpeaker (auto=true)
      // Android: AudioManager mode = MODE_IN_COMMUNICATION, requests audio focus
      InCallManager.start({ media: "audio", auto: true });

      // iOS: Notify WebRTC that CallKit has activated the audio session.
      // This MUST happen before setForceSpeakerphoneOn — the audio route
      // can only be changed after the session is active.
      if (Platform.OS === "ios") {
        RTCAudioSession.audioSessionDidActivate();
      }

      // Set speaker state AFTER session activation
      InCallManager.setForceSpeakerphoneOn(speakerOn);
      _isSpeakerOn = speakerOn;

      // Ensure mic is not muted on start
      InCallManager.setMicrophoneMute(false);
      _isMicMuted = false;

      _isActive = true;

      // iOS: CallKit may activate the audio session AFTER our eager call above.
      // Re-apply activation + speaker route after a delay to catch the async case.
      if (Platform.OS === "ios") {
        setTimeout(() => {
          try {
            RTCAudioSession.audioSessionDidActivate();
            InCallManager.setForceSpeakerphoneOn(_isSpeakerOn);
            CT.trace("AUDIO", "audioSession_ios_retry_applied");
          } catch (retryErr) {
            CT.warn("AUDIO", "audioSession_ios_retry_failed");
          }
        }, 500);
      }

      CT.trace("AUDIO", "audioSession_started", { speakerOn });
      console.log(`[AudioSession] Started (speaker=${speakerOn})`);
    } catch (e: any) {
      CT.error("AUDIO", "audioSession_start_failed", { error: e?.message });
      console.error("[AudioSession] Start failed:", e);
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
      _isSpeakerOn = false;
      _isMicMuted = false;

      CT.trace("AUDIO", "audioSession_stopped");
      console.log("[AudioSession] Stopped");
    } catch (e: any) {
      CT.error("AUDIO", "audioSession_stop_failed", { error: e?.message });
      console.error("[AudioSession] Stop failed:", e);
    }
  },

  /**
   * Set speaker on/off. Only effective when session is active.
   */
  setSpeakerOn(on: boolean): void {
    if (!_isActive) {
      CT.warn("AUDIO", "setSpeakerOn_inactive_attempting", { on });
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
  getState(): { isActive: boolean; isSpeakerOn: boolean; isMicMuted: boolean } {
    return {
      isActive: _isActive,
      isSpeakerOn: _isSpeakerOn,
      isMicMuted: _isMicMuted,
    };
  },
};
