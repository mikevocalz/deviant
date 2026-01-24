import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { X, Camera } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useColorScheme } from "@/lib/hooks";
import { useProfileStore } from "@/lib/stores/profile-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useMediaUpload } from "@/lib/hooks/use-media-upload";
import { users } from "@/lib/api-client";
import { useEffect, useState } from "react";

export default function EditProfileScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [isSaving, setIsSaving] = useState(false);
  const [newAvatarUri, setNewAvatarUri] = useState<string | null>(null);
  const { uploadSingle, isUploading, progress } = useMediaUpload({
    folder: "avatars",
    userId: user?.id,
  });
  const {
    editName,
    editBio,
    editWebsite,
    setEditName,
    setEditBio,
    setEditWebsite,
  } = useProfileStore();

  const handlePickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please grant media library access to change your photo.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setNewAvatarUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error("[EditProfile] Pick avatar error:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      let avatarUrl = user.avatar;

      // Upload new avatar if selected
      if (newAvatarUri) {
        const uploadResult = await uploadSingle(newAvatarUri);
        if (uploadResult.success && uploadResult.url) {
          avatarUrl = uploadResult.url;
        } else {
          Alert.alert("Upload Failed", "Failed to upload avatar. Other changes will be saved.");
        }
      }

      // Update profile in CMS
      const updateData = {
        name: editName,
        bio: editBio,
        website: editWebsite,
        avatar: avatarUrl,
        username: user.username,
      };

      await users.updateMe(updateData);

      // Update local auth store
      setUser({
        ...user,
        name: editName,
        bio: editBio,
        website: editWebsite,
        avatar: avatarUrl,
      });
      
      router.back();
    } catch (error) {
      console.error("[EditProfile] Save error:", error);
      Alert.alert("Error", "Failed to save profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Initialize form with current user data
  useEffect(() => {
    if (user) {
      setEditName(user.name || "");
      setEditBio(user.bio || "");
      setEditWebsite(user.website || "");
    }
  }, [user, setEditName, setEditBio, setEditWebsite]);

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <X size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-lg font-semibold text-foreground">
            Edit Profile
          </Text>
          <Pressable onPress={handleSave} disabled={isSaving}>
            <Text className="text-base font-semibold text-primary">
              {isSaving ? "Saving..." : "Done"}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar Section */}
          <View className="items-center py-6">
            <Pressable onPress={handlePickAvatar} className="relative">
              <Image
                source={{
                  uri:
                    newAvatarUri ||
                    user?.avatar ||
                    "https://ui-avatars.com/api/?name=" +
                      encodeURIComponent(user?.name || "User"),
                }}
                className="w-24 h-24 rounded-full"
                contentFit="cover"
              />
              {isUploading ? (
                <View className="absolute inset-0 items-center justify-center rounded-full bg-black/50">
                  <ActivityIndicator color="#fff" />
                  <Text className="text-white text-xs mt-1">{Math.round(progress)}%</Text>
                </View>
              ) : (
                <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full bg-primary">
                  <Camera size={16} color="#fff" />
                </View>
              )}
            </Pressable>
            <Pressable onPress={handlePickAvatar} className="mt-3" disabled={isUploading}>
              <Text className="text-sm font-semibold text-primary">
                Change Photo
              </Text>
            </Pressable>
          </View>

          {/* Form Fields */}
          <View className="px-4 gap-5">
            <View>
              <Text
                style={{ color: colors.mutedForeground }}
                className="mb-2 text-xs font-medium uppercase tracking-wider"
              >
                Name
              </Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder="Your name"
                placeholderTextColor={colors.mutedForeground}
                style={{
                  color: colors.foreground,
                  borderBottomColor: colors.border,
                  borderBottomWidth: 1,
                }}
                className="pb-3 text-base"
              />
            </View>

            <View>
              <Text
                style={{ color: colors.mutedForeground }}
                className="mb-2 text-xs font-medium uppercase tracking-wider"
              >
                Bio
              </Text>
              <TextInput
                value={editBio}
                onChangeText={setEditBio}
                placeholder="Write a short bio..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                textAlignVertical="top"
                style={{
                  minHeight: 80,
                  color: colors.foreground,
                  borderBottomColor: colors.border,
                  borderBottomWidth: 1,
                }}
                className="pb-3 text-base"
              />
            </View>

            <View>
              <Text
                style={{ color: colors.mutedForeground }}
                className="mb-2 text-xs font-medium uppercase tracking-wider"
              >
                Website
              </Text>
              <TextInput
                value={editWebsite}
                onChangeText={setEditWebsite}
                placeholder="https://yourwebsite.com"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                keyboardType="url"
                style={{
                  color: colors.foreground,
                  borderBottomColor: colors.border,
                  borderBottomWidth: 1,
                }}
                className="pb-3 text-base"
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
