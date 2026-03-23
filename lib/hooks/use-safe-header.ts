/**
 * Safe Header Update Hook
 * 
 * Prevents navigation.setOptions infinite loops by:
 * 1. Only updating when values actually change
 * 2. Using ref to track last value
 * 3. Stable dependencies
 * 
 * CRITICAL: Use this instead of raw navigation.setOptions in useLayoutEffect
 */

import { useLayoutEffect, useRef } from "react";
import { useNavigation } from "expo-router";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";

/**
 * Safely update navigation header options without causing loops.
 * 
 * @example
 * // Instead of:
 * useLayoutEffect(() => {
 *   navigation.setOptions({ headerTitle: title });
 * }, [navigation, title]);
 * 
 * // Use:
 * useSafeHeader({ headerTitle: title });
 */
export function useSafeHeader(
  options: Partial<NativeStackNavigationOptions>
): void {
  const navigation = useNavigation();
  const lastOptionsRef = useRef<string>("");

  useLayoutEffect(() => {
    // Serialize options to detect changes
    const optionsKey = JSON.stringify(options);
    
    // Only update if options actually changed
    if (lastOptionsRef.current === optionsKey) {
      return;
    }
    
    lastOptionsRef.current = optionsKey;
    navigation.setOptions(options);
  }, [navigation, options]);
}

/**
 * Safely update header title only.
 * More efficient than full options update.
 * 
 * @example
 * useSafeHeaderTitle(peerUsername || "Chat");
 */
export function useSafeHeaderTitle(title: string): void {
  const navigation = useNavigation();
  const lastTitleRef = useRef<string>("");

  useLayoutEffect(() => {
    if (lastTitleRef.current === title) {
      return;
    }
    
    lastTitleRef.current = title;
    navigation.setOptions({ headerTitle: title });
  }, [navigation, title]);
}

/**
 * Safely update header with custom component.
 * 
 * @example
 * useSafeHeaderComponent(
 *   () => <SheetHeader title={title} onClose={() => router.back()} />,
 *   [title]
 * );
 */
export function useSafeHeaderComponent(
  headerComponent: () => React.ReactElement,
  deps: any[] = []
): void {
  const navigation = useNavigation();
  const mountedRef = useRef(false);

  useLayoutEffect(() => {
    // Only set once on mount, or when deps change
    if (!mountedRef.current) {
      mountedRef.current = true;
    }
    
    navigation.setOptions({
      header: headerComponent,
    });
  }, [navigation, ...deps]);
}
