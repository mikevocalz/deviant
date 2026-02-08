/**
 * Create Lynk Screen
 * Form to create a new Sneaky Lynk room
 */

import {
  View,
  Text,
  Pressable,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Radio, Video, Globe, Lock } from "lucide-react-native";
import { useState, useCallback } from "react";
import { useUIStore } from "@/lib/stores/ui-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useLynkHistoryStore } from "@/src/sneaky-lynk/stores/lynk-history-store";
import { sneakyLynkApi } from "@/src/sneaky-lynk/api/supabase";

export default function CreateLynkScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);
  const authUser = useAuthStore((s) => s.user);
  const addRoom = useLynkHistoryStore((s) => s.addRoom);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hasVideo, setHasVideo] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) {
      showToast("error", "Error", "Please enter a title for your Lynk");
      return;
    }

    setIsCreating(true);
    try {
      console.log("[CreateLynk] Creating room:", {
        title: title.trim(),
        description: description.trim(),
        hasVideo,
        isPublic,
      });

      // Create room via Edge Function (persists to DB, visible to all users)
      const result = await sneakyLynkApi.createRoom({
        title: title.trim(),
        topic: description.trim() || "Live conversation",
        description: description.trim(),
        hasVideo,
        isPublic,
      });

      if (!result.ok || !result.data) {
        throw new Error(result.error?.message || "Failed to create room");
      }

      const roomId = result.data.room?.id || `space-${Date.now()}`;

      // Record room in local history so it shows on the Lynks tab
      addRoom({
        id: roomId,
        title: title.trim(),
        topic: description.trim() || "Live conversation",
        description: description.trim(),
        isLive: true,
        hasVideo,
        isPublic,
        status: "open",
        host: {
          id: authUser?.id || "local",
          username: authUser?.username || "You",
          displayName: authUser?.name || authUser?.username || "You",
          avatar:
            authUser?.avatar ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(authUser?.username || "U")}&background=1a1a1a&color=fff&rounded=true`,
          isVerified: authUser?.isVerified || false,
        },
        speakers: [],
        listeners: 0,
        createdAt: new Date().toISOString(),
      });

      showToast("success", "Lynk Created", "Your Lynk is now live!");

      // Navigate to the new room
      router.replace({
        pathname: "/(protected)/sneaky-lynk/room/[id]",
        params: { id: roomId, title: title.trim() },
      } as any);
    } catch (error) {
      console.error("[CreateLynk] Error:", error);
      showToast("error", "Error", "Failed to create Lynk");
    } finally {
      setIsCreating(false);
    }
  }, [
    title,
    description,
    hasVideo,
    isPublic,
    router,
    showToast,
    authUser,
    addRoom,
  ]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <View className="flex-row items-center gap-2">
          <Radio size={20} color="#FC253A" />
          <Text className="text-lg font-bold text-foreground">Create Lynk</Text>
        </View>
        <View className="w-6" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title Input */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-muted-foreground mb-2">
            Title *
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="What's your Lynk about?"
            placeholderTextColor="#6B7280"
            maxLength={100}
            className="bg-secondary rounded-xl px-4 py-3.5 text-foreground text-base"
          />
          <Text className="text-xs text-muted-foreground mt-1.5 text-right">
            {title.length}/100
          </Text>
        </View>

        {/* Description Input */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-muted-foreground mb-2">
            Description (optional)
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Tell people what to expect..."
            placeholderTextColor="#6B7280"
            multiline
            numberOfLines={3}
            maxLength={280}
            textAlignVertical="top"
            className="bg-secondary rounded-xl px-4 py-3.5 text-foreground text-base min-h-[100px]"
          />
          <Text className="text-xs text-muted-foreground mt-1.5 text-right">
            {description.length}/280
          </Text>
        </View>

        {/* Video Toggle */}
        <View className="flex-row items-center justify-between bg-secondary rounded-xl px-4 py-4 mb-4">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center">
              <Video size={20} color="#FC253A" />
            </View>
            <View>
              <Text className="text-foreground font-semibold">
                Enable Video
              </Text>
              <Text className="text-xs text-muted-foreground">
                Allow speakers to share video
              </Text>
            </View>
          </View>
          <Switch
            value={hasVideo}
            onValueChange={setHasVideo}
            trackColor={{ false: "#374151", true: "#FC253A" }}
            thumbColor="#fff"
          />
        </View>

        {/* Public/Private Toggle */}
        <View className="flex-row items-center justify-between bg-secondary rounded-xl px-4 py-4 mb-8">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center">
              {isPublic ? (
                <Globe size={20} color="#FC253A" />
              ) : (
                <Lock size={20} color="#FC253A" />
              )}
            </View>
            <View>
              <Text className="text-foreground font-semibold">
                {isPublic ? "Public Lynk" : "Private Lynk"}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {isPublic
                  ? "Anyone can join and listen"
                  : "Only invited users can join"}
              </Text>
            </View>
          </View>
          <Switch
            value={isPublic}
            onValueChange={setIsPublic}
            trackColor={{ false: "#374151", true: "#FC253A" }}
            thumbColor="#fff"
          />
        </View>

        {/* Create Button */}
        <Pressable
          onPress={handleCreate}
          disabled={isCreating || !title.trim()}
          className={`py-4 rounded-full items-center ${
            isCreating || !title.trim() ? "bg-primary/50" : "bg-primary"
          }`}
        >
          <Text className="text-white font-bold text-base">
            {isCreating ? "Creating..." : "Start Lynk"}
          </Text>
        </Pressable>

        {/* Info Text */}
        <Text className="text-xs text-muted-foreground text-center mt-4">
          Your Lynk will go live immediately after creation.{"\n"}
          You'll be the host and can invite speakers.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
