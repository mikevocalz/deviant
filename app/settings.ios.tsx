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
  Info,
  CheckCircle,
  ShieldCheck,
  Megaphone,
  X,
  Bug,
  Trash2,
  Fingerprint,
} from "lucide-react-native";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useAppStore } from "@/lib/stores/app-store";
import { useColorScheme } from "@/lib/hooks";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsListItem } from "@/components/settings/SettingsListItem";
import { Switch } from "@/components/ui/switch";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner-native";
import { useBiometrics } from "@/lib/hooks/use-biometrics";

export default function SettingsScreenIOS() {
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
          onPress={() => {
            if (router.canDismiss()) {
              router.dismiss();
            } else {
              router.back();
            }
          }}
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

  // Biometric authentication
  const {
    isAvailable: biometricAvailable,
    biometricType,
    isEnabled: biometricEnabled,
    isAuthenticating,
    enable: enableBiometric,
    disable: disableBiometric,
    getBiometricName,
  } = useBiometrics();

  const handleToggleBiometric = async () => {
    if (biometricEnabled) {
      // Disable biometrics
      await disableBiometric();
      toast.success(`${getBiometricName()} disabled`, {
        description: "Biometric authentication has been turned off",
      });
    } else {
      // Enable biometrics - this will prompt for authentication
      const success = await enableBiometric();
      if (success) {
        toast.success(`${getBiometricName()} enabled`, {
          description: "App will now require biometric authentication",
        });
      } else {
        toast.error("Failed to enable biometrics", {
          description: "Please check your device settings",
        });
      }
    }
  };

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
          {/* User Info Card - iOS Style */}
          {user && (
            <View className="mx-4 mt-4 rounded-lg bg-card p-4">
              <Text className="text-lg font-semibold">{user.name}</Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                {user.email}
              </Text>
            </View>
          )}

          {/* Account Settings */}
          <SettingsSection title="Account">
            <SettingsListItem
              icon={<User size={20} color="#666" />}
              label="Account Information"
              onPress={() => router.push("/settings/account" as any)}
            />
            <View className="ml-12 h-px bg-border" />
            <SettingsListItem
              icon={<Lock size={20} color="#666" />}
              label="Privacy"
              onPress={() => router.push("/settings/privacy" as any)}
            />
            <View className="ml-12 h-px bg-border" />
            <SettingsListItem
              icon={<Eye size={20} color="#666" />}
              label="Close Friends"
              onPress={() => router.push("/settings/close-friends" as any)}
            />
            <View className="ml-12 h-px bg-border" />
            <SettingsListItem
              icon={<UserX size={20} color="#666" />}
              label="Blocked"
              onPress={() => router.push("/settings/blocked" as any)}
            />
          </SettingsSection>

          {/* Security */}
          <SettingsSection title="Security">
            {biometricAvailable ? (
              <Pressable
                onPress={handleToggleBiometric}
                disabled={isAuthenticating}
                className="flex-row items-center justify-between bg-card px-4 py-3 active:bg-secondary/50"
              >
                <View className="flex-1 flex-row items-center gap-3 mr-3">
                  <Fingerprint
                    size={20}
                    color={biometricEnabled ? "#22c55e" : "#666"}
                  />
                  <View className="flex-1 shrink">
                    <Text className="text-base text-foreground">
                      {getBiometricName()}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {biometricEnabled
                        ? "App locked with biometric authentication"
                        : `Use ${getBiometricName()} to unlock the app`}
                    </Text>
                  </View>
                </View>
                {isAuthenticating ? (
                  <Text className="text-sm text-muted-foreground">
                    Verifying...
                  </Text>
                ) : (
                  <Switch
                    checked={biometricEnabled}
                    onCheckedChange={handleToggleBiometric}
                  />
                )}
              </Pressable>
            ) : (
              <View className="bg-card px-4 py-3">
                <View className="flex-row items-center gap-3">
                  <Fingerprint size={20} color="#999" />
                  <View className="flex-1">
                    <Text className="text-base text-muted-foreground">
                      Biometrics Not Available
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      Set up Face ID or Touch ID in device settings
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </SettingsSection>

          {/* Notifications & Interactions */}
          <SettingsSection title="Notifications">
            <SettingsListItem
              icon={<Bell size={20} color="#666" />}
              label="Push Notifications"
              onPress={() => router.push("/settings/notifications" as any)}
            />
            <View className="ml-12 h-px bg-border" />
            <SettingsListItem
              icon={<MessageCircle size={20} color="#666" />}
              label="Messages"
              onPress={() => router.push("/settings/messages" as any)}
            />
            <View className="ml-12 h-px bg-border" />
            <SettingsListItem
              icon={<Heart size={20} color="#666" />}
              label="Likes and Comments"
              onPress={() => router.push("/settings/likes-comments" as any)}
            />
          </SettingsSection>

          {/* Content & Display */}
          <SettingsSection title="Content">
            <SettingsListItem
              icon={<Archive size={20} color="#666" />}
              label="Archived"
              onPress={() => router.push("/settings/archived" as any)}
            />
            <View className="ml-12 h-px bg-border" />
            <View className="flex-row items-center justify-between bg-card px-4 py-3">
              <View className="flex-row items-center gap-3">
                <Text style={{ fontSize: 20 }}>😈</Text>
                <View>
                  <Text className="text-base text-foreground">
                    Show Spicy Content
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Display mature content in feed
                  </Text>
                </View>
              </View>
              <Switch checked={nsfwEnabled} onCheckedChange={setNsfwEnabled} />
            </View>
            <View className="ml-12 h-px bg-border" />
            <SettingsListItem
              icon={<Moon size={20} color="#666" />}
              label="Theme"
              value="System"
              onPress={() => router.push("/settings/theme" as any)}
            />
            <View className="ml-12 h-px bg-border" />
            <SettingsListItem
              icon={<Globe size={20} color="#666" />}
              label="Language"
              value="English"
              onPress={() => router.push("/settings/language" as any)}
            />
          </SettingsSection>

          {/* About DVNT */}
          <SettingsSection title="About DVNT">
            <SettingsListItem
              icon={<Info size={20} color="#666" />}
              label="About / Community Focus"
              onPress={() => router.push("/settings/about")}
            />
            <View className="ml-12 h-px bg-border" />
            <SettingsListItem
              icon={<CheckCircle size={20} color="#666" />}
              label="Eligibility Criteria"
              onPress={() => router.push("/settings/eligibility")}
            />
            <View className="ml-12 h-px bg-border" />
            <SettingsListItem
              icon={<ShieldCheck size={20} color="#666" />}
              label="Identity Protection"
              onPress={() => router.push("/settings/identity-protection")}
            />
          </SettingsSection>

          {/* Legal & Policies */}
          <SettingsSection title="Legal & Policies">
            <SettingsListItem
              icon={<Shield size={20} color="#666" />}
              label="Privacy Policy"
              onPress={() => router.push("/settings/privacy-policy")}
            />
            <View className="ml-12 h-px bg-border" />
            <SettingsListItem
              icon={<FileText size={20} color="#666" />}
              label="Terms of Service"
              onPress={() => router.push("/settings/terms")}
            />
            <View className="ml-12 h-px bg-border" />
            <SettingsListItem
              icon={<FileText size={20} color="#666" />}
              label="Community Standards"
              onPress={() => router.push("/settings/community-guidelines")}
            />
            <View className="ml-12 h-px bg-border" />
            <SettingsListItem
              icon={<Megaphone size={20} color="#666" />}
              label="Advertising Policy"
              onPress={() => router.push("/settings/ad-policy")}
            />
          </SettingsSection>

          {/* Support */}
          <SettingsSection title="Support">
            <SettingsListItem
              icon={<HelpCircle size={20} color="#666" />}
              label="Help Center / FAQ"
              onPress={() => router.push("/settings/faq")}
            />
          </SettingsSection>

          {/* Developer */}
          {__DEV__ && (
            <SettingsSection title="Developer">
              <SettingsListItem
                icon={<Bug size={20} color="#f97316" />}
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
              className="flex-row items-center gap-3 bg-card px-4 py-3 active:bg-secondary/50"
            >
              <Trash2 size={20} color="#ef4444" />
              <Text className="text-base text-destructive">
                {isDeleting ? "Deleting..." : "Delete Account"}
              </Text>
            </Pressable>
          </SettingsSection>

          {/* Logout Button - iOS Style */}
          <View className="mx-4 mb-4 mt-2 overflow-hidden rounded-lg">
            <Pressable
              onPress={handleLogout}
              className="flex-row items-center justify-center gap-2 bg-card py-3 active:bg-secondary/50"
            >
              <LogOut size={20} color="#ef4444" />
              <Text className="font-semibold text-destructive">Log Out</Text>
            </Pressable>
          </View>

          {/* App Version */}
          <View className="items-center pb-8 pt-4">
            <Text className="text-xs text-muted-foreground">Version 1.0.0</Text>
          </View>
        </ScrollView>
      </Main>
    </SafeAreaView>
  );
}
