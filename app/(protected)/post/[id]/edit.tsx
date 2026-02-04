/**
 * Edit Post Screen
 *
 * Instagram parity: Only caption/text is editable, NOT media.
 *
 * Route: /(protected)/post/[id]/edit
 */

import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useColorScheme } from "@/lib/hooks";
import { ArrowLeft, Check } from "lucide-react-native";
import { useState, useEffect, useCallback } from "react";
import { usePost } from "@/lib/hooks/use-posts";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { postsApi } from "@/lib/api/posts";
import { useQueryClient } from "@tanstack/react-query";
import { postKeys } from "@/lib/hooks/use-posts";
import { Image } from "expo-image";

export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useColorScheme();
  const queryClient = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);
  const currentUser = useAuthStore((state) => state.user);

  // Fetch post data
  const { data: post, isLoading, isError } = usePost(id || "");

  // Local state for caption editing
  const [caption, setCaption] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize caption from post data
  useEffect(() => {
    if (post?.caption) {
      setCaption(post.caption);
    }
  }, [post?.caption]);

  // Track changes
  useEffect(() => {
    if (post?.caption !== undefined) {
      setHasChanges(caption !== post.caption);
    }
  }, [caption, post?.caption]);

  // Check ownership
  const isOwner =
    post?.author?.id &&
    currentUser?.id &&
    String(post.author.id) === String(currentUser.id);

  const handleSave = useCallback(async () => {
    if (!id || !hasChanges || isSaving) return;

    setIsSaving(true);
    try {
      // PATCH /api/posts/:id - only caption is editable
      const updated = await postsApi.updatePost(id, { content: caption });

      // Optimistic cache updates
      // Update post detail cache
      queryClient.setQueryData(postKeys.detail(id), (old: any) => {
        if (!old) return old;
        return { ...old, caption };
      });

      // Update feed caches
      queryClient.setQueryData(["posts", "feed"], (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((p: any) => (p.id === id ? { ...p, caption } : p));
      });

      queryClient.setQueryData(["posts", "feed", "infinite"], (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data?.map((p: any) =>
              p.id === id ? { ...p, caption } : p,
            ),
          })),
        };
      });

      // Update profile posts cache
      if (currentUser?.id) {
        queryClient.setQueryData(
          postKeys.profilePosts(String(currentUser.id)),
          (old: any) => {
            if (!old || !Array.isArray(old)) return old;
            return old.map((p: any) => (p.id === id ? { ...p, caption } : p));
          },
        );
      }

      showToast("success", "Saved", "Post updated successfully");
      router.back();
    } catch (error: any) {
      console.error("[EditPost] Save error:", error);
      showToast("error", "Error", error?.message || "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  }, [
    id,
    caption,
    hasChanges,
    isSaving,
    queryClient,
    currentUser?.id,
    showToast,
    router,
  ]);

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Error or not found
  if (isError || !post) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <View className="flex-row items-center border-b border-border px-4 py-3">
          <Pressable onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="ml-4 text-lg font-semibold text-foreground">
            Edit Post
          </Text>
        </View>
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-muted-foreground">Post not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Not owner - forbidden
  if (!isOwner) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <View className="flex-row items-center border-b border-border px-4 py-3">
          <Pressable onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="ml-4 text-lg font-semibold text-foreground">
            Edit Post
          </Text>
        </View>
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-muted-foreground">
            You can only edit your own posts
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const previewImage = post.media?.[0]?.url;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color={colors.foreground} />
        </Pressable>
        <Text className="text-lg font-semibold text-foreground">Edit Post</Text>
        <Pressable
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
          hitSlop={12}
          style={{ opacity: hasChanges && !isSaving ? 1 : 0.5 }}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Check
              size={24}
              color={hasChanges ? colors.primary : colors.mutedForeground}
            />
          )}
        </Pressable>
      </View>

      {/* Content */}
      <View className="flex-1 p-4">
        {/* Media Preview (read-only) */}
        {previewImage && (
          <View className="mb-4">
            <Image
              source={{ uri: previewImage }}
              style={{ width: "100%", height: 200, borderRadius: 12 }}
              contentFit="cover"
            />
            <Text className="mt-2 text-xs text-muted-foreground text-center">
              Media cannot be edited
            </Text>
          </View>
        )}

        {/* Caption Editor */}
        <View className="flex-1">
          <Text className="text-sm font-medium text-foreground mb-2">
            Caption
          </Text>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Write a caption..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={2200}
            style={{
              flex: 1,
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 16,
              color: colors.foreground,
              fontSize: 16,
              textAlignVertical: "top",
              minHeight: 150,
            }}
          />
          <Text className="mt-2 text-xs text-muted-foreground text-right">
            {caption.length}/2200
          </Text>
        </View>

        {/* Hashtag Preview */}
        {caption.includes("#") && (
          <View className="mt-4">
            <Text className="text-sm font-medium text-foreground mb-2">
              Hashtags
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {caption.match(/#\w+/g)?.map((tag, index) => (
                <View
                  key={`${tag}-${index}`}
                  className="bg-primary/10 px-3 py-1 rounded-full"
                >
                  <Text className="text-primary text-sm">{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
