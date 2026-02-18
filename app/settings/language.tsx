import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Main } from "@expo/html-elements";
import { useRouter } from "expo-router";
import { ChevronLeft, Check } from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import { mmkv } from "@/lib/mmkv-zustand";
import { useEffect, useState } from "react";
import { toast } from "sonner-native";

const LANGUAGE_STORAGE_KEY = "app_language_preference";

const languages = [
  { code: "en", name: "English", native: "English" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "fr", name: "French", native: "Français" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "it", name: "Italian", native: "Italiano" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "ko", name: "Korean", native: "한국어" },
  { code: "zh", name: "Chinese", native: "中文" },
  { code: "ar", name: "Arabic", native: "العربية" },
];

export default function LanguageScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const [selectedLanguage, setSelectedLanguage] = useState("en");

  useEffect(() => {
    const stored = mmkv.getString(LANGUAGE_STORAGE_KEY);
    if (stored) setSelectedLanguage(stored);
  }, []);

  const handleSelectLanguage = (code: string) => {
    setSelectedLanguage(code);
    mmkv.set(LANGUAGE_STORAGE_KEY, code);
    if (code !== "en") {
      toast.info("Language saved", {
        description:
          "Full translation support coming soon. English is currently the only fully supported language.",
      });
    } else {
      toast.success("Language saved");
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <Main className="flex-1">
        <View className="flex-row items-center border-b border-border px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ChevronLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="flex-1 text-lg font-semibold text-foreground">
            Language
          </Text>
        </View>

        <ScrollView
          className="flex-1 px-4 py-6"
          showsVerticalScrollIndicator={false}
        >
          <Text className="mb-3 text-sm text-muted-foreground">
            Select your preferred language for the app interface.
          </Text>

          <View className="rounded-lg border border-border bg-card">
            {languages.map((language, index) => (
              <View key={language.code}>
                {index > 0 && <View className="mx-4 h-px bg-border" />}
                <Pressable
                  onPress={() => handleSelectLanguage(language.code)}
                  className="flex-row items-center justify-between p-4 active:bg-secondary/50"
                >
                  <View>
                    <Text className="font-semibold text-foreground">
                      {language.name}
                    </Text>
                    <Text className="text-sm text-muted-foreground">
                      {language.native}
                    </Text>
                  </View>
                  {selectedLanguage === language.code && (
                    <Check size={20} color={colors.primary} />
                  )}
                </Pressable>
              </View>
            ))}
          </View>

          <Text className="mt-4 text-center text-xs text-muted-foreground">
            English is currently the only fully supported language. More
            translations coming soon.
          </Text>
        </ScrollView>
      </Main>
    </SafeAreaView>
  );
}
