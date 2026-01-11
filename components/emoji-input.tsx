import { useState, useRef, useCallback } from "react"
import { View, TextInput, Pressable, StyleSheet, TextInputProps, Platform } from "react-native"
import { Smile } from "lucide-react-native"
import { EmojiPopup } from "react-native-emoji-popup"

interface EmojiInputProps extends Omit<TextInputProps, "value" | "onChangeText"> {
  value: string
  onChangeText: (text: string) => void
  emojiButtonColor?: string
  emojiButtonSize?: number
  inputStyle?: TextInputProps["style"]
  containerStyle?: object
  showEmojiButton?: boolean
  emojiButtonPosition?: "left" | "right"
}

export function EmojiInput({
  value,
  onChangeText,
  emojiButtonColor = "#666",
  emojiButtonSize = 24,
  inputStyle,
  containerStyle,
  showEmojiButton = true,
  emojiButtonPosition = "right",
  ...textInputProps
}: EmojiInputProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const inputRef = useRef<TextInput>(null)
  const [cursorPosition, setCursorPosition] = useState(value.length)

  const handleEmojiSelect = useCallback((emoji: string) => {
    const before = value.substring(0, cursorPosition)
    const after = value.substring(cursorPosition)
    const newText = before + emoji + after
    onChangeText(newText)
    setCursorPosition(cursorPosition + emoji.length)
  }, [value, cursorPosition, onChangeText])

  const handleSelectionChange = useCallback((event: any) => {
    setCursorPosition(event.nativeEvent.selection.end)
  }, [])

  const toggleEmojiPicker = useCallback(() => {
    setShowEmojiPicker(prev => !prev)
  }, [])

  const emojiButton = showEmojiButton ? (
    <Pressable 
      onPress={toggleEmojiPicker} 
      hitSlop={8}
      style={styles.emojiButton}
    >
      <Smile size={emojiButtonSize} color={showEmojiPicker ? "#3EA4E5" : emojiButtonColor} />
    </Pressable>
  ) : null

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.inputRow}>
        {emojiButtonPosition === "left" && emojiButton}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onSelectionChange={handleSelectionChange}
          style={[styles.input, inputStyle]}
          {...textInputProps}
        />
        {emojiButtonPosition === "right" && emojiButton}
      </View>
      
      {Platform.OS !== "web" && showEmojiPicker && (
        <EmojiPopup
          onEmojiSelected={(emoji: string) => {
            handleEmojiSelect(emoji)
            setShowEmojiPicker(false)
          }}
        >
          <View />
        </EmojiPopup>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
  },
  emojiButton: {
    padding: 4,
  },
})
