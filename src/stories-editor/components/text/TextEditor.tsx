// ============================================================
// Instagram Stories Editor - Text Editor Component
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { TextElement, TextStylePreset } from '../../types';
import {
  EDITOR_COLORS,
  DRAWING_COLORS,
  TEXT_FONTS,
  TEXT_STYLE_PRESETS,
} from '../../constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TextEditorProps {
  element?: TextElement | null;
  onAdd: (options: Partial<TextElement>) => string;
  onUpdate: (id: string, updates: Partial<TextElement>) => void;
  onDone: () => void;
  onCancel: () => void;
}

type TextEditorTab = 'style' | 'font' | 'color' | 'align';

export const TextEditor: React.FC<TextEditorProps> = ({
  element,
  onAdd,
  onUpdate,
  onDone,
  onCancel,
}) => {
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState(element?.content || '');
  const [selectedFont, setSelectedFont] = useState(
    element?.fontFamily || 'System'
  );
  const [selectedColor, setSelectedColor] = useState(
    element?.color || '#FFFFFF'
  );
  const [selectedStyle, setSelectedStyle] = useState<TextStylePreset>(
    element?.style || 'classic'
  );
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>(
    element?.textAlign || 'center'
  );
  const [fontSize, setFontSize] = useState(element?.fontSize || 48);
  const [activeTab, setActiveTab] = useState<TextEditorTab>('style');
  const [elementId, setElementId] = useState<string | null>(element?.id || null);

  useEffect(() => {
    // Focus the input after mount
    setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
  }, []);

  // Create or update element when properties change
  useEffect(() => {
    if (!text.trim()) return;

    const stylePreset = TEXT_STYLE_PRESETS.find((s) => s.id === selectedStyle);
    const updates: Partial<TextElement> = {
      content: text,
      fontFamily: selectedFont,
      color: selectedColor,
      style: selectedStyle,
      textAlign,
      fontSize,
      backgroundColor: stylePreset?.defaultBackgroundColor,
      strokeColor: stylePreset?.defaultStrokeColor,
      strokeWidth: stylePreset?.defaultStrokeWidth,
      shadowColor: stylePreset?.defaultShadowColor,
      shadowBlur: stylePreset?.defaultShadowBlur,
    };

    if (elementId) {
      onUpdate(elementId, updates);
    }
  }, [text, selectedFont, selectedColor, selectedStyle, textAlign, fontSize]);

  const handleDone = () => {
    if (!text.trim()) {
      onCancel();
      return;
    }

    if (!elementId) {
      const stylePreset = TEXT_STYLE_PRESETS.find((s) => s.id === selectedStyle);
      const id = onAdd({
        content: text,
        fontFamily: selectedFont,
        color: selectedColor,
        style: selectedStyle,
        textAlign,
        fontSize,
        backgroundColor: stylePreset?.defaultBackgroundColor,
        strokeColor: stylePreset?.defaultStrokeColor,
        strokeWidth: stylePreset?.defaultStrokeWidth,
        shadowColor: stylePreset?.defaultShadowColor,
        shadowBlur: stylePreset?.defaultShadowBlur,
      });
      setElementId(id);
    }

    onDone();
  };

  const getPreviewStyle = () => {
    const baseStyle: any = {
      color: selectedColor,
      fontFamily: selectedFont,
      fontSize: Math.min(fontSize, 36),
      textAlign,
    };

    switch (selectedStyle) {
      case 'modern':
        baseStyle.backgroundColor = 'rgba(0,0,0,0.7)';
        baseStyle.paddingHorizontal = 12;
        baseStyle.paddingVertical = 6;
        baseStyle.borderRadius = 4;
        baseStyle.overflow = 'hidden';
        break;
      case 'neon':
        baseStyle.textShadowColor = selectedColor;
        baseStyle.textShadowRadius = 15;
        baseStyle.textShadowOffset = { width: 0, height: 0 };
        break;
      case 'typewriter':
        baseStyle.backgroundColor = '#FFFFFF';
        baseStyle.color = '#000000';
        baseStyle.paddingHorizontal = 12;
        baseStyle.paddingVertical = 6;
        break;
      case 'strong':
        baseStyle.backgroundColor = '#FF3B30';
        baseStyle.paddingHorizontal = 16;
        baseStyle.paddingVertical = 8;
        baseStyle.fontWeight = '900';
        break;
      case 'outline':
        baseStyle.textShadowColor = '#FFFFFF';
        baseStyle.textShadowRadius = 3;
        break;
      case 'shadow':
        baseStyle.textShadowColor = '#000000';
        baseStyle.textShadowRadius = 10;
        baseStyle.textShadowOffset = { width: 2, height: 2 };
        break;
    }

    return baseStyle;
  };

  return (
    <Animated.View
      style={styles.overlay}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Top Actions */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          {/* Font size controls */}
          <View style={styles.fontSizeControls}>
            <TouchableOpacity
              onPress={() => setFontSize(Math.max(16, fontSize - 4))}
              style={styles.fontSizeButton}
            >
              <Text style={styles.fontSizeButtonText}>A-</Text>
            </TouchableOpacity>
            <Text style={styles.fontSizeText}>{fontSize}</Text>
            <TouchableOpacity
              onPress={() => setFontSize(Math.min(120, fontSize + 4))}
              style={styles.fontSizeButton}
            >
              <Text style={styles.fontSizeButtonText}>A+</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleDone} style={styles.doneButton}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Text Input Area */}
        <View style={styles.inputArea}>
          <TextInput
            ref={inputRef}
            style={[styles.textInput, getPreviewStyle()]}
            value={text}
            onChangeText={setText}
            placeholder="Type something..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            multiline
            autoFocus
          />
        </View>

        {/* Bottom Panel */}
        <View style={styles.bottomPanel}>
          {/* Tab Selector */}
          <View style={styles.tabRow}>
            {[
              { id: 'style' as TextEditorTab, label: 'Style' },
              { id: 'font' as TextEditorTab, label: 'Font' },
              { id: 'color' as TextEditorTab, label: 'Color' },
              { id: 'align' as TextEditorTab, label: 'Align' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tab,
                  activeTab === tab.id && styles.tabActive,
                ]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab.id && styles.tabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab Content */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabContent}
          >
            {activeTab === 'style' && (
              <>
                {TEXT_STYLE_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset.id}
                    style={[
                      styles.stylePreset,
                      selectedStyle === preset.id && styles.stylePresetActive,
                    ]}
                    onPress={() => setSelectedStyle(preset.id)}
                  >
                    <View style={styles.stylePreview}>
                      <Text
                        style={[
                          styles.stylePreviewText,
                          preset.hasBackground && {
                            backgroundColor:
                              preset.defaultBackgroundColor || '#333',
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 3,
                            overflow: 'hidden',
                          },
                          preset.hasShadow && {
                            textShadowColor:
                              preset.defaultShadowColor || '#000',
                            textShadowRadius: 4,
                          },
                          preset.id === 'typewriter' && {
                            color: '#000',
                            backgroundColor: '#FFF',
                          },
                        ]}
                      >
                        Aa
                      </Text>
                    </View>
                    <Text style={styles.presetLabel}>{preset.name}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {activeTab === 'font' && (
              <>
                {TEXT_FONTS.map((font) => (
                  <TouchableOpacity
                    key={font.id}
                    style={[
                      styles.fontPreset,
                      selectedFont === font.fontFamily &&
                        styles.fontPresetActive,
                    ]}
                    onPress={() => setSelectedFont(font.fontFamily)}
                  >
                    <Text
                      style={[
                        styles.fontPreviewText,
                        { fontFamily: font.fontFamily },
                      ]}
                    >
                      Aa
                    </Text>
                    <Text style={styles.fontLabel}>{font.name}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {activeTab === 'color' && (
              <>
                {DRAWING_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: color },
                      selectedColor === color && styles.colorSwatchActive,
                    ]}
                    onPress={() => setSelectedColor(color)}
                  />
                ))}
              </>
            )}

            {activeTab === 'align' && (
              <>
                {(['left', 'center', 'right'] as const).map((align) => (
                  <TouchableOpacity
                    key={align}
                    style={[
                      styles.alignButton,
                      textAlign === align && styles.alignButtonActive,
                    ]}
                    onPress={() => setTextAlign(align)}
                  >
                    <Text style={styles.alignIcon}>
                      {align === 'left' ? '⫷' : align === 'center' ? '☰' : '⫸'}
                    </Text>
                    <Text style={styles.alignLabel}>
                      {align.charAt(0).toUpperCase() + align.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'space-between',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelText: {
    color: EDITOR_COLORS.text,
    fontSize: 16,
    fontWeight: '500',
  },
  fontSizeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fontSizeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: EDITOR_COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fontSizeButtonText: {
    color: EDITOR_COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  fontSizeText: {
    color: EDITOR_COLORS.textSecondary,
    fontSize: 14,
    minWidth: 30,
    textAlign: 'center',
  },
  doneButton: {
    backgroundColor: EDITOR_COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  doneText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  inputArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  textInput: {
    width: '100%',
    color: '#FFFFFF',
    fontSize: 36,
    textAlign: 'center',
    minHeight: 50,
    maxHeight: 200,
  },
  bottomPanel: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: EDITOR_COLORS.surfaceLight,
  },
  tabText: {
    color: EDITOR_COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: EDITOR_COLORS.text,
  },
  tabContent: {
    paddingHorizontal: 16,
    gap: 10,
    minHeight: 80,
    alignItems: 'center',
  },
  stylePreset: {
    alignItems: 'center',
    gap: 6,
    minWidth: 60,
  },
  stylePresetActive: {
    transform: [{ scale: 1.1 }],
  },
  stylePreview: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: EDITOR_COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stylePreviewText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  presetLabel: {
    color: EDITOR_COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  fontPreset: {
    alignItems: 'center',
    gap: 6,
    minWidth: 70,
  },
  fontPresetActive: {
    transform: [{ scale: 1.1 }],
  },
  fontPreviewText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  fontLabel: {
    color: EDITOR_COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.2 }],
  },
  alignButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: EDITOR_COLORS.surface,
    gap: 4,
  },
  alignButtonActive: {
    backgroundColor: EDITOR_COLORS.primary,
  },
  alignIcon: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  alignLabel: {
    color: EDITOR_COLORS.text,
    fontSize: 11,
    fontWeight: '600',
  },
});
