/**
 * CallControls — Floating bottom control bar for in-call and pre-call states.
 *
 * Renders role-correct controls based on CallUiMode:
 * - CALLER_DIALING / CALLER_RINGING: Cancel + optional Flip Camera
 * - RECEIVER_CONNECTING: Cancel only
 * - IN_CALL_VIDEO: Mute, Speaker, Video, Flip, End
 * - IN_CALL_AUDIO: Mute, Speaker, Escalate-to-Video, End
 */

import { useCallback, useRef, useState, useEffect } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  SwitchCamera,
  Volume2,
  VolumeX,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import type { CallUiMode } from "../deriveCallUiMode";

export interface CallControlsProps {
  mode: CallUiMode;
  isMuted: boolean;
  isSpeakerOn: boolean;
  isVideoOff: boolean;
  isAudioMode: boolean;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onToggleVideo: () => void;
  onSwitchCamera: () => void;
  onEndCall: () => void;
  onEscalateToVideo: () => void;
}

export function CallControls({
  mode,
  isMuted,
  isSpeakerOn,
  isVideoOff,
  isAudioMode,
  onToggleMute,
  onToggleSpeaker,
  onToggleVideo,
  onSwitchCamera,
  onEndCall,
  onEscalateToVideo,
}: CallControlsProps) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide controls after 4s in IN_CALL modes, show on tap
  const isInCall = mode === "IN_CALL_VIDEO" || mode === "IN_CALL_AUDIO";

  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (isInCall && mode === "IN_CALL_VIDEO") {
      hideTimerRef.current = setTimeout(() => setVisible(false), 4000);
    }
  }, [isInCall, mode]);

  useEffect(() => {
    setVisible(true);
    resetHideTimer();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [mode, resetHideTimer]);

  const handleTap = useCallback(() => {
    if (!visible) {
      setVisible(true);
      resetHideTimer();
    }
  }, [visible, resetHideTimer]);

  const wrap = useCallback(
    (fn: () => void) => () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      fn();
      resetHideTimer();
    },
    [resetHideTimer],
  );

  const wrapEnd = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onEndCall();
  }, [onEndCall]);

  // Pre-connect: always visible, no auto-hide
  if (
    mode === "CALLER_DIALING" ||
    mode === "CALLER_RINGING" ||
    mode === "RECEIVER_CONNECTING"
  ) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.row}>
          {(mode === "CALLER_DIALING" || mode === "CALLER_RINGING") &&
            !isAudioMode && (
              <Pressable
                style={[styles.btn, styles.btnSecondary]}
                onPress={wrap(onSwitchCamera)}
              >
                <SwitchCamera size={24} color="#fff" />
              </Pressable>
            )}
          <Pressable style={[styles.btn, styles.btnEnd]} onPress={wrapEnd}>
            <PhoneOff size={28} color="#fff" />
          </Pressable>
        </View>
      </View>
    );
  }

  // In-call controls
  if (!visible && mode === "IN_CALL_VIDEO") {
    // Invisible tap target to bring controls back
    return (
      <Pressable
        style={[styles.container, { paddingBottom: insets.bottom + 20 }]}
        onPress={handleTap}
      />
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.row}>
        {/* Mute */}
        <Pressable
          style={[styles.btn, isMuted ? styles.btnDanger : styles.btnSecondary]}
          onPress={wrap(onToggleMute)}
        >
          {isMuted ? (
            <MicOff size={24} color="#fff" />
          ) : (
            <Mic size={24} color="#fff" />
          )}
        </Pressable>

        {/* Speaker */}
        <Pressable
          style={[
            styles.btn,
            isSpeakerOn ? styles.btnActive : styles.btnDim,
          ]}
          onPress={wrap(onToggleSpeaker)}
        >
          {isSpeakerOn ? (
            <Volume2 size={24} color="#fff" />
          ) : (
            <VolumeX size={24} color="rgba(255,255,255,0.5)" />
          )}
        </Pressable>

        {isAudioMode ? (
          // Escalate to video
          <Pressable
            style={[styles.btn, styles.btnDim]}
            onPress={wrap(onEscalateToVideo)}
          >
            <Video size={24} color="rgba(255,255,255,0.5)" />
          </Pressable>
        ) : (
          <>
            {/* Video toggle */}
            <Pressable
              style={[styles.btn, styles.btnSecondary]}
              onPress={wrap(onToggleVideo)}
            >
              {isVideoOff ? (
                <VideoOff size={24} color="rgba(255,255,255,0.5)" />
              ) : (
                <Video size={24} color="#fff" />
              )}
            </Pressable>

            {/* Flip camera */}
            {!isVideoOff && (
              <Pressable
                style={[styles.btn, styles.btnSecondary]}
                onPress={wrap(onSwitchCamera)}
              >
                <SwitchCamera size={24} color="#fff" />
              </Pressable>
            )}
          </>
        )}

        {/* End call */}
        <Pressable style={[styles.btn, styles.btnEnd]} onPress={wrapEnd}>
          <PhoneOff size={28} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 40,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  btn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondary: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  btnActive: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  btnDim: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  btnDanger: {
    backgroundColor: "#FF3B30",
  },
  btnEnd: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#FF3B30",
  },
});
