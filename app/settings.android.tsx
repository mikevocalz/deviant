import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Main } from "@expo/html-elements";
import { useRouter, useNavigation } from "expo-router";
import { useLayoutEffect, useState } from "react";
import {
  User,
  Bell,
  Lock,
  HelpCircle,
  Shield,
  FileText,
  LogOut,
  Moon,
  Globe,
  Archive,
  Heart,
  UserX,
  MessageCircle,
  Eye,
  EyeOff,
  X,
  Info,
  CheckCircle,
  ShieldCheck,
  Megaphone,
  Bug,
  Trash2,
} from "lucide-react-native";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useAppStore } from "@/lib/stores/app-store";
import { useColorScheme } from "@/lib/hooks";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsListItem } from "@/components/settings/SettingsListItem";
import { Switch } from "@/components/ui/switch";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner-native";

export default function SettingsScreenAndroid() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useColorScheme();
  const { user, logout } = useAuthStore();
  const { nsfwEnabled, setNsfwEnabled } = useAppStore();

  // Set up header with useLayoutEffect
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: "Settings",
      headerTitleAlign: "left" as const,
      headerStyle: {
        backgroundColor: colors.background,
      },
      headerTitleStyle: {
        color: colors.foreground,
        fontWeight: "600" as const,
        fontSize: 18,
      },
      headerLeft: () => null,
      headerRight: () => (
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={{
            marginRight: 8,
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={24} color={colors.foreground} />
        </Pressable>
      ),
    });
  }, [navigation, colors, router]);

  const [isDeleting, setIsDeleting] = useState(false);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be lost.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, I'm sure",
          style: "destructive",
          onPress: () => {
            // Second confirmation
            Alert.alert(
              "Final Confirmation",
              "This is your last chance. Your account and all associated data will be permanently deleted.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete My Account",
                  style: "destructive",
                  onPress: async () => {
                    setIsDeleting(true);
                    try {
                      const { error } = await authClient.deleteUser();
                      if (error) {
                        toast.error("Failed to delete account", {
                          description: error.message || "Please try again",
                        });
                      } else {
                        toast.success("Account deleted", {
                          description:
                            "Your account has been permanently deleted",
                        });
                        logout();
                        router.replace("/login");
                      }
                    } catch (err: any) {
                      toast.error("Error", {
                        description: err?.message || "Something went wrong",
                      });
                    } finally {
                      setIsDeleting(false);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <Main className="flex-1">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* User Info - Material Design Style */}
          {user && (
            <View className="border-b border-border px-4 py-6">
              <Text className="text-xl font-semibold">{user.name}</Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                {user.email}
              </Text>
            </View>
          )}

          {/* Account Settings */}
          <SettingsSection title="Account">
            <SettingsListItem
              icon={<User size={22} color="#666" />}
              label="Account Information"
              onPress={() => router.push("/settings/account" as any)}
            />
            <SettingsListItem
              icon={<Lock size={22} color="#666" />}
              label="Privacy"
              onPress={() => router.push("/settings/privacy" as any)}
            />
            <SettingsListItem
              icon={<Eye size={22} color="#666" />}
              label="Close Friends"
              onPress={() => router.push("/settings/close-friends" as any)}
            />
            <SettingsListItem
              icon={<UserX size={22} color="#666" />}
              label="Blocked"
              onPress={() => router.push("/settings/blocked" as any)}
            />
          </SettingsSection>

          {/* Notifications & Interactions */}
          <SettingsSection title="Notifications">
            <SettingsListItem
              icon={<Bell size={22} color="#666" />}
              label="Push Notifications"
              onPress={() => router.push("/settings/notifications" as any)}
            />
            <SettingsListItem
              icon={<MessageCircle size={22} color="#666" />}
              label="Messages"
              onPress={() => router.push("/settings/messages" as any)}
            />
            <SettingsListItem
              icon={<Heart size={22} color="#666" />}
              label="Likes and Comments"
              onPress={() => router.push("/settings/likes-comments" as any)}
            />
          </SettingsSection>

          {/* Content & Display */}
          <SettingsSection title="Content & Display">
            <SettingsListItem
              icon={<Archive size={22} color="#666" />}
              label="Archived"
              onPress={() => router.push("/settings/archived" as any)}
            />
            <View className="flex-row items-center justify-between px-4 py-3">
              <View className="flex-row items-center gap-3">
                <EyeOff size={22} color="#666" />
                <View>
                  <Text className="text-base text-foreground">
                    Show NSFW Content
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Display sensitive content in feed
                  </Text>
                </View>
              </View>
              <Switch checked={nsfwEnabled} onCheckedChange={setNsfwEnabled} />
            </View>
            <SettingsListItem
              icon={<Moon size={22} color="#666" />}
              label="Theme"
              value="System"
              onPress={() => router.push("/settings/theme" as any)}
            />
            <SettingsListItem
              icon={<Globe size={22} color="#666" />}
              label="Language"
              value="English"
              onPress={() => router.push("/settings/language" as any)}
            />
          </SettingsSection>

          {/* About DVNT */}
          <SettingsSection title="About DVNT">
            <SettingsListItem
              icon={<Info size={22} color="#666" />}
              label="About / Community Focus"
              onPress={() => router.push("/settings/about")}
            />
            <SettingsListItem
              icon={<CheckCircle size={22} color="#666" />}
              label="Eligibility Criteria"
              onPress={() => router.push("/settings/eligibility")}
            />
            <SettingsListItem
              icon={<ShieldCheck size={22} color="#666" />}
              label="Identity Protection"
              onPress={() => router.push("/settings/identity-protection")}
            />
          </SettingsSection>

          {/* Legal & Policies */}
          <SettingsSection title="Legal & Policies">
            <SettingsListItem
              icon={<Shield size={22} color="#666" />}
              label="Privacy Policy"
              onPress={() => router.push("/settings/privacy-policy")}
            />
            <SettingsListItem
              icon={<FileText size={22} color="#666" />}
              label="Terms of Service"
              onPress={() => router.push("/settings/terms")}
            />
            <SettingsListItem
              icon={<FileText size={22} color="#666" />}
              label="Community Standards"
              onPress={() => router.push("/settings/community-guidelines")}
            />
            <SettingsListItem
              icon={<Megaphone size={22} color="#666" />}
              label="Advertising Policy"
              onPress={() => router.push("/settings/ad-policy")}
            />
          </SettingsSection>

          {/* Support */}
          <SettingsSection title="Support">
            <SettingsListItem
              icon={<HelpCircle size={22} color="#666" />}
              label="Help Center / FAQ"
              onPress={() => router.push("/settings/faq")}
            />
          </SettingsSection>

          {/* Developer */}
          {__DEV__ && (
            <SettingsSection title="Developer">
              <SettingsListItem
                icon={<Bug size={22} color="#f97316" />}
                label="Network Debug"
                onPress={() => router.push("/(protected)/debug" as any)}
              />
            </SettingsSection>
          )}

          {/* Danger Zone */}
          <SettingsSection title="Danger Zone">
            <Pressable
              onPress={handleDeleteAccount}
              disabled={isDeleting}
              className="flex-row items-center gap-3 px-4 py-3 active:bg-secondary/50"
            >
              <Trash2 size={22} color="#ef4444" />
              <Text className="text-base text-destructive">
                {isDeleting ? "Deleting..." : "Delete Account"}
              </Text>
            </Pressable>
          </SettingsSection>

          {/* Logout Button - Material Design Style */}
          <View className="px-4 py-6">
            <Pressable
              onPress={handleLogout}
              className="flex-row items-center justify-center gap-2 rounded-lg border border-destructive bg-destructive/10 py-3 active:bg-destructive/20"
            >
              <LogOut size={20} color="#ef4444" />
              <Text className="font-semibold text-destructive">Log Out</Text>
            </Pressable>
          </View>

          {/* App Version */}
          <View className="items-center pb-8">
            <Text className="text-xs text-muted-foreground">
              Version 1.0.0 Build 1
            </Text>
          </View>
        </ScrollView>
      </Main>
    </SafeAreaView>
  );
}
