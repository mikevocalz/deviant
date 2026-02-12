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
import { ChevronLeft } from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import { Switch } from "@/components/ui/switch";
import {
  usePrivacySettings,
  useUpdatePrivacySettings,
  type PrivacySettings,
} from "@/lib/hooks/use-user-settings";

export default function PrivacyScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { data: settings, isLoading, error, refetch } = usePrivacySettings();
  const updateMutation = useUpdatePrivacySettings();

  const handleToggle = (key: keyof PrivacySettings, value: boolean) => {
    updateMutation.mutate({ [key]: value });
  };

  if (isLoading) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <Main className="flex-1">
          <View className="flex-row items-center border-b border-border px-4 py-3">
            <Pressable onPress={() => router.back()} className="mr-4">
              <ChevronLeft size={24} color={colors.foreground} />
            </Pressable>
            <Text className="flex-1 text-lg font-semibold text-foreground">
              Privacy
            </Text>
          </View>
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="mt-4 text-muted-foreground">
              Loading settings...
            </Text>
          </View>
        </Main>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <Main className="flex-1">
        <View className="flex-row items-center border-b border-border px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ChevronLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="flex-1 text-lg font-semibold text-foreground">
            Privacy
          </Text>
        </View>

        <ScrollView
          className="flex-1 px-4 py-6"
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-6 rounded-xl border border-border bg-card">
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1 pr-4">
                <Text className="font-semibold text-foreground">
                  Private Account
                </Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Only approved followers can see your posts
                </Text>
              </View>
              <Switch
                checked={settings?.privateAccount ?? false}
                onCheckedChange={(value) =>
                  handleToggle("privateAccount", value)
                }
              />
            </View>

            <View className="mx-4 h-px bg-border" />

            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1 pr-4">
                <Text className="font-semibold text-foreground">
                  Activity Status
                </Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Show when you were last active
                </Text>
              </View>
              <Switch
                checked={settings?.activityStatus ?? true}
                onCheckedChange={(value) =>
                  handleToggle("activityStatus", value)
                }
              />
            </View>

            <View className="mx-4 h-px bg-border" />

            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1 pr-4">
                <Text className="font-semibold text-foreground">
                  Read Receipts
                </Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Let others know when you've read their messages
                </Text>
              </View>
              <Switch
                checked={settings?.readReceipts ?? true}
                onCheckedChange={(value) => handleToggle("readReceipts", value)}
              />
            </View>

            <View className="mx-4 h-px bg-border" />

            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1 pr-4">
                <Text className="font-semibold text-foreground">
                  Show Likes Count
                </Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Display like counts on your posts
                </Text>
              </View>
              <Switch
                checked={settings?.showLikes ?? true}
                onCheckedChange={(value) => handleToggle("showLikes", value)}
              />
            </View>
          </View>

          <View className="mt-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <Text className="text-sm text-muted-foreground">
              Changes are saved automatically and will apply immediately.
            </Text>
          </View>
        </ScrollView>
      </Main>
    </SafeAreaView>
  );
}
