
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { Image } from "expo-image";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { X, Camera } from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import { useProfileStore } from "@/lib/stores/profile-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useEffect } from "react";

export default function EditProfileScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const user = useAuthStore((state) => state.user);
  const {
    editName,
    editBio,
    editWebsite,
    setEditName,
    setEditBio,
    setEditWebsite,
  } = useProfileStore();

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
          <Pressable onPress={() => router.back()}>
            <Text className="text-base font-semibold text-primary">Done</Text>
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
            <View className="relative">
              <Image
                source={{
                  uri:
                    user?.avatar ||
                    "https://ui-avatars.com/api/?name=" +
                      encodeURIComponent(user?.name || "User"),
                }}
                className="w-24 h-24 rounded-full"
                contentFit="cover"
              />
              <Pressable className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full bg-primary">
                <Camera size={16} color="#fff" />
              </Pressable>
            </View>
            <Pressable className="mt-3">
              <Text className="text-sm font-semibold text-primary">
                Change Photo
              </Text>
            </Pressable>
          </View>

          {/* Form Fields */}
          <View className="px-4 gap-5">
            <View>
              <Text className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Name
              </Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder="Your name"
                placeholderTextColor={colors.mutedForeground}
                className="border-b border-border pb-3 text-base text-foreground"
              />
            </View>

            <View>
              <Text className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Bio
              </Text>
              <TextInput
                value={editBio}
                onChangeText={setEditBio}
                placeholder="Write a short bio..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                textAlignVertical="top"
                style={{ minHeight: 80 }}
                className="border-b border-border pb-3 text-base text-foreground"
              />
            </View>

            <View>
              <Text className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Website
              </Text>
              <TextInput
                value={editWebsite}
                onChangeText={setEditWebsite}
                placeholder="https://yourwebsite.com"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                keyboardType="url"
                className="border-b border-border pb-3 text-base text-foreground"
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
