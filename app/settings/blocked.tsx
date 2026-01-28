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
import { ChevronLeft, UserX, AlertCircle } from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import { Image } from "expo-image";
import {
  useBlockedUsers,
  useUnblockUser,
  type BlockedUser,
} from "@/lib/hooks/use-blocks";
import { getCdnBaseUrl } from "@/lib/api-config";

const CDN_URL = getCdnBaseUrl();

function getAvatarUrl(avatar: string | null): string {
  if (!avatar) return "https://i.pravatar.cc/150?img=0";
  if (avatar.startsWith("http")) return avatar;
  return `${CDN_URL}/${avatar}`;
}

function BlockedUserRow({
  user,
  onUnblock,
  isUnblocking,
}: {
  user: BlockedUser;
  onUnblock: () => void;
  isUnblocking: boolean;
}) {
  const router = useRouter();
  const { colors } = useColorScheme();

  return (
    <Pressable
      onPress={() => router.push(`/(protected)/user/${user.username}` as any)}
      className="mb-3 flex-row items-center rounded-xl border border-border bg-card p-3 active:bg-secondary/30"
    >
      <Image
        source={{ uri: getAvatarUrl(user.avatar) }}
        style={{ width: 48, height: 48, borderRadius: 12 }}
        contentFit="cover"
      />
      <View className="ml-3 flex-1">
        <Text className="font-semibold text-foreground">{user.name}</Text>
        <Text className="text-sm text-muted-foreground">@{user.username}</Text>
      </View>
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          onUnblock();
        }}
        disabled={isUnblocking}
        className="rounded-lg bg-secondary px-4 py-2 active:bg-secondary/70"
      >
        {isUnblocking ? (
          <ActivityIndicator size="small" color={colors.foreground} />
        ) : (
          <Text className="font-semibold text-foreground">Unblock</Text>
        )}
      </Pressable>
    </Pressable>
  );
}

export default function BlockedScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { data: blockedUsers, isLoading, error, refetch } = useBlockedUsers();
  const unblockMutation = useUnblockUser();

  const handleUnblock = (blockId: string) => {
    unblockMutation.mutate(blockId);
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <Main className="flex-1">
        <View className="flex-row items-center border-b border-border px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ChevronLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="flex-1 text-lg font-semibold text-foreground">
            Blocked Accounts
          </Text>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View className="flex-1 items-center justify-center py-20">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text className="mt-4 text-muted-foreground">
                Loading blocked accounts...
              </Text>
            </View>
          ) : error ? (
            <View className="flex-1 items-center justify-center px-8 py-20">
              <View className="mb-4 rounded-full bg-destructive/10 p-4">
                <AlertCircle size={48} color={colors.destructive} />
              </View>
              <Text className="mb-2 text-lg font-semibold text-foreground">
                Failed to Load
              </Text>
              <Text className="mb-4 text-center text-sm text-muted-foreground">
                {(error as Error).message || "Something went wrong"}
              </Text>
              <Pressable
                onPress={() => refetch()}
                className="rounded-lg bg-primary px-6 py-2"
              >
                <Text className="font-semibold text-primary-foreground">
                  Try Again
                </Text>
              </Pressable>
            </View>
          ) : !blockedUsers || blockedUsers.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8 py-20">
              <View className="mb-4 rounded-full bg-secondary/50 p-4">
                <UserX size={48} color="#666" />
              </View>
              <Text className="mb-2 text-lg font-semibold text-foreground">
                No Blocked Accounts
              </Text>
              <Text className="text-center text-sm text-muted-foreground">
                When you block someone, they won't be able to find your profile,
                posts, or stories.
              </Text>
            </View>
          ) : (
            <View className="px-4 py-4">
              <Text className="mb-3 text-sm font-medium text-muted-foreground">
                {blockedUsers.length} BLOCKED{" "}
                {blockedUsers.length === 1 ? "ACCOUNT" : "ACCOUNTS"}
              </Text>
              {blockedUsers.map((user) => (
                <BlockedUserRow
                  key={user.blockId}
                  user={user}
                  onUnblock={() => handleUnblock(user.blockId)}
                  isUnblocking={
                    unblockMutation.isPending &&
                    unblockMutation.variables === user.blockId
                  }
                />
              ))}
            </View>
          )}
        </ScrollView>
      </Main>
    </SafeAreaView>
  );
}
