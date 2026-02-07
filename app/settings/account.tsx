import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Main } from "@expo/html-elements";
import { useRouter } from "expo-router";
import { ChevronLeft, Mail, Phone, Trash2, Pencil } from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usersApi } from "@/lib/api/users";
import { useState, useCallback } from "react";
import { toast } from "sonner-native";
import { authClient } from "@/lib/auth-client";

export default function AccountScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { user, setUser, logout } = useAuthStore();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setIsSaving(true);
    try {
      await usersApi.updateProfile({ name: name.trim() });
      if (user) {
        setUser({ ...user, name: name.trim() });
      }
      setIsEditing(false);
      toast.success("Profile updated");
    } catch (error: any) {
      toast.error("Failed to save", {
        description: error?.message || "Please try again",
      });
    } finally {
      setIsSaving(false);
    }
  }, [name, user, setUser]);

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
                        toast.success("Account deleted");
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
        <View className="flex-row items-center border-b border-border px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ChevronLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="flex-1 text-lg font-semibold text-foreground">
            Account Information
          </Text>
          {isEditing ? (
            <Pressable onPress={handleSave} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text className="font-semibold text-primary">Save</Text>
              )}
            </Pressable>
          ) : (
            <Pressable onPress={() => setIsEditing(true)}>
              <Pencil size={20} color={colors.foreground} />
            </Pressable>
          )}
        </View>

        <ScrollView
          className="flex-1 px-4 py-6"
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-6 rounded-lg border border-border bg-card p-4">
            <Text className="mb-4 text-lg font-semibold text-foreground">
              Personal Information
            </Text>

            <View className="mb-4">
              <Text className="mb-2 text-sm text-muted-foreground">Name</Text>
              {isEditing ? (
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={colors.mutedForeground}
                  className="rounded-lg border border-primary/50 bg-secondary/30 px-4 py-3 text-foreground"
                  autoFocus
                />
              ) : (
                <View className="flex-row items-center rounded-lg border border-border bg-secondary/30 px-4 py-3">
                  <Text className="flex-1 text-foreground">
                    {user?.name || "Not set"}
                  </Text>
                </View>
              )}
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-sm text-muted-foreground">
                Username
              </Text>
              <View className="flex-row items-center rounded-lg border border-border bg-secondary/30 px-4 py-3">
                <Text className="flex-1 text-foreground">
                  @{user?.username || "Not set"}
                </Text>
              </View>
              <Text className="mt-1 text-xs text-muted-foreground">
                Username can be changed from Edit Profile
              </Text>
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-sm text-muted-foreground">Email</Text>
              <View className="flex-row items-center gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3">
                <Mail size={18} color="#666" />
                <Text className="flex-1 text-foreground">
                  {user?.email || "Not set"}
                </Text>
              </View>
            </View>

            <View>
              <Text className="mb-2 text-sm text-muted-foreground">Phone</Text>
              <View className="flex-row items-center gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3">
                <Phone size={18} color="#666" />
                <Text className="flex-1 text-muted-foreground">Not linked</Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={handleDeleteAccount}
            disabled={isDeleting}
            className="flex-row items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 py-4 active:bg-destructive/20"
          >
            <Trash2 size={20} color="#ef4444" />
            <Text className="font-semibold text-destructive">
              {isDeleting ? "Deleting..." : "Delete Account"}
            </Text>
          </Pressable>

          <Text className="mt-4 text-center text-xs text-muted-foreground">
            Deleting your account is permanent and cannot be undone.
          </Text>
        </ScrollView>
      </Main>
    </SafeAreaView>
  );
}
