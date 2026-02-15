// ============================================================
// Instagram Stories Editor - Background Color/Gradient Picker
// ============================================================
// Shown when no media is loaded (text-only stories).
// Instagram-style horizontal scroll of color circles.

import React from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { EDITOR_COLORS, STORY_BACKGROUNDS, StoryBackground } from "../../constants";

const SWATCH_SIZE = 32;

interface BackgroundPickerProps {
  selectedId: string;
  onSelect: (bg: StoryBackground) => void;
}

export const BackgroundPicker: React.FC<BackgroundPickerProps> = ({
  selectedId,
  onSelect,
}) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {STORY_BACKGROUNDS.map((bg) => {
          const isSelected = bg.id === selectedId;

          return (
            <TouchableOpacity
              key={bg.id}
              style={[styles.swatchOuter, isSelected && styles.swatchSelected]}
              onPress={() => onSelect(bg)}
              activeOpacity={0.7}
            >
              {bg.type === "gradient" && bg.colors ? (
                <LinearGradient
                  colors={bg.colors as [string, string, ...string[]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.swatch}
                />
              ) : (
                <View
                  style={[styles.swatch, { backgroundColor: bg.color }]}
                >
                  {bg.color === "#000000" && (
                    <View style={styles.darkIndicator} />
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 10,
    alignItems: "center",
  },
  swatchOuter: {
    width: SWATCH_SIZE + 6,
    height: SWATCH_SIZE + 6,
    borderRadius: (SWATCH_SIZE + 6) / 2,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatchSelected: {
    borderColor: "#FFFFFF",
  },
  swatch: {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: SWATCH_SIZE / 2,
    overflow: "hidden",
  },
  darkIndicator: {
    position: "absolute",
    top: SWATCH_SIZE / 2 - 4,
    left: SWATCH_SIZE / 2 - 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#444",
  },
});
