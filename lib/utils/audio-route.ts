/**
 * Audio Route Utility
 *
 * Configures iOS audio session to route audio through the speaker
 * during WebRTC calls. Without this, iOS defaults to earpiece mode.
 */

import { NativeModules, Platform } from "react-native";

/**
 * Force audio output to speaker on iOS.
 * On Android, WebRTC already defaults to speakerphone.
 */
export function enableSpeakerphone(): void {
  if (Platform.OS !== "ios") return;

  try {
    const { WebRTCModule } = NativeModules;
    if (WebRTCModule?.setSpeakerPhone) {
      WebRTCModule.setSpeakerPhone(true);
      console.log("[AudioRoute] Speaker enabled via WebRTCModule");
      return;
    }
  } catch (e) {
    console.warn("[AudioRoute] WebRTCModule.setSpeakerPhone failed:", e);
  }

  // Fallback: use AVAudioSession via RNCallKeep or direct native module
  try {
    const { AVAudioSession } = NativeModules;
    if (AVAudioSession?.overrideOutputAudioPort) {
      AVAudioSession.overrideOutputAudioPort("speaker");
      console.log("[AudioRoute] Speaker enabled via AVAudioSession");
      return;
    }
  } catch (e) {
    console.warn("[AudioRoute] AVAudioSession fallback failed:", e);
  }

  console.warn("[AudioRoute] No native method available to enable speaker");
}

/**
 * Reset audio output to default (earpiece for calls).
 */
export function disableSpeakerphone(): void {
  if (Platform.OS !== "ios") return;

  try {
    const { WebRTCModule } = NativeModules;
    if (WebRTCModule?.setSpeakerPhone) {
      WebRTCModule.setSpeakerPhone(false);
      console.log("[AudioRoute] Speaker disabled");
    }
  } catch (e) {
    console.warn("[AudioRoute] Failed to disable speaker:", e);
  }
}
