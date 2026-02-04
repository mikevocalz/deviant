import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  MapPin,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
} from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import { useState, useCallback, useEffect } from "react";
import { useUIStore } from "@/lib/stores/ui-store";
import { Motion } from "@legendapp/motion";
import { postsApi } from "@/lib/api/posts";
import { useQueryClient } from "@tanstack/react-query";

export default function EditPostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const postId = params.id;
  const insets = useSafeAreaInsets();
  const { colors } = useColorScheme();
  const showToast = useUIStore((state) => state.showToast);
  const queryClient = useQueryClient();

  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [isNSFW, setIsNSFW] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  // Fetch post data
  useEffect(() => {
    const fetchPost = async () => {
      if (!postId) return;

      try {
        setIsFetching(true);
        const post = await postsApi.getPostById(postId);

        if (post) {
          setCaption(post.caption || "");
          setLocation(post.location || "");
          setIsNSFW(post.isNSFW || false);
        }
      } catch (error) {
        console.error("Error fetching post:", error);
        showToast("error", "Failed to load post");
      } finally {
        setIsFetching(false);
      }
    };

    fetchPost();
  }, [postId, showToast]);

  const handleSave = useCallback(async () => {
    if (!postId) {
      showToast("error", "Post ID not found");
      return;
    }

    if (!caption.trim()) {
      showToast("error", "Caption cannot be empty");
      return;
    }

    try {
      setIsLoading(true);

      await postsApi.updatePost(postId, {
        content: caption.trim(),
        location: location.trim() || undefined,
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });

      showToast("success", "Post updated successfully");
      router.back();
    } catch (error: any) {
      console.error("Error updating post:", error);
      showToast("error", error.message || "Failed to update post");
    } finally {
      setIsLoading(false);
    }
  }, [postId, caption, location, showToast, router, queryClient]);

  if (isFetching) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top,
          backgroundColor: colors.background,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View className="flex-row items-center justify-between px-4 py-3">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text
            className="text-lg font-semibold"
            style={{ color: colors.foreground }}
          >
            Edit Post
          </Text>
          <Pressable
            onPress={handleSave}
            disabled={isLoading || !caption.trim()}
            className="px-4 py-2 rounded-full"
            style={{
              backgroundColor: !caption.trim() ? colors.muted : colors.primary,
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Check size={20} color="#fff" />
            )}
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Caption */}
          <View className="mb-6">
            <Text
              className="text-sm font-medium mb-2"
              style={{ color: colors.mutedForeground }}
            >
              Caption
            </Text>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Write a caption..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              className="px-4 py-3 rounded-xl border"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.foreground,
                minHeight: 120,
              }}
            />
            <View className="flex-row items-center justify-between mt-2">
              <Text
                className="text-xs"
                style={{ color: colors.mutedForeground }}
              >
                {caption.length}/2200 characters
              </Text>
              {caption.length > 2200 && (
                <View className="flex-row items-center gap-1">
                  <AlertCircle size={12} color={colors.destructive} />
                  <Text
                    className="text-xs"
                    style={{ color: colors.destructive }}
                  >
                    Caption too long
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Location */}
          <View className="mb-6">
            <Text
              className="text-sm font-medium mb-2"
              style={{ color: colors.mutedForeground }}
            >
              Location (Optional)
            </Text>
            <View
              className="flex-row items-center px-4 py-3 rounded-xl border"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
            >
              <MapPin size={18} color={colors.mutedForeground} />
              <TextInput
                value={location}
                onChangeText={setLocation}
                placeholder="Add location"
                placeholderTextColor={colors.mutedForeground}
                className="flex-1 ml-2"
                style={{ color: colors.foreground }}
              />
            </View>
          </View>

          {/* NSFW Toggle */}
          <View
            className="flex-row items-center justify-between p-4 rounded-xl"
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View className="flex-1">
              <Text
                className="text-sm font-medium mb-1"
                style={{ color: colors.foreground }}
              >
                Mark as NSFW
              </Text>
              <Text
                className="text-xs"
                style={{ color: colors.mutedForeground }}
              >
                Sensitive content that requires age verification
              </Text>
            </View>
            <Switch
              value={isNSFW}
              onValueChange={setIsNSFW}
              trackColor={{ false: colors.muted, true: colors.primary }}
              thumbColor="#fff"
              disabled={true}
            />
          </View>

          {/* Info Box */}
          <Motion.View
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "timing", duration: 300 }}
            className="mt-6 p-4 rounded-xl flex-row gap-3"
            style={{ backgroundColor: colors.muted }}
          >
            <AlertCircle size={20} color={colors.mutedForeground} />
            <View className="flex-1">
              <Text
                className="text-xs"
                style={{ color: colors.mutedForeground }}
              >
                Changes to your post will be visible immediately to all
                followers. Media cannot be edited.
              </Text>
            </View>
          </Motion.View>

          <View style={{ height: insets.bottom + 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
