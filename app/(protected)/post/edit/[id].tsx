import { View, Text, ScrollView, Pressable, TextInput, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Loader2 } from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import { useState, useEffect } from "react";
import { usePost } from "@/lib/hooks/use-posts";
import { getAuthToken } from "@/lib/auth-client";

export default function EditPostScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = id ? String(id) : "";
  
  const { data: post, isLoading } = usePost(postId);
  
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (post) {
      setCaption(post.caption || "");
      setLocation(post.location || "");
    }
  }, [post]);

  const handleSave = async () => {
    if (!postId) return;

    setIsSaving(true);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) throw new Error("API URL not configured");

      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(`${apiUrl}/api/posts/${postId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          caption,
          location: location || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Update failed: ${response.status}`);
      }

      Alert.alert("Success", "Post updated successfully!");
      router.back();
    } catch (error) {
      console.error("[EditPost] Save error:", error);
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to update post");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const apiUrl = process.env.EXPO_PUBLIC_API_URL;
              if (!apiUrl) throw new Error("API URL not configured");

              const token = await getAuthToken();
              if (!token) throw new Error("Not authenticated");

              const response = await fetch(`${apiUrl}/api/posts/${postId}`, {
                method: "DELETE",
                headers: {
                  "Authorization": `Bearer ${token}`,
                },
              });

              if (!response.ok) {
                throw new Error(`Delete failed: ${response.status}`);
              }

              Alert.alert("Success", "Post deleted successfully!");
              router.replace("/(protected)/(tabs)/profile");
            } catch (error) {
              console.error("[EditPost] Delete error:", error);
              Alert.alert("Error", error instanceof Error ? error.message : "Failed to delete post");
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <Loader2 size={32} color={colors.foreground} className="animate-spin" />
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-muted-foreground">Post not found</Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-4 rounded-lg bg-primary px-4 py-2"
          >
            <Text className="font-semibold text-primary-foreground">Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <View className="flex-row items-center justify-between border-b border-border bg-background px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-4">
          <ArrowLeft size={24} color={colors.foreground} />
        </Pressable>
        <Text className="flex-1 text-lg font-semibold text-foreground">
          Edit Post
        </Text>
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          className="rounded-lg bg-primary px-4 py-2"
        >
          {isSaving ? (
            <Loader2 size={16} color={colors.primaryForeground} className="animate-spin" />
          ) : (
            <Text className="font-semibold text-primary-foreground">Save</Text>
          )}
        </Pressable>
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Caption */}
        <View className="mb-4">
          <Text className="mb-2 text-sm font-medium text-foreground">Caption</Text>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Write a caption..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            className="rounded-lg border border-border bg-background px-4 py-3 text-foreground"
          />
        </View>

        {/* Location */}
        <View className="mb-6">
          <Text className="mb-2 text-sm font-medium text-foreground">Location</Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Add location..."
            placeholderTextColor={colors.mutedForeground}
            className="rounded-lg border border-border bg-background px-4 py-3 text-foreground"
          />
        </View>

        {/* Delete Button */}
        <Pressable
          onPress={handleDelete}
          className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3"
        >
          <Text className="text-center font-semibold text-destructive">
            Delete Post
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
