import { View, Text, ScrollView, Pressable, Dimensions } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
} from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import { PostDetailSkeleton } from "@/components/skeletons";
import { usePost, useLikePost } from "@/lib/hooks/use-posts";
import { usePostStore } from "@/lib/stores/post-store";
import { useBookmarkStore } from "@/lib/stores/bookmark-store";
import { sharePost } from "@/lib/utils/sharing";
import { VideoView, useVideoPlayer } from "expo-video";
import { Image } from "expo-image";
import { SharedImage } from "@/components/shared-image";

const { width } = Dimensions.get("window");

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: post, isLoading, error: postError } = usePost(id!);
  const { isPostLiked, toggleLike, getLikeCount } = usePostStore();
  const { isBookmarked, toggleBookmark } = useBookmarkStore();
  const { colors } = useColorScheme();
  const likePostMutation = useLikePost();
  
  // Always call hooks unconditionally - use safe defaults
  const videoUrl = post?.media?.[0]?.type === "video" && post?.media?.[0]?.url 
    ? post.media[0].url 
    : "";
  const player = useVideoPlayer(
    videoUrl || "",
    (player) => {
      if (player && videoUrl) {
        player.loop = false;
      }
    },
  );

  useFocusEffect(
    useCallback(() => {
      return () => {
        try {
          if (player && typeof player.pause === "function") {
            player.pause();
          }
        } catch (error) {
          // Player may have been released
          console.log("[PostDetail] Error pausing player:", error);
        }
      };
    }, [player]),
  );

  if (isLoading) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <View className="flex-row items-center border-b border-border bg-background px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-lg font-semibold text-foreground">Post</Text>
        </View>
        <PostDetailSkeleton />
      </SafeAreaView>
    );
  }

  if (postError || !post) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <View className="flex-row items-center border-b border-border bg-background px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-lg font-semibold text-foreground">Post</Text>
        </View>
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-muted-foreground text-center">
            {postError ? "Failed to load post" : "Post not found"}
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-4 px-4 py-2 bg-primary rounded-lg"
          >
            <Text className="text-primary-foreground font-semibold">Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isVideo = post.media?.[0]?.type === "video";
  const hasMedia = post.media && Array.isArray(post.media) && post.media.length > 0;
  const postIdString = String(post.id);
  const isLiked = isPostLiked(postIdString);
  const isSaved = isBookmarked(postIdString);
  const likeCount = getLikeCount(postIdString, post.likes || 0);

  const handleShare = useCallback(async () => {
    try {
      await sharePost(postIdString, post.caption || "");
    } catch (error) {
      console.error("[PostDetail] Share error:", error);
    }
  }, [postIdString, post.caption]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <View className="flex-row items-center border-b border-border bg-background px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-4">
          <ArrowLeft size={24} color={colors.foreground} />
        </Pressable>
        <Text className="text-lg font-semibold text-foreground">Post</Text>
      </View>

      <ScrollView>
        <View className="border-b border-border bg-card">
          {/* Header */}
          <View className="flex-row items-center justify-between p-4">
            <View className="flex-row items-center gap-3">
              <Image
                source={{ uri: post.author?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author?.username || "User")}` }}
                className="h-10 w-10 rounded-full"
              />
              <View>
                <Text className="text-base font-semibold text-foreground">
                  {post.author?.username || "Unknown User"}
                </Text>
                {post.location && (
                  <Text className="text-sm text-muted-foreground">
                    {post.location}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Media */}
          {hasMedia ? (
            <View style={{ width, height: width }} className="bg-muted">
              {isVideo && videoUrl && player ? (
                <VideoView
                  player={player}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  nativeControls
                />
              ) : post.media?.[0]?.url ? (
                <SharedImage
                  source={{ uri: post.media[0].url }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  sharedTag={`post-image-${postIdString}`}
                />
              ) : (
                <View className="flex-1 items-center justify-center">
                  <Text className="text-muted-foreground">No media available</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={{ width, height: width }} className="bg-muted items-center justify-center">
              <Text className="text-muted-foreground">No media</Text>
            </View>
          )}

          {/* Actions */}
          <View className="flex-row items-center justify-between p-4">
            <View className="flex-row items-center gap-4">
              <Pressable
                onPress={() => {
                  const wasLiked = isLiked;
                  toggleLike(postIdString, post.likes || 0);
                  likePostMutation.mutate(
                    { postId: postIdString, isLiked: wasLiked },
                    {
                      onError: () => {
                        // Rollback on error
                        toggleLike(postIdString, post.likes || 0);
                      },
                    },
                  );
                }}
              >
                <Heart
                  size={28}
                  color={isLiked ? "#FF5BFC" : colors.foreground}
                  fill={isLiked ? "#FF5BFC" : "none"}
                />
              </Pressable>
              <Pressable
                onPress={() => router.push(`/(protected)/comments/${postIdString}`)}
              >
                <MessageCircle size={28} color={colors.foreground} />
              </Pressable>
              <Pressable onPress={handleShare}>
                <Share2 size={28} color={colors.foreground} />
              </Pressable>
            </View>
            <Pressable onPress={() => toggleBookmark(postIdString)}>
              <Bookmark
                size={28}
                color={colors.foreground}
                fill={isSaved ? colors.foreground : "none"}
              />
            </Pressable>
          </View>

          {/* Info */}
          <View className="px-4 pb-4">
            <Text className="text-base font-semibold text-foreground">
              {likeCount.toLocaleString()} likes
            </Text>
            {post.caption && (
                <Text className="mt-2 text-base">
                <Text className="font-semibold text-foreground">
                  {post.author?.username || "Unknown User"}
                </Text>{" "}
                <Text className="text-foreground">{post.caption || ""}</Text>
              </Text>
            )}
            <Text className="mt-2 text-xs uppercase text-muted-foreground">
              {post.timeAgo}
            </Text>
          </View>
        </View>

        {/* Comments */}
        <View className="p-4">
          {Array.isArray(post.comments) && post.comments.length > 0 ? (
            post.comments.map((comment) => {
              if (!comment || !comment.id) return null;
              return (
                <View key={comment.id} className="mb-4">
                  {/* Main comment */}
                  <View className="flex-row gap-3">
                    <Image
                      source={{ uri: comment.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.username || "User")}` }}
                      style={{ width: 32, height: 32, borderRadius: 16 }}
                    />
                    <View className="flex-1">
                      <Text className="text-sm text-foreground">
                        <Text className="font-semibold text-foreground">
                          {comment.username || "User"}
                        </Text>{" "}
                        <Text className="text-foreground">{comment.text || ""}</Text>
                      </Text>
                    <Text className="mt-1 text-xs text-muted-foreground">
                      {comment.timeAgo}
                    </Text>

                      {/* Reply button */}
                      <Pressable
                        onPress={() =>
                          router.push(
                            `/(protected)/comments/${postIdString}?commentId=${comment.id}`,
                          )
                        }
                        className="mt-2"
                      >
                        <Text className="text-xs text-primary">
                          {comment.replies?.length || 0}{" "}
                          {comment.replies?.length === 1 ? "reply" : "replies"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Replies preview */}
                  {Array.isArray(comment.replies) && comment.replies.length > 0 && (
                    <View className="ml-11 mt-2">
                      {comment.replies.slice(0, 2).map((reply) => {
                        if (!reply || !reply.id) return null;
                        return (
                          <View key={reply.id} className="mb-2 flex-row gap-2">
                            <Image
                              source={{ uri: reply.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(reply.username || "User")}` }}
                              style={{ width: 24, height: 24, borderRadius: 12 }}
                            />
                            <View className="flex-1">
                              <Text className="text-sm text-foreground">
                                <Text className="font-semibold text-foreground">
                                  {reply.username || "User"}
                                </Text>{" "}
                                <Text className="text-foreground">
                                  {reply.text || ""}
                                </Text>
                              </Text>
                              <Text className="mt-1 text-xs text-muted-foreground">
                                {reply.timeAgo || "Just now"}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                      {comment.replies.length > 2 && (
                        <Pressable
                          onPress={() =>
                            router.push(
                              `/(protected)/comments/${postIdString}?commentId=${comment.id}`,
                            )
                          }
                          className="ml-7"
                        >
                          <Text className="text-xs text-muted-foreground">
                            View all {comment.replies.length} replies
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <Text className="text-center text-muted-foreground">
              No comments yet
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
