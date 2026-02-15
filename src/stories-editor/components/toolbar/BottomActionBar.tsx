// ============================================================
// Instagram Stories Editor - Bottom Action Bar
// ============================================================

import React from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";
import { EDITOR_COLORS } from "../../constants";
import { EditorMode } from "../../types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface BottomBarProps {
  mode: EditorMode;
  onSave: () => void;
  onShare: () => void;
  onPickMedia: () => void;
  hasMedia: boolean;
}

export const BottomActionBar: React.FC<BottomBarProps> = ({
  mode,
  onSave,
  onShare,
  onPickMedia,
  hasMedia,
}) => {
  // Don't show during active editing modes
  if (["text", "drawing", "sticker", "filter", "adjust"].includes(mode)) {
    return null;
  }

  return (
    <Animated.View
      style={styles.container}
      entering={SlideInDown.duration(300)}
      exiting={SlideOutDown.duration(200)}
    >
      {!hasMedia ? (
        // Media picker state
        <View style={styles.pickerContainer}>
          <TouchableOpacity
            style={styles.pickMediaButton}
            onPress={onPickMedia}
          >
            <Text style={styles.pickMediaIcon}>📷</Text>
            <Text style={styles.pickMediaText}>Select Photo or Video</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Editor action bar
        <View style={styles.actionContainer}>
          {/* Save Button */}
          <TouchableOpacity style={styles.saveButton} onPress={onSave}>
            <Text style={styles.saveIcon}>💾</Text>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>

          {/* Spacer */}
          <View style={styles.spacer} />

          {/* Share to Story Button */}
          <TouchableOpacity style={styles.shareButton} onPress={onShare}>
            <Text style={styles.shareText}>Your Story</Text>
            <Text style={styles.shareArrow}>→</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
};

// ============================================================
// Top Navigation Bar
// ============================================================

interface TopNavBarProps {
  onClose: () => void;
  mode: EditorMode;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({ onClose, mode }) => {
  // Hide during certain modes
  if (["text", "drawing"].includes(mode)) return null;

  return (
    <Animated.View
      style={topStyles.container}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
    >
      <TouchableOpacity style={topStyles.button} onPress={onClose}>
        <Text style={topStyles.buttonText}>✕</Text>
      </TouchableOpacity>

      <View style={topStyles.rightButtons}></View>
    </Animated.View>
  );
};

// ---- Bottom Bar Styles ----

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  pickerContainer: {
    alignItems: "center",
  },
  pickMediaButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: EDITOR_COLORS.text,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 28,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  pickMediaIcon: {
    fontSize: 20,
  },
  pickMediaText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "700",
  },
  actionContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: EDITOR_COLORS.overlay,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    gap: 6,
  },
  saveIcon: {
    fontSize: 16,
  },
  saveText: {
    color: EDITOR_COLORS.text,
    fontSize: 15,
    fontWeight: "600",
  },
  spacer: {
    flex: 1,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: EDITOR_COLORS.text,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  shareText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "700",
  },
  shareArrow: {
    color: "#000000",
    fontSize: 18,
    fontWeight: "700",
  },
});

// ---- Top Nav Styles ----

const topStyles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    paddingHorizontal: 16,
    zIndex: 100,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: EDITOR_COLORS.overlay,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    fontSize: 20,
    color: EDITOR_COLORS.text,
  },
  rightButtons: {
    flexDirection: "row",
    gap: 8,
  },
});
