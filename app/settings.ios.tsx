import { View, Text, ScrollView, Pressable } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Main } from "@expo/html-elements"
import { useRouter } from "expo-router"
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
} from "lucide-react-native"
import { useAuthStore } from "@/lib/stores/auth-store"
import { SettingsSection } from "@/components/settings/SettingsSection"
import { SettingsListItem } from "@/components/settings/SettingsListItem"

export default function SettingsScreenIOS() {
  const router = useRouter()
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    router.replace("/login")
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <Main className="flex-1">
        {/* Header */}
        <View className="border-b border-border px-4 py-3">
          <Text className="text-center text-lg font-semibold">Settings</Text>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* User Info Card - iOS Style */}
          {user && (
            <View className="mx-4 mt-4 rounded-lg bg-card p-4">
              <Text className="text-lg font-semibold">{user.name}</Text>
              <Text className="mt-1 text-sm text-muted-foreground">{user.email}</Text>
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

          {/* Support & About */}
          <SettingsSection title="Support & About">
            <SettingsListItem
              icon={<HelpCircle size={20} color="#666" />}
              label="Help Center"
              onPress={() => router.push("/settings/faq")}
            />
            <View className="ml-12 h-px bg-border" />
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
              label="Community Guidelines"
              onPress={() => router.push("/settings/community-guidelines")}
            />
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
  )
}
