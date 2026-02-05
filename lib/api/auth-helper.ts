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
  return user?.id || null;
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
