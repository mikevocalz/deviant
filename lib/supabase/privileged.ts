/**
 * Privileged Database Operations
 *
 * This module contains wrappers for database operations that require
 * elevated privileges (service role). These operations are performed
 * via Supabase Edge Functions to keep the service role key secure.
 *
 * IMPORTANT: Never use supabase.from("users").update() directly in app code.
 * Always use these wrappers for privileged writes.
 */

import { supabase } from "./client";
import { getAuthToken } from "../auth-client";
import type { AppUser } from "../auth-client";

interface UpdateProfileParams {
  name?: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  location?: string;
  website?: string;
  avatarUrl?: string;
}

interface PrivilegedResponse<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

/**
 * Update the current user's profile via Edge Function.
 * This bypasses RLS by using the service role key server-side.
 *
 * @param updates - Profile fields to update
 * @returns Updated user data or throws error
 */
export async function updateProfilePrivileged(
  updates: UpdateProfileParams,
): Promise<AppUser> {
  console.log("[Privileged] updateProfilePrivileged called with:", updates);

  // Get Better Auth token
  const token = await getAuthToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  // Call Edge Function
  const { data, error } = await supabase.functions.invoke<
    PrivilegedResponse<{ user: AppUser }>
  >("update-profile", {
    body: updates,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (error) {
    console.error("[Privileged] Edge Function error:", error);
    throw new Error(error.message || "Failed to update profile");
  }

  if (!data?.ok || !data?.data?.user) {
    const errorMessage = data?.error?.message || "Failed to update profile";
    console.error("[Privileged] Update failed:", errorMessage);
    throw new Error(errorMessage);
  }

  console.log("[Privileged] Profile updated successfully:", data.data.user.id);
  return data.data.user;
}

/**
 * Delete the current user's account via Edge Function.
 * This is a placeholder for future implementation.
 *
 * @returns Success status
 */
export async function deleteAccountPrivileged(): Promise<boolean> {
  console.log("[Privileged] deleteAccountPrivileged called");

  // Get Better Auth token
  const token = await getAuthToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  // TODO: Implement delete-account Edge Function
  throw new Error("Not implemented yet");
}
