import React, { useCallback, useState, useEffect } from "react";
import { Pressable, ActivityIndicator, View, Text } from "react-native";
import { Languages } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "@/lib/hooks";

interface TranslateButtonProps {
  onTranslate: () => Promise<void>;
  isTranslated: boolean;
  onToggleOriginal: () => void;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export function TranslateButton({
  onTranslate,
  isTranslated,
  onToggleOriginal,
  size = "sm",
  showLabel = false,
}: TranslateButtonProps) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear error after 3 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handlePress = useCallback(async () => {
    if (isTranslated) {
      onToggleOriginal();
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await onTranslate();
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("not available in this build")) {
        setError("Update app to translate");
      } else {
        setError(t("common.error"));
      }
    } finally {
      setIsLoading(false);
    }
  }, [isTranslated, onToggleOriginal, onTranslate, t]);

  const buttonSize = size === "sm" ? 28 : 36;
  const iconSize = size === "sm" ? 14 : 18;

  return (
    <Pressable
      onPress={handlePress}
      disabled={isLoading}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: showLabel ? 8 : 0,
        height: buttonSize,
        minWidth: buttonSize,
        borderRadius: 8,
        backgroundColor: isTranslated
          ? "rgba(63, 220, 255, 0.15)"
          : "rgba(255, 255, 255, 0.08)",
        borderWidth: 1,
        borderColor: isTranslated
          ? "rgba(63, 220, 255, 0.3)"
          : "rgba(255, 255, 255, 0.12)",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Languages
          size={iconSize}
          color={isTranslated ? "#3FDCFF" : "rgba(255,255,255,0.6)"}
        />
      )}
      {showLabel && (
        <Text
          style={{
            fontSize: size === "sm" ? 11 : 13,
            fontWeight: "500",
            color: isTranslated ? "#3FDCFF" : "rgba(255,255,255,0.7)",
          }}
        >
          {isTranslated ? t("common.original") : t("common.translate")}
        </Text>
      )}
      {error && (
        <View
          style={{
            position: "absolute",
            bottom: -20,
            left: 0,
            right: 0,
            backgroundColor: "rgba(255, 0, 0, 0.8)",
            borderRadius: 4,
            paddingHorizontal: 6,
            paddingVertical: 2,
          }}
        >
          <Text style={{ fontSize: 10, color: "#fff" }}>{error}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function TranslatedBadge() {
  const { t } = useTranslation();
  const { colors } = useColorScheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: "rgba(63, 220, 255, 0.1)",
        borderWidth: 1,
        borderColor: "rgba(63, 220, 255, 0.2)",
      }}
    >
      <Languages size={12} color="#3FDCFF" />
      <Text
        style={{
          fontSize: 11,
          fontWeight: "500",
          color: "#3FDCFF",
        }}
      >
        {t("common.translated")}
      </Text>
    </View>
  );
}
