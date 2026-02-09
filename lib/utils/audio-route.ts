/**
 * Audio Route Utility
 *
 * Configures audio session to route audio through the speaker
 * during WebRTC calls. Uses RNCallKeep on iOS since CallKeep owns
 * the audio session via CallKit. On Android, uses InCallManager-style
 * approach via NativeModules.
 */

import { NativeModules, Platform } from "react-native";
import RNCallKeep from "react-native-callkeep";

/**
 * Force audio output to speaker.
 *
 * iOS: CallKeep owns the audio session — use RNCallKeep.toggleAudioRouteSpeaker
 * Android: WebRTC defaults to speakerphone, but we set it explicitly
 *
 * @param callUUID - The active call UUID (required for CallKeep on iOS/Android)
 */
export function enableSpeakerphone(callUUID?: string): void {
  try {
    if (Platform.OS === "ios") {
      // CallKeep manages the CXProvider audio session on iOS
      RNCallKeep.toggleAudioRouteSpeaker(callUUID || "", true);
      console.log("[AudioRoute] Speaker enabled via CallKeep");
    } else {
      // Android: use CallKeep if UUID available, else try WebRTCModule
      if (callUUID) {
        RNCallKeep.toggleAudioRouteSpeaker(callUUID, true);
        console.log("[AudioRoute] Speaker enabled via CallKeep (Android)");
      } else {
        const { WebRTCModule } = NativeModules;
        if (WebRTCModule?.setSpeakerPhone) {
          WebRTCModule.setSpeakerPhone(true);
          console.log(
            "[AudioRoute] Speaker enabled via WebRTCModule (Android)",
          );
        } else {
          console.log(
            "[AudioRoute] Android defaults to speaker — no action needed",
          );
        }
      }
    }
  } catch (e) {
    console.warn("[AudioRoute] enableSpeakerphone failed:", e);
  }
}

/**
 * Reset audio output to earpiece/default.
 *
 * @param callUUID - The active call UUID (required for CallKeep on iOS/Android)
 */
export function disableSpeakerphone(callUUID?: string): void {
  try {
    if (Platform.OS === "ios") {
      RNCallKeep.toggleAudioRouteSpeaker(callUUID || "", false);
      console.log("[AudioRoute] Speaker disabled via CallKeep");
    } else {
      if (callUUID) {
        RNCallKeep.toggleAudioRouteSpeaker(callUUID, false);
        console.log("[AudioRoute] Speaker disabled via CallKeep (Android)");
      } else {
        const { WebRTCModule } = NativeModules;
        if (WebRTCModule?.setSpeakerPhone) {
          WebRTCModule.setSpeakerPhone(false);
          console.log(
            "[AudioRoute] Speaker disabled via WebRTCModule (Android)",
          );
        }
      }
    }
  } catch (e) {
    console.warn("[AudioRoute] disableSpeakerphone failed:", e);
  }
}
