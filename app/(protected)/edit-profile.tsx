import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import {
  KeyboardAwareScrollView,
  KeyboardAvoidingView,
} from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import {
  X,
  Camera,
  ChevronRight,
  Link as LinkIcon,
  Plus,
  Trash2,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useColorScheme } from "@/lib/hooks";
import { useProfileStore } from "@/lib/stores/profile-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useMediaUpload } from "@/lib/hooks/use-media-upload";
import { usersApi } from "@/lib/api/users";
import { useUIStore } from "@/lib/stores/ui-store";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { appendCacheBuster } from "@/lib/media/resolveAvatarUrl";

const PRONOUNS_OPTIONS = [
  "He/Him",
  "She/Her",
  "They/Them",
  "He/They",
  "She/They",
  "Ze/Zir",
  "Custom",
];

const GENDER_OPTIONS = [
  "Male",
  "Female",
  "Non-binary",
  "Prefer not to say",
  "Custom",
];

export default function EditProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useColorScheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const showToast = useUIStore((s) => s.showToast);
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
    editLocation,
    setEditName,
    setEditBio,
    setEditWebsite,
    setEditLocation,
  } = useProfileStore();

  // Local-only fields (not yet persisted to DB)
  const [username, setUsername] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [gender, setGender] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [newLink, setNewLink] = useState("");
  const [showPronouns, setShowPronouns] = useState(false);
  const [showGender, setShowGender] = useState(false);

  const handlePickAvatar = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        showToast(
          "error",
          "Permission Required",
          "Please grant media library access to change your photo.",
        );
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
      showToast("error", "Error", "Failed to pick image. Please try again.");
    }
  };

  const addLink = () => {
    const trimmed = newLink.trim();
    if (!trimmed) return;
    if (links.length >= 5) {
      showToast("warning", "Limit", "You can add up to 5 links");
      return;
    }
    setLinks((prev) => [...prev, trimmed]);
    setNewLink("");
  };

  const removeLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!user) {
      showToast("error", "Error", "User not found");
      return;
    }

    setIsSaving(true);

    try {
      let avatarUrl = user.avatar;

      // Upload new avatar if selected
      if (newAvatarUri) {
        try {
          const uploadResult = await uploadSingle(newAvatarUri);
          if (uploadResult.success && uploadResult.url) {
            // CRITICAL: Cache-bust so expo-image re-downloads the new image
            avatarUrl = appendCacheBuster(uploadResult.url) || uploadResult.url;
          } else {
            showToast(
              "warning",
              "Upload Issue",
              "Avatar upload failed. Other changes will be saved.",
            );
          }
        } catch (uploadError) {
          console.error("[EditProfile] Avatar upload exception:", uploadError);
          showToast(
            "warning",
            "Upload Issue",
            "Avatar upload failed. Other changes will be saved.",
          );
        }
      }

      const updateData: {
        name?: string;
        bio?: string;
        website?: string;
        location?: string;
        avatar?: string;
      } = {
        name: editName.trim(),
        bio: editBio.trim(),
        website: editWebsite.trim(),
        location: editLocation.trim(),
        ...(avatarUrl ? { avatar: avatarUrl } : {}),
      };

      console.log(
        "[EditProfile] Updating profile:",
        JSON.stringify(updateData),
      );

      const updatedUser = await usersApi.updateProfile(updateData);
      console.log("[EditProfile] Profile updated:", updatedUser);

      // Update local auth store
      setUser({
        ...user,
        name: editName.trim() || user.name,
        bio: editBio.trim() || user.bio,
        website: editWebsite.trim() || user.website,
        location: editLocation.trim() || user.location,
        avatar: avatarUrl || user.avatar,
      });

      // CRITICAL: Patch all caches where MY avatar appears
      if (avatarUrl && avatarUrl !== user.avatar) {
        const patchStories = (old: any) => {
          if (!old || !Array.isArray(old)) return old;
          return old.map((story: any) => {
            if (
              String(story.userId) === String(user.id) ||
              story.username === user.username
            ) {
              return { ...story, avatar: avatarUrl };
            }
            return story;
          });
        };
        queryClient.setQueryData(["stories"], patchStories);
        queryClient.setQueryData(["stories", "list"], patchStories);
      }

      // Invalidate the current user's profile cache
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      }
      if (user?.username) {
        queryClient.invalidateQueries({
          queryKey: ["profile", "username", user.username],
        });
      }

      showToast("success", "Saved", "Profile updated successfully");
      navigation.goBack();
    } catch (error: any) {
      console.error("[EditProfile] Save error:", error);
      const errorMessage =
        error?.message || "Failed to save profile. Please try again.";
      showToast("error", "Error", errorMessage);
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
      setEditLocation(user.location || "");
      setUsername(user.username || "");
    }
  }, [user, setEditName, setEditBio, setEditWebsite, setEditLocation]);

  // Shared row style
  const rowStyle = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  };

  const labelStyle = {
    fontSize: 15,
    color: colors.foreground,
    width: 100,
  };

  const inputStyle = {
    flex: 1,
    fontSize: 15,
    color: colors.foreground,
    textAlign: "right" as const,
    paddingVertical: 0,
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Text style={{ fontSize: 16, color: colors.foreground }}>
              Cancel
            </Text>
          </Pressable>
          <Text
            style={{
              fontSize: 17,
              fontWeight: "600",
              color: colors.foreground,
            }}
          >
            Edit Profile
          </Text>
          <Pressable onPress={handleSave} disabled={isSaving} hitSlop={12}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: isSaving ? colors.mutedForeground : colors.primary,
              }}
            >
              {isSaving ? "Saving..." : "Done"}
            </Text>
          </Pressable>
        </View>

        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bottomOffset={100}
        >
          {/* Avatar Section */}
          <View style={{ alignItems: "center", paddingVertical: 24 }}>
            <Pressable
              onPress={handlePickAvatar}
              style={{ position: "relative" }}
            >
              <Avatar
                uri={newAvatarUri || user?.avatar || ""}
                username={user?.username || "User"}
                size={96}
                variant="roundedSquare"
              />
              {isUploading ? (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: 20,
                    backgroundColor: "rgba(0,0,0,0.5)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ActivityIndicator color="#fff" />
                  <Text style={{ color: "#fff", fontSize: 11, marginTop: 4 }}>
                    {Math.round(progress)}%
                  </Text>
                </View>
              ) : (
                <View
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 3,
                    borderColor: colors.background,
                  }}
                >
                  <Camera size={14} color="#fff" />
                </View>
              )}
            </Pressable>
            <Pressable
              onPress={handlePickAvatar}
              disabled={isUploading}
              style={{ marginTop: 12 }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: colors.primary,
                }}
              >
                Change Photo
              </Text>
            </Pressable>
          </View>

          {/* Profile Info Card */}
          <View style={{ paddingHorizontal: 16 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: colors.mutedForeground,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                marginBottom: 8,
              }}
            >
              About You
            </Text>
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                paddingHorizontal: 16,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              {/* Name */}
              <View style={rowStyle}>
                <Text style={labelStyle}>Name</Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Your name"
                  placeholderTextColor={colors.mutedForeground}
                  style={inputStyle}
                  maxLength={100}
                />
              </View>

              {/* Username */}
              <View style={rowStyle}>
                <Text style={labelStyle}>Username</Text>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="username"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  style={inputStyle}
                  editable={false}
                />
              </View>

              {/* Pronouns */}
              <Pressable
                style={rowStyle}
                onPress={() => setShowPronouns(!showPronouns)}
              >
                <Text style={labelStyle}>Pronouns</Text>
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      color: pronouns
                        ? colors.foreground
                        : colors.mutedForeground,
                    }}
                  >
                    {pronouns || "Add pronouns"}
                  </Text>
                  <ChevronRight size={16} color={colors.mutedForeground} />
                </View>
              </Pressable>

              {showPronouns && (
                <View
                  style={{
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    {PRONOUNS_OPTIONS.map((option) => (
                      <Pressable
                        key={option}
                        onPress={() => {
                          setPronouns(option === pronouns ? "" : option);
                          if (option !== "Custom") setShowPronouns(false);
                        }}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 20,
                          backgroundColor:
                            pronouns === option ? colors.primary : colors.muted,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "500",
                            color:
                              pronouns === option ? "#fff" : colors.foreground,
                          }}
                        >
                          {option}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {pronouns === "Custom" && (
                    <TextInput
                      value={pronouns === "Custom" ? "" : pronouns}
                      onChangeText={setPronouns}
                      placeholder="Enter your pronouns"
                      placeholderTextColor={colors.mutedForeground}
                      style={{
                        fontSize: 14,
                        color: colors.foreground,
                        marginTop: 8,
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      }}
                    />
                  )}
                </View>
              )}

              {/* Bio */}
              <View style={{ ...rowStyle, alignItems: "flex-start" }}>
                <Text style={{ ...labelStyle, paddingTop: 2 }}>Bio</Text>
                <TextInput
                  value={editBio}
                  onChangeText={setEditBio}
                  placeholder="Write something about yourself..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  textAlignVertical="top"
                  maxLength={150}
                  style={{
                    ...inputStyle,
                    minHeight: 60,
                    textAlign: "right" as const,
                  }}
                />
              </View>

              {/* Gender */}
              <Pressable
                style={{ ...rowStyle, borderBottomWidth: 0 }}
                onPress={() => setShowGender(!showGender)}
              >
                <Text style={labelStyle}>Gender</Text>
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      color: gender
                        ? colors.foreground
                        : colors.mutedForeground,
                    }}
                  >
                    {gender || "Prefer not to say"}
                  </Text>
                  <ChevronRight size={16} color={colors.mutedForeground} />
                </View>
              </Pressable>

              {showGender && (
                <View style={{ paddingBottom: 12 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    {GENDER_OPTIONS.map((option) => (
                      <Pressable
                        key={option}
                        onPress={() => {
                          setGender(option === gender ? "" : option);
                          if (option !== "Custom") setShowGender(false);
                        }}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 20,
                          backgroundColor:
                            gender === option ? colors.primary : colors.muted,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "500",
                            color:
                              gender === option ? "#fff" : colors.foreground,
                          }}
                        >
                          {option}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Links Section */}
          <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: colors.mutedForeground,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                marginBottom: 8,
              }}
            >
              Links
            </Text>
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                paddingHorizontal: 16,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              {/* Website */}
              <View style={rowStyle}>
                <LinkIcon size={18} color={colors.mutedForeground} />
                <TextInput
                  value={editWebsite}
                  onChangeText={setEditWebsite}
                  placeholder="Website"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  keyboardType="url"
                  style={{ ...inputStyle, textAlign: "left", marginLeft: 12 }}
                />
              </View>

              {/* Existing links */}
              {links.map((link, index) => (
                <View key={index} style={rowStyle}>
                  <LinkIcon size={18} color={colors.mutedForeground} />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 15,
                      color: colors.foreground,
                      marginLeft: 12,
                    }}
                    numberOfLines={1}
                  >
                    {link}
                  </Text>
                  <Pressable onPress={() => removeLink(index)} hitSlop={12}>
                    <Trash2 size={18} color="#ef4444" />
                  </Pressable>
                </View>
              ))}

              {/* Add link */}
              {links.length < 5 && (
                <View style={{ ...rowStyle, borderBottomWidth: 0 }}>
                  <Plus size={18} color={colors.primary} />
                  <TextInput
                    value={newLink}
                    onChangeText={setNewLink}
                    placeholder="Add link"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="none"
                    keyboardType="url"
                    returnKeyType="done"
                    onSubmitEditing={addLink}
                    style={{ ...inputStyle, textAlign: "left", marginLeft: 12 }}
                  />
                </View>
              )}
            </View>
          </View>

          {/* Location Section */}
          <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: colors.mutedForeground,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                marginBottom: 8,
              }}
            >
              Location
            </Text>
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                paddingHorizontal: 16,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ ...rowStyle, borderBottomWidth: 0 }}>
                <TextInput
                  value={editLocation}
                  onChangeText={setEditLocation}
                  placeholder="Add your city or location"
                  placeholderTextColor={colors.mutedForeground}
                  style={{
                    flex: 1,
                    fontSize: 15,
                    color: colors.foreground,
                    paddingVertical: 0,
                  }}
                  maxLength={100}
                />
              </View>
            </View>
          </View>

          {/* Bio character count */}
          <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            <Text
              style={{
                fontSize: 12,
                color: colors.mutedForeground,
                textAlign: "right",
              }}
            >
              Bio: {editBio.length}/150
            </Text>
          </View>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
