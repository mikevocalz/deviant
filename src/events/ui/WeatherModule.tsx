/**
 * WeatherModule — 7-day NOAA forecast for Event Details
 *
 * Features:
 *   - Skeleton shimmer → fade-in
 *   - Staggered card entrance (Reanimated)
 *   - Horizontal scroll on mobile, grid on tablet/web
 *   - Lucide weather icons
 *   - Graceful degradation on error
 */

import { View, Text, ScrollView, Pressable } from "react-native";
import { useState, useCallback } from "react";
import Animated, { FadeIn, FadeInDown, Layout } from "react-native-reanimated";
import {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudSnow,
  CloudFog,
  Wind,
  Droplets,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react-native";
import { useWeatherForecast } from "@/lib/hooks/use-weather";
import { mapWeatherToIcon, type WeatherPeriod } from "@/lib/api/weather";

// ── Lucide icon mapping ─────────────────────────────────────────────

const WEATHER_ICONS: Record<string, typeof Sun> = {
  sun: Sun,
  "cloud-sun": CloudSun,
  cloud: Cloud,
  "cloud-rain": CloudRain,
  "cloud-lightning": CloudLightning,
  "cloud-snow": CloudSnow,
  "cloud-fog": CloudFog,
  wind: Wind,
};

const WEATHER_COLORS: Record<string, string> = {
  sun: "#FCD34D",
  "cloud-sun": "#93C5FD",
  cloud: "#9CA3AF",
  "cloud-rain": "#60A5FA",
  "cloud-lightning": "#A78BFA",
  "cloud-snow": "#E0E7FF",
  "cloud-fog": "#D1D5DB",
  wind: "#6EE7B7",
};

// ── Skeleton ────────────────────────────────────────────────────────

function WeatherSkeleton() {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
    >
      {Array.from({ length: 7 }).map((_, i) => (
        <Animated.View
          key={i}
          entering={FadeIn.delay(i * 60).duration(300)}
          className="w-20 h-28 rounded-2xl bg-card"
          style={{ opacity: 0.5 }}
        />
      ))}
    </ScrollView>
  );
}

// ── Single Weather Card ─────────────────────────────────────────────

function WeatherCard({
  period,
  index,
  expanded,
  onToggle,
}: {
  period: WeatherPeriod;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const iconKey = mapWeatherToIcon(period.shortForecast);
  const IconComponent = WEATHER_ICONS[iconKey] || CloudSun;
  const iconColor = WEATHER_COLORS[iconKey] || "#93C5FD";

  const dayName = new Date(period.startTime).toLocaleDateString("en-US", {
    weekday: "short",
  });
  const precip = period.probabilityOfPrecipitation?.value;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 80)
        .duration(400)
        .springify()
        .damping(18)}
      layout={Layout.springify()}
    >
      <Pressable
        onPress={onToggle}
        className="items-center justify-between rounded-2xl bg-card border border-border px-3 py-3"
        style={{ width: 88, height: 158 }}
      >
        {/* Day label */}
        <Text className="text-xs font-sans-semibold text-muted-foreground">
          {index === 0 ? "Today" : dayName}
        </Text>

        {/* Icon */}
        <IconComponent size={28} color={iconColor} strokeWidth={1.8} />

        {/* Temperature */}
        <Animated.Text
          entering={FadeIn.delay(index * 80 + 200).duration(300)}
          className="text-lg font-sans-bold text-foreground"
        >
          {period.temperature}°
        </Animated.Text>

        {/* Short forecast — fixed 2-line height */}
        <View style={{ height: 24, justifyContent: "center" }}>
          <Text
            className="text-[10px] text-muted-foreground text-center"
            numberOfLines={2}
          >
            {period.shortForecast}
          </Text>
        </View>

        {/* Precipitation badge — always reserve space */}
        <View style={{ height: 14, justifyContent: "center" }}>
          {precip != null && precip > 0 ? (
            <View className="flex-row items-center gap-0.5">
              <Droplets size={10} color="#60A5FA" />
              <Text className="text-[9px] text-blue-400">{precip}%</Text>
            </View>
          ) : null}
        </View>

        {/* Expand indicator */}
        {expanded ? (
          <ChevronUp size={12} color="#666" />
        ) : (
          <ChevronDown size={12} color="#666" />
        )}
      </Pressable>

      {/* Expanded details */}
      {expanded && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          className="bg-card border border-border rounded-xl mt-1 px-3 py-2"
          style={{ width: 88 }}
        >
          <View className="flex-row items-center gap-1 mb-1">
            <Wind size={10} color="#6EE7B7" />
            <Text className="text-[9px] text-muted-foreground">
              {period.windSpeed} {period.windDirection}
            </Text>
          </View>
          {precip != null && precip > 0 && (
            <View className="flex-row items-center gap-1">
              <Droplets size={10} color="#60A5FA" />
              <Text className="text-[9px] text-muted-foreground">
                {precip}% rain
              </Text>
            </View>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ── Error State ─────────────────────────────────────────────────────

function WeatherError() {
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      className="flex-row items-center gap-2 px-4 py-3 bg-card rounded-xl mx-4"
    >
      <AlertTriangle size={16} color="#F59E0B" />
      <Text className="text-xs text-muted-foreground flex-1">
        Weather forecast unavailable for this location
      </Text>
    </Animated.View>
  );
}

// ── Main Export ──────────────────────────────────────────────────────

export function WeatherModule({ lat, lng }: { lat?: number; lng?: number }) {
  const { data: periods, isLoading, isError } = useWeatherForecast(lat, lng);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const handleToggle = useCallback((index: number) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
  }, []);

  // Don't render if no coordinates
  if (!lat || !lng) return null;

  if (isLoading) return <WeatherSkeleton />;
  if (isError || !periods?.length) return <WeatherError />;

  return (
    <Animated.View entering={FadeIn.duration(400)}>
      <Text className="text-sm font-sans-semibold text-foreground px-4 mb-2">
        7-Day Forecast
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          gap: 10,
          paddingBottom: 4,
        }}
      >
        {periods.map((period, index) => (
          <WeatherCard
            key={period.number}
            period={period}
            index={index}
            expanded={expandedIndex === index}
            onToggle={() => handleToggle(index)}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
}
