/**
 * Identity Helpers
 * 
 * Centralized identity management for Better Auth + Supabase integration.
 * 
 * IMPORTANT: Better Auth IDs are strings (not UUIDs, not integers).
 * The users table has:
 * - `id` (integer): Payload CMS internal ID
 * - `auth_id` (string): Better Auth user ID
 * 
 * Use these helpers to get the correct ID type for your use case.
 */

import { supabase } from "../supabase/client";
import { DB } from "../supabase/db-map";
import { useAuthStore } from "../stores/auth-store";

/**
 * Get the current Better Auth user ID (string).
 * This is the `auth_id` stored in the users table.
 * 
 * @returns The Better Auth user ID string, or null if not authenticated
 */
export function getCurrentAuthId(): string | null {
  const user = useAuthStore.getState().user;
  if (!user) return null;
  
  // The auth store should have the auth_id, but we need to check
  // If user.id looks like a Better Auth ID (not numeric), return it
  // Otherwise, we need to look it up
  const isNumeric = /^\d+$/.test(user.id);
  
  if (!isNumeric) {
    // user.id is already the auth_id
    return user.id;
  }
  
  // user.id is the integer ID, we need to get auth_id from somewhere else
  // This shouldn't happen if auth store is set up correctly
  console.warn("[Identity] getCurrentAuthId: user.id is numeric, auth_id not available");
  return null;
}

/**
 * Get the current user's database row.
 * Fetches from users table by auth_id.
 * 
 * @returns The user row from database, or null if not found
 */
export async function getCurrentUserRow(): Promise<{
  id: number;
  authId: string;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  bio: string | null;
  location: string | null;
  verified: boolean;
  avatarUrl: string | null;
} | null> {
  const user = useAuthStore.getState().user;
  if (!user) return null;

  try {
    // First try to get by integer ID if we have it
    const isNumeric = /^\d+$/.test(user.id);
    
    let query = supabase
      .from(DB.users.table)
      .select(`
        ${DB.users.id},
        ${DB.users.authId},
        ${DB.users.email},
        ${DB.users.username},
        ${DB.users.firstName},
        ${DB.users.lastName},
        ${DB.users.bio},
        ${DB.users.location},
        ${DB.users.verified},
        avatar:${DB.users.avatarId}(url)
      `);

    if (isNumeric) {
      query = query.eq(DB.users.id, parseInt(user.id));
    } else {
      // user.id is the auth_id
      query = query.eq(DB.users.authId, user.id);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      console.error("[Identity] getCurrentUserRow error:", error);
      return null;
    }

    return {
      id: data[DB.users.id] as number,
      authId: data[DB.users.authId] as string,
      email: data[DB.users.email] as string,
      username: data[DB.users.username] as string,
      firstName: data[DB.users.firstName] as string | null,
      lastName: data[DB.users.lastName] as string | null,
      bio: data[DB.users.bio] as string | null,
      location: data[DB.users.location] as string | null,
      verified: (data[DB.users.verified] as boolean) || false,
      avatarUrl: (data.avatar as any)?.url || null,
    };
  } catch (error) {
    console.error("[Identity] getCurrentUserRow error:", error);
    return null;
  }
}

/**
 * Get the current user's integer database ID.
 * This fetches from the database to ensure we have the correct ID.
 * 
 * Use this when you need the integer ID for database operations.
 * For most Edge Function calls, use getCurrentAuthId() instead.
 * 
 * @returns The integer user ID, or null if not authenticated
 */
export async function getCurrentUserId(): Promise<number | null> {
  const user = useAuthStore.getState().user;
  if (!user) return null;

  // If user.id is already numeric, return it
  const isNumeric = /^\d+$/.test(user.id);
  if (isNumeric) {
    return parseInt(user.id);
  }

  // Otherwise, look up the user by auth_id
  const userRow = await getCurrentUserRow();
  return userRow?.id || null;
}

/**
 * Get the current user's integer ID synchronously.
 * 
 * WARNING: This assumes the auth store has the correct integer ID.
 * If the store has a Better Auth ID, this will return null.
 * 
 * Prefer getCurrentUserId() (async) when possible.
 * 
 * @returns The integer user ID, or null if not available
 */
export function getCurrentUserIdSync(): number | null {
  const user = useAuthStore.getState().user;
  if (!user) return null;

  const isNumeric = /^\d+$/.test(user.id);
  if (!isNumeric) {
    console.warn("[Identity] getCurrentUserIdSync: user.id is not numeric");
    return null;
  }

  return parseInt(user.id);
}
