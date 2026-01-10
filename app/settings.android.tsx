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
  ChevronLeft,
} from "lucide-react-native"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useColorScheme } from "@/lib/hooks"
import { SettingsSection } from "@/components/settings/SettingsSection"
import { SettingsListItem } from "@/components/settings/SettingsListItem"

export default function SettingsScreenAndroid() {
  const router = useRouter()
  const { colors } = useColorScheme()
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    router.replace("/login")
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <Main className="flex-1">
        {/* Header - Material Design Style */}
        <View className="flex-row items-center border-b border-border px-2 py-3">
          <Pressable onPress={() => router.back()} className="p-2">
            <ChevronLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="ml-2 flex-1 text-xl font-semibold">Settings</Text>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* User Info - Material Design Style */}
          {user && (
            <View className="border-b border-border px-4 py-6">
              <Text className="text-xl font-semibold">{user.name}</Text>
              <Text className="mt-1 text-sm text-muted-foreground">{user.email}</Text>
            </View>
          )}

          {/* Account Settings */}
          <SettingsSection title="Account">
            <SettingsListItem
              icon={<User size={22} color="#666" />}
              label="Account Information"
              onPress={() => router.push("/settings/account")}
            />
            <SettingsListItem
              icon={<Lock size={22} color="#666" />}
              label="Privacy"
              onPress={() => router.push("/settings/privacy")}
            />
            <SettingsListItem
              icon={<Eye size={22} color="#666" />}
              label="Close Friends"
              onPress={() => router.push("/settings/close-friends")}
            />
            <SettingsListItem
              icon={<UserX size={22} color="#666" />}
              label="Blocked"
              onPress={() => router.push("/settings/blocked")}
            />
          </SettingsSection>

          {/* Notifications & Interactions */}
          <SettingsSection title="Notifications">
            <SettingsListItem
              icon={<Bell size={22} color="#666" />}
              label="Push Notifications"
              onPress={() => router.push("/settings/notifications")}
            />
            <SettingsListItem
              icon={<MessageCircle size={22} color="#666" />}
              label="Messages"
              onPress={() => router.push("/settings/messages")}
            />
            <SettingsListItem
              icon={<Heart size={22} color="#666" />}
              label="Likes and Comments"
              onPress={() => router.push("/settings/likes-comments")}
            />
          </SettingsSection>

          {/* Content & Display */}
          <SettingsSection title="Content & Display">
            <SettingsListItem
              icon={<Archive size={22} color="#666" />}
              label="Archived"
              onPress={() => router.push("/settings/archived")}
            />
            <SettingsListItem
              icon={<Moon size={22} color="#666" />}
              label="Theme"
              value="System"
              onPress={() => router.push("/settings/theme")}
            />
            <SettingsListItem
              icon={<Globe size={22} color="#666" />}
              label="Language"
              value="English"
              onPress={() => router.push("/settings/language")}
            />
          </SettingsSection>

          {/* Support & About */}
          <SettingsSection title="Support & Legal">
            <SettingsListItem
              icon={<HelpCircle size={22} color="#666" />}
              label="Help Center"
              onPress={() => router.push("/settings/faq")}
            />
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
              label="Community Guidelines"
              onPress={() => router.push("/settings/community-guidelines")}
            />
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
            <Text className="text-xs text-muted-foreground">Version 1.0.0 Build 1</Text>
          </View>
        </ScrollView>
      </Main>
    </SafeAreaView>
  )
}
