/**
 * PhoneTabBar — Custom bottom tab bar for phones.
 *
 * Renders all regular tabs in a horizontal row with the special "create"
 * tab rendered via its custom tabBarButton (CenterButton) in its natural
 * position within the tab order.
 */

import React, { useCallback, useMemo } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { useColorScheme } from "@/lib/hooks";
import {
  isTabVisible,
  isSpecialTab,
  PHONE_TAB_BAR_HEIGHT,
} from "./constants";

export function PhoneTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useColorScheme();

  const visibleRoutes = useMemo(
    () => state.routes.filter((route) => isTabVisible(route, descriptors)),
    [state.routes, descriptors],
  );

  const handleTabPress = useCallback(
    (route: (typeof state.routes)[number], isFocused: boolean) => {
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });

      if (!event.defaultPrevented && !isFocused) {
        navigation.navigate(route.name, route.params);
      }
    },
    [navigation],
  );

  const handleTabLongPress = useCallback(
    (route: (typeof state.routes)[number]) => {
      navigation.emit({
        type: "tabLongPress",
        target: route.key,
      });
    },
    [navigation],
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom,
          height: PHONE_TAB_BAR_HEIGHT + insets.bottom,
        },
      ]}
    >
      {visibleRoutes.map((route) => {
        const descriptor = descriptors[route.key];
        if (!descriptor) return null;

        const { options } = descriptor;
        const isFocused = state.index === state.routes.indexOf(route);

        // If the route has a custom tabBarButton, render it directly
        if (isSpecialTab(route) && options.tabBarButton) {
          const TabBarButton = options.tabBarButton as React.ComponentType<any>;
          return <TabBarButton key={route.key} />;
        }

        const icon = options.tabBarIcon?.({
          focused: isFocused,
          color: isFocused
            ? colors.foreground
            : colors.mutedForeground,
          size: 24,
        });

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarButtonTestID}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              handleTabPress(route, isFocused);
            }}
            onLongPress={() => handleTabLongPress(route)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.tabItem}
          >
            {icon}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderTopWidth: 1,
    alignItems: "center",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: PHONE_TAB_BAR_HEIGHT,
  },
});
