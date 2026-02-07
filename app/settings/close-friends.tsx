import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Main } from "@expo/html-elements";
import { useRouter } from "expo-router";
import { ChevronLeft, Star, Users } from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import { Image } from "expo-image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { requireBetterAuthToken } from "@/lib/auth/identity";
import { useAuthStore } from "@/lib/stores/auth-store";
import { settingsKeys } from "@/lib/hooks/use-user-settings";
import { toast } from "sonner-native";

const CDN_URL =
  process.env.EXPO_PUBLIC_BUNNY_CDN_URL || "https://dvnt.b-cdn.net";

function getAvatarUrl(avatar: string | null): string {
  if (!avatar)
    return "https://ui-avatars.com/api/?name=U&background=1c1c1c&color=f5f5f4";
  if (avatar.startsWith("http")) return avatar;
  return `${CDN_URL}/${avatar}`;
}

interface CloseFriend {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
}

function useCloseFriends() {
  const { user } = useAuthStore();
  return useQuery<CloseFriend[]>({
    queryKey: ["close-friends", user?.id],
    queryFn: async () => {
      const token = await requireBetterAuthToken();
      const { data, error } = await supabase.functions.invoke<{
        ok: boolean;
        data?: { settings: Record<string, unknown> };
      }>("user-settings", {
        body: { action: "get" },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error || !data?.ok) return [];
      const ids: string[] = (data?.data?.settings as any)?.closeFriendIds || [];
      if (ids.length === 0) return [];

      // Fetch user details for each close friend ID
      const { data: users } = await supabase
        .from("users")
        .select("id, name, username, avatar_url")
        .in("id", ids.map(Number));

      return (users || []).map((u: any) => ({
        id: String(u.id),
        name: u.name || "",
        username: u.username || "",
        avatar: u.avatar_url || null,
      }));
    },
    enabled: !!user?.id,
  });
}

function useRemoveCloseFriend() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (friendId: string) => {
      const token = await requireBetterAuthToken();
      // Get current list
      const { data: current } = await supabase.functions.invoke<{
        ok: boolean;
        data?: { settings: Record<string, unknown> };
      }>("user-settings", {
        body: { action: "get" },
        headers: { Authorization: `Bearer ${token}` },
      });
      const ids: string[] =
        (current?.data?.settings as any)?.closeFriendIds || [];
      const updated = ids.filter((id) => id !== friendId);

      await supabase.functions.invoke("user-settings", {
        body: { action: "update", settings: { closeFriendIds: updated } },
        headers: { Authorization: `Bearer ${token}` },
      });
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["close-friends", user?.id] });
      queryClient.invalidateQueries({
        queryKey: settingsKeys.all(user?.id || ""),
      });
      toast.success("Removed from close friends");
    },
    onError: () => {
      toast.error("Failed to remove");
    },
  });
}

export default function CloseFriendsScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { data: closeFriends, isLoading } = useCloseFriends();
  const removeMutation = useRemoveCloseFriend();

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <Main className="flex-1">
        <View className="flex-row items-center border-b border-border px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ChevronLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="flex-1 text-lg font-semibold text-foreground">
            Close Friends
          </Text>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="px-4 py-4">
            <View className="mb-4 flex-row items-center gap-3 rounded-lg bg-primary/10 p-4">
              <Star size={24} color={colors.primary} fill={colors.primary} />
              <View className="flex-1">
                <Text className="font-semibold text-foreground">
                  Close Friends
                </Text>
                <Text className="text-sm text-muted-foreground">
                  Share stories exclusively with your close friends
                </Text>
              </View>
            </View>
          </View>

          {isLoading ? (
            <View className="flex-1 items-center justify-center py-20">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : !closeFriends || closeFriends.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8 py-20">
              <View className="mb-4 rounded-full bg-secondary/50 p-4">
                <Users size={48} color="#666" />
              </View>
              <Text className="mb-2 text-lg font-semibold text-foreground">
                No Close Friends Yet
              </Text>
              <Text className="text-center text-sm text-muted-foreground">
                Add close friends from their profile page to share exclusive
                stories with them.
              </Text>
            </View>
          ) : (
            <View className="px-4">
              <Text className="mb-3 text-sm font-semibold text-muted-foreground">
                {closeFriends.length} CLOSE{" "}
                {closeFriends.length === 1 ? "FRIEND" : "FRIENDS"}
              </Text>

              {closeFriends.map((friend) => (
                <Pressable
                  key={friend.id}
                  onPress={() =>
                    router.push(`/(protected)/user/${friend.username}` as any)
                  }
                  className="mb-3 flex-row items-center rounded-lg border border-border bg-card p-3 active:bg-secondary/30"
                >
                  <Image
                    source={{ uri: getAvatarUrl(friend.avatar) }}
                    style={{ width: 48, height: 48, borderRadius: 24 }}
                    contentFit="cover"
                  />
                  <View className="ml-3 flex-1">
                    <Text className="font-semibold text-foreground">
                      {friend.name}
                    </Text>
                    <Text className="text-sm text-muted-foreground">
                      @{friend.username}
                    </Text>
                  </View>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      removeMutation.mutate(friend.id);
                    }}
                    className="rounded-full bg-secondary/50 p-2"
                  >
                    <Star
                      size={18}
                      color={colors.primary}
                      fill={colors.primary}
                    />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          )}

          <View className="mt-6 px-4 pb-8">
            <Text className="text-center text-sm text-muted-foreground">
              People won't be notified when you add or remove them from your
              close friends list.
            </Text>
          </View>
        </ScrollView>
      </Main>
    </SafeAreaView>
  );
}
