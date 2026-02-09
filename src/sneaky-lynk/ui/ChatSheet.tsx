/**
 * Chat Sheet Component
 * Bottom sheet for in-room chat during Sneaky Lynk sessions
 * Limited to 75% of screen height
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LegendList } from "@/components/list";
import { PasteInput } from "@/components/ui/paste-input";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet, { BottomSheetBackdrop } from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import { Send, X } from "lucide-react-native";
import type { SneakyUser } from "../types";

interface ChatMessage {
  id: string;
  user: SneakyUser;
  content: string;
  timestamp: Date;
}

interface ChatSheetProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  currentUser: SneakyUser;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function MessageBubble({
  message,
  isOwnMessage,
}: {
  message: ChatMessage;
  isOwnMessage: boolean;
}) {
  return (
    <View
      className={`flex-row gap-2 mb-3 ${isOwnMessage ? "flex-row-reverse" : ""}`}
    >
      {!isOwnMessage && (
        <Image
          source={{ uri: message.user.avatar }}
          className="w-8 h-8 rounded-lg"
        />
      )}
      <View
        className={`max-w-[75%] ${isOwnMessage ? "items-end" : "items-start"}`}
      >
        {!isOwnMessage && (
          <Text className="text-xs text-muted-foreground mb-1">
            {message.user.displayName}
          </Text>
        )}
        <View
          className={`px-3 py-2 rounded-2xl ${
            isOwnMessage ? "bg-primary" : "bg-secondary"
          }`}
        >
          <Text className="text-white text-sm">{message.content}</Text>
        </View>
        <Text className="text-[10px] text-muted-foreground mt-1">
          {formatTime(message.timestamp)}
        </Text>
      </View>
    </View>
  );
}

export function ChatSheet({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  currentUser,
}: ChatSheetProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState("");

  // Delayed unmount: keep sheet mounted briefly after close so animation plays
  const [shouldRender, setShouldRender] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => setShouldRender(false), 400);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 75% of screen height
  const snapPoints = useMemo(() => ["75%"], []);

  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) {
        onClose();
      }
    },
    [onClose],
  );

  const handleSend = useCallback(() => {
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText("");
  }, [inputText, onSendMessage]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    [],
  );

  if (!shouldRender) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: "#1a1a1a" }}
      handleIndicatorStyle={{ backgroundColor: "#6B7280" }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={100}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: "rgba(255,255,255,0.06)",
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#34A2DF" }}>
            Chat
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.1)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={22} color="#fff" />
          </Pressable>
        </View>

        {/* Messages */}
        <LegendList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isOwnMessage={item.user.id === currentUser.id}
            />
          )}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          alignItemsAtEnd
          maintainScrollAtEnd
          showsVerticalScrollIndicator={false}
          estimatedItemSize={60}
          recycleItems
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-10">
              <Text className="text-muted-foreground text-center">
                No messages yet.{"\n"}Start the conversation!
              </Text>
            </View>
          }
        />

        {/* Input */}
        <View
          className="flex-row items-center gap-2 px-4 py-3 border-t border-border"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <PasteInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor="#6B7280"
            className="flex-1 bg-secondary rounded-full px-4 py-3 text-foreground"
            multiline
            maxLength={500}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable
            onPress={handleSend}
            disabled={!inputText.trim()}
            className={`w-11 h-11 rounded-full items-center justify-center ${
              inputText.trim() ? "bg-primary" : "bg-secondary"
            }`}
          >
            <Send size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}
