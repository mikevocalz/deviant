import { View, Text, Pressable, TextInput } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Camera, Loader2 } from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useState } from "react";
import { Image } from "expo-image";
import { useMediaPicker } from "@/lib/hooks";
import { useMediaUpload } from "@/lib/hooks/use-media-upload";
import { useUIStore } from "@/lib/stores/ui-store";

export default function EditProfileScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);

  const [name, setName] = useState(user?.name || "");
  const [username, setUsername] = useState(user?.username || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [location, setLocation] = useState(user?.location || "");
  const [website, setWebsite] = useState(user?.website || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { pickFromLibrary } = useMediaPicker();
  const { uploadSingle } = useMediaUpload({ folder: "avatars" });
  const showToast = useUIStore((s) => s.showToast);

  const handleAvatarPress = async () => {
    try {
      const result = await pickFromLibrary({
        maxSelection: 1,
        allowsMultipleSelection: false,
      });
      if (!result || result.length === 0) return;

      setIsUploading(true);
      const uploadResult = await uploadSingle(result[0].uri);

      if (uploadResult.success) {
        setAvatar(uploadResult.url);
        showToast(
          "success",
          "Success",
          "Avatar uploaded! Remember to save changes.",
        );
      } else {
        showToast(
          "error",
          "Upload Failed",
          uploadResult.error || "Could not upload avatar",
        );
      }
    } catch (error) {
      console.error("[EditProfile] Avatar upload error:", error);
      showToast("error", "Error", "Failed to upload avatar");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const { usersApi } = await import("@/lib/api/users");
      const updatedUser = await usersApi.updateProfile({
        name,
        username,
        bio,
        location,
        website,
        avatar,
      });

      // Update local store — use ?? not || so empty strings are preserved
      updateUser({
        name: updatedUser.name ?? name,
        username: updatedUser.username ?? username,
        bio: updatedUser.bio ?? bio,
        location: updatedUser.location ?? location,
        website: updatedUser.website ?? website,
        avatar: updatedUser.avatar ?? avatar,
      });

      showToast("success", "Success", "Profile updated successfully!");
      router.back();
    } catch (error) {
      console.error("[EditProfile] Save error:", error);
      showToast(
        "error",
        "Error",
        error instanceof Error ? error.message : "Failed to update profile",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <View className="flex-row items-center justify-between border-b border-border bg-background px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-4">
          <ArrowLeft size={24} color={colors.foreground} />
        </Pressable>
        <Text className="flex-1 text-lg font-semibold text-foreground">
          Edit Profile
        </Text>
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          className="rounded-lg bg-primary px-4 py-2"
        >
          {isSaving ? (
            <Loader2
              size={16}
              color={colors.primaryForeground}
              className="animate-spin"
            />
          ) : (
            <Text className="font-semibold text-primary-foreground">Save</Text>
          )}
        </Pressable>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        bottomOffset={40}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Avatar */}
        <View className="items-center py-6">
          <Pressable
            onPress={handleAvatarPress}
            disabled={isUploading}
            className="relative"
          >
            <Image
              source={{
                uri: avatar || "",
              }}
              className="h-24 w-24 rounded-[20px]"
              contentFit="cover"
            />
            <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-[8px] bg-primary">
              {isUploading ? (
                <Loader2
                  size={16}
                  color={colors.primaryForeground}
                  className="animate-spin"
                />
              ) : (
                <Camera size={16} color={colors.primaryForeground} />
              )}
            </View>
          </Pressable>
          <Text className="mt-2 text-sm text-muted-foreground">
            Tap to change avatar
          </Text>
        </View>

        {/* Form Fields */}
        <View className="gap-4 px-4">
          {/* Name */}
          <View>
            <Text className="mb-2 text-sm font-medium text-foreground">
              Name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.mutedForeground}
              className="rounded-lg border border-border bg-background px-4 py-3 text-foreground"
            />
          </View>

          {/* Username */}
          <View>
            <Text className="mb-2 text-sm font-medium text-foreground">
              Username
            </Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="username"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              className="rounded-lg border border-border bg-background px-4 py-3 text-foreground"
            />
          </View>

          {/* Bio */}
          <View>
            <Text className="mb-2 text-sm font-medium text-foreground">
              Bio
            </Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself"
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="rounded-lg border border-border bg-background px-4 py-3 text-foreground"
            />
          </View>

          {/* Location */}
          <View>
            <Text className="mb-2 text-sm font-medium text-foreground">
              Location
            </Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="City, Country"
              placeholderTextColor={colors.mutedForeground}
              className="rounded-lg border border-border bg-background px-4 py-3 text-foreground"
            />
          </View>

          {/* Website */}
          <View>
            <Text className="mb-2 text-sm font-medium text-foreground">
              Website
            </Text>
            <TextInput
              value={website}
              onChangeText={setWebsite}
              placeholder="https://yourwebsite.com"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              keyboardType="url"
              className="rounded-lg border border-border bg-background px-4 py-3 text-foreground"
            />
          </View>

          {/* Email (read-only) */}
          <View>
            <Text className="mb-2 text-sm font-medium text-foreground">
              Email
            </Text>
            <TextInput
              value={user?.email || ""}
              editable={false}
              placeholderTextColor={colors.mutedForeground}
              className="rounded-lg border border-border bg-muted px-4 py-3 text-muted-foreground"
            />
            <Text className="mt-1 text-xs text-muted-foreground">
              Email cannot be changed
            </Text>
          </View>
        </View>

        <View className="h-8" />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
