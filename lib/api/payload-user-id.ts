import { usersApi } from "@/lib/api/supabase-users";

const userIdCache: Record<string, string> = {};

function normalizeUsername(username: string | undefined | null): string | null {
  if (!username) return null;
  const normalized = username.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Resolve the user ID for the given username in a case-insensitive way.
 * Caches lookups by the normalized username to avoid repeated network requests.
 */
export async function getPayloadUserId(
  username: string | undefined | null,
): Promise<string | null> {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;

  if (userIdCache[normalized]) {
    return userIdCache[normalized];
  }

  try {
    const result = await usersApi.getProfileByUsername(normalized);

    if (result?.id) {
      userIdCache[normalized] = result.id;
      return result.id;
    }
  } catch (error) {
    console.error("[getUserId] Error looking up user ID:", error);
  }

  return null;
}
