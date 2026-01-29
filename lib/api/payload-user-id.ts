import { users } from "@/lib/api-client";

const payloadUserIdCache: Record<string, string> = {};

function normalizeUsername(username: string | undefined | null): string | null {
  if (!username) return null;
  const normalized = username.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Resolve the Payload CMS user ID for the given username in a case-insensitive way.
 * Caches lookups by the normalized username to avoid repeated network requests.
 */
export async function getPayloadUserId(
  username: string | undefined | null,
): Promise<string | null> {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;

  if (payloadUserIdCache[normalized]) {
    return payloadUserIdCache[normalized];
  }

  try {
    const result = await users.find({
      where: { username: { equals: normalized } },
      limit: 1,
    });

    if (result.docs && result.docs.length > 0) {
      const payloadId = (result.docs[0] as { id: string }).id;
      payloadUserIdCache[normalized] = payloadId;
      return payloadId;
    }
  } catch (error) {
    console.error("[payloadUserId] Error looking up Payload user ID:", error);
  }

  return null;
}
