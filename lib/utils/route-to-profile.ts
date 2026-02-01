/**
 * Profile Routing Helper
 * 
 * SINGLE SOURCE OF TRUTH for profile navigation.
 * Ensures correct routing to MyProfile vs UserProfile screens.
 * 
 * Rules:
 * - If targetUserId === viewerId → /profile/me (MyProfile)
 * - Otherwise → /profile/[username] (UserProfile)
 */

import { Router } from "expo-router";

interface RouteToProfileParams {
  targetUserId: string | number | undefined;
  targetUsername: string | undefined;
  viewerId: string | number | undefined;
  router: Router;
}

/**
 * Navigate to the correct profile screen based on ownership.
 * 
 * @example
 * // From feed post author tap
 * routeToProfile({
 *   targetUserId: post.author.id,
 *   targetUsername: post.author.username,
 *   viewerId: currentUser.id,
 *   router,
 * });
 */
export function routeToProfile({
  targetUserId,
  targetUsername,
  viewerId,
  router,
}: RouteToProfileParams): void {
  // Normalize IDs to strings for comparison
  const targetId = targetUserId ? String(targetUserId) : "";
  const currentId = viewerId ? String(viewerId) : "";

  // DEV logging
  if (__DEV__) {
    console.log("[routeToProfile]", {
      targetUserId: targetId,
      targetUsername,
      viewerId: currentId,
      isOwnProfile: targetId === currentId && targetId !== "",
    });
  }

  // If viewing own profile, route to /profile/me (tabs profile)
  if (targetId && currentId && targetId === currentId) {
    router.push("/(protected)/(tabs)/profile");
    return;
  }

  // Otherwise, route to user profile by username
  if (targetUsername) {
    router.push(`/(protected)/profile/${targetUsername}`);
    return;
  }

  // Fallback: if no username but have ID, try ID-based route
  if (targetId) {
    console.warn("[routeToProfile] No username provided, using ID:", targetId);
    router.push(`/(protected)/profile/${targetId}`);
    return;
  }

  // No valid target - log error
  console.error("[routeToProfile] No valid target provided:", {
    targetUserId,
    targetUsername,
    viewerId,
  });
}

/**
 * Get the profile route path without navigating.
 * Useful for Link components.
 */
export function getProfilePath(
  targetUserId: string | number | undefined,
  targetUsername: string | undefined,
  viewerId: string | number | undefined,
): string {
  const targetId = targetUserId ? String(targetUserId) : "";
  const currentId = viewerId ? String(viewerId) : "";

  if (targetId && currentId && targetId === currentId) {
    return "/(protected)/(tabs)/profile";
  }

  if (targetUsername) {
    return `/(protected)/profile/${targetUsername}`;
  }

  if (targetId) {
    return `/(protected)/profile/${targetId}`;
  }

  return "/(protected)/(tabs)/profile";
}
