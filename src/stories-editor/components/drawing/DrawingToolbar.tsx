// ============================================================
// Instagram Stories Editor - Drawing Toolbar
// ============================================================

import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import Slider from '@react-native-community/slider';
import { DrawingTool } from '../../types';
import {
  EDITOR_COLORS,
  DRAWING_COLORS,
  DRAWING_TOOL_CONFIG,
} from '../../constants';

interface DrawingToolbarProps {
  selectedTool: DrawingTool;
  selectedColor: string;
  strokeWidth: number;
  onToolChange: (tool: DrawingTool) => void;
  onColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onUndo: () => void;
  onClear: () => void;
  onDone: () => void;
}

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  selectedTool,
  selectedColor,
  strokeWidth,
  onToolChange,
  onColorChange,
  onStrokeWidthChange,
  onUndo,
  onClear,
  onDone,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);

  const tools: { id: DrawingTool; icon: string; label: string }[] = [
    { id: 'pen', icon: '✏️', label: 'Pen' },
    { id: 'marker', icon: '🖊️', label: 'Marker' },
    { id: 'neon', icon: '💫', label: 'Neon' },
    { id: 'highlighter', icon: '🖍️', label: 'Highlight' },
    { id: 'eraser', icon: '🧹', label: 'Eraser' },
    { id: 'arrow', icon: '➤', label: 'Arrow' },
  ];

  const toolConfig = DRAWING_TOOL_CONFIG[selectedTool];

  return (
    <Animated.View
      style={styles.container}
      entering={SlideInDown.duration(300)}
      exiting={SlideOutDown.duration(200)}
    >
      {/* Top Action Bar */}
      <View style={styles.topActions}>
        <TouchableOpacity onPress={onClear} style={styles.actionButton}>
          <Text style={styles.actionText}>Clear All</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onUndo} style={styles.actionButton}>
          <Text style={styles.actionText}>Undo</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDone} style={styles.doneButton}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>

      {/* Stroke Width Slider */}
      <View style={styles.sliderContainer}>
        <View
          style={[
            styles.strokePreview,
            {
              width: strokeWidth,
              height: strokeWidth,
              borderRadius: strokeWidth / 2,
              backgroundColor: selectedTool === 'eraser' ? '#666' : selectedColor,
            },
          ]}
        />
        <Slider
          style={styles.slider}
          minimumValue={toolConfig.minWidth}
          maximumValue={toolConfig.maxWidth}
          value={strokeWidth}
          onValueChange={onStrokeWidthChange}
          minimumTrackTintColor={EDITOR_COLORS.primary}
          maximumTrackTintColor={EDITOR_COLORS.surfaceLight}
          thumbTintColor="#FFFFFF"
        />
      </View>

      {/* Tool Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.toolRow}
      >
        {tools.map((tool) => (
          <TouchableOpacity
            key={tool.id}
            style={[
              styles.toolButton,
              selectedTool === tool.id && styles.toolButtonActive,
            ]}
            onPress={() => onToolChange(tool.id)}
          >
            <Text style={styles.toolIcon}>{tool.icon}</Text>
            <Text
              style={[
                styles.toolLabel,
                selectedTool === tool.id && styles.toolLabelActive,
              ]}
            >
              {tool.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Color Palette */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.colorRow}
      >
        {/* Color dropper */}
        <TouchableOpacity
          style={styles.colorDropper}
          onPress={() => setShowColorPicker(!showColorPicker)}
        >
          <Text style={styles.dropperIcon}>🎨</Text>
        </TouchableOpacity>

        {DRAWING_COLORS.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorSwatch,
              { backgroundColor: color },
              selectedColor === color && styles.colorSwatchActive,
            ]}
            onPress={() => onColorChange(color)}
          >
            {selectedColor === color && (
              <View style={styles.colorCheck}>
                <Text style={{ color: isLightColor(color) ? '#000' : '#FFF', fontSize: 12 }}>
                  ✓
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
};

// Helper to determine if color is light
const isLightColor = (hex: string): boolean => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
  topActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  actionText: {
    color: EDITOR_COLORS.text,
    fontSize: 15,
    fontWeight: '500',
  },
  doneButton: {
    backgroundColor: EDITOR_COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  doneText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  strokePreview: {
    minWidth: 4,
    minHeight: 4,
    maxWidth: 40,
    maxHeight: 40,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  toolRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  toolButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: EDITOR_COLORS.surface,
    minWidth: 60,
  },
  toolButtonActive: {
    backgroundColor: EDITOR_COLORS.primary,
  },
  toolIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  toolLabel: {
    fontSize: 10,
    color: EDITOR_COLORS.textSecondary,
    fontWeight: '600',
  },
  toolLabelActive: {
    color: '#FFFFFF',
  },
  colorRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 8,
  },
  colorDropper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: EDITOR_COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropperIcon: {
    fontSize: 18,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  colorCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
