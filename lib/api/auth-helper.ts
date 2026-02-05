import { useAuthStore } from "../stores/auth-store";

/**
 * Get current user ID from Better Auth store
 * Returns the Payload CMS user ID (integer as string), not the Better Auth ID
 *
 * After switching from Supabase Auth to Better Auth, we no longer use
 * supabase.auth.getUser(). Instead, we get the user from the auth store
 * which is populated by Better Auth session.
 */
export function getCurrentUserId(): string | null {
  const user = useAuthStore.getState().user;
  const id = user?.id;

  // Validate that we have a valid ID (should be numeric string from Payload CMS)
  if (!id) return null;

  // If it's a UUID (Better Auth ID), we can't use it directly
  // The auth store should have the Payload CMS integer ID
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    console.warn(
      "[auth-helper] getCurrentUserId received UUID instead of integer ID:",
      id,
    );
    return null;
  }

  return id;
}

/**
 * Get current user ID as integer (for database queries)
 * Returns null if user is not authenticated or ID is invalid
 */
export function getCurrentUserIdInt(): number | null {
  const id = getCurrentUserId();
  if (!id) return null;

  const parsed = parseInt(id, 10);
  if (isNaN(parsed)) {
    console.warn("[auth-helper] getCurrentUserIdInt failed to parse:", id);
    return null;
  }

  return parsed;
}

/**
 * Get current user from Better Auth store
 */
export function getCurrentUser() {
  return useAuthStore.getState().user;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return useAuthStore.getState().isAuthenticated;
}
