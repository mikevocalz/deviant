/**
 * Canonical avatar URL resolver
 *
 * Handles all possible avatar formats from Payload CMS:
 * - Direct URL string
 * - Media object with url property (from upload field with depth)
 * - null/undefined
 *
 * Returns a valid URL string or null (for placeholder rendering)
 */

export function resolveAvatarUrl(
  avatar: unknown,
  context?: string,
): string | null {
  // Handle null/undefined
  if (!avatar) {
    if (__DEV__ && context) {
      console.log(`[resolveAvatarUrl] ${context}: avatar is null/undefined`);
    }
    return null;
  }

  // Handle direct string URL
  if (typeof avatar === "string") {
    if (avatar.startsWith("http://") || avatar.startsWith("https://")) {
      if (__DEV__ && context) {
        console.log(
          `[resolveAvatarUrl] ${context}: resolved string URL`,
          avatar.slice(0, 50),
        );
      }
      return avatar;
    }
    // Invalid string format
    if (__DEV__ && context) {
      console.log(
        `[resolveAvatarUrl] ${context}: invalid string format`,
        avatar.slice(0, 30),
      );
    }
    return null;
  }

  // Handle media object from Payload CMS (upload field with depth)
  if (typeof avatar === "object" && avatar !== null) {
    const avatarObj = avatar as Record<string, unknown>;

    // Check for url property
    if (avatarObj.url && typeof avatarObj.url === "string") {
      const url = avatarObj.url;
      if (url.startsWith("http://") || url.startsWith("https://")) {
        if (__DEV__ && context) {
          console.log(
            `[resolveAvatarUrl] ${context}: resolved object URL`,
            url.slice(0, 50),
          );
        }
        return url;
      }
    }

    // DEV: Log unexpected object structure
    if (__DEV__ && context) {
      console.log(
        `[resolveAvatarUrl] ${context}: unexpected object structure`,
        JSON.stringify(avatarObj).slice(0, 100),
      );
    }
  }

  return null;
}

/**
 * Generate fallback avatar URL using ui-avatars.com
 */
export function getFallbackAvatarUrl(name: string): string {
  const safeName = name || "User";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(safeName)}&background=3EA4E5&color=fff&size=200`;
}
