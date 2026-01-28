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

export function resolveAvatarUrl(avatar: unknown): string | null {
  // Handle null/undefined
  if (!avatar) return null;

  // Handle direct string URL
  if (typeof avatar === "string") {
    if (avatar.startsWith("http://") || avatar.startsWith("https://")) {
      return avatar;
    }
    // Invalid string format
    return null;
  }

  // Handle media object from Payload CMS (upload field with depth)
  if (typeof avatar === "object" && avatar !== null) {
    const avatarObj = avatar as Record<string, unknown>;
    
    // Check for url property
    if (avatarObj.url && typeof avatarObj.url === "string") {
      const url = avatarObj.url;
      if (url.startsWith("http://") || url.startsWith("https://")) {
        return url;
      }
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
