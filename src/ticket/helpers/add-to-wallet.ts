/**
 * addToWallet — Client-side wallet integration
 *
 * Apple Wallet: Calls Supabase Edge Function to get a short-lived .pkpass URL,
 *               then opens it via Linking (iOS handles .pkpass natively).
 * Google Wallet: Calls Supabase Edge Function to get a Save URL,
 *                then opens it via Linking.
 *
 * Pass generation and signing happens SERVER-SIDE only.
 */

import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase/client";
import type { Ticket } from "@/lib/stores/ticket-store";

export interface WalletResult {
  success: boolean;
  error?: string;
}

/**
 * Call a Supabase Edge Function with the user's auth token.
 * Returns the JSON response or throws.
 */
class EdgeFunctionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "EdgeFunctionError";
  }
}

async function callEdgeFunction<T = any>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
  });

  if (error) {
    throw new EdgeFunctionError(
      "invoke_error",
      error.message || `Edge function ${functionName} failed`,
    );
  }

  if (!data?.ok) {
    throw new EdgeFunctionError(
      data?.error?.code || "unknown",
      data?.error?.message || `Edge function ${functionName} returned error`,
    );
  }

  return data.data as T;
}

/**
 * Add ticket to Apple Wallet (iOS only).
 * 1. Calls `ticket_wallet_apple` Edge Function with ticketId.
 * 2. Edge Function validates ownership, generates/retrieves .pkpass, returns URL.
 * 3. Client opens the URL — iOS handles .pkpass natively.
 */
export async function addToAppleWallet(ticket: Ticket): Promise<WalletResult> {
  if (Platform.OS !== "ios") {
    return { success: false, error: "apple_wallet_ios_only" };
  }

  try {
    const { pkpassUrl } = await callEdgeFunction<{ pkpassUrl: string }>(
      "ticket_wallet_apple",
      { ticketId: ticket.id, eventId: ticket.eventId },
    );

    if (!pkpassUrl) {
      return { success: false, error: "no_pkpass_url" };
    }

    const canOpen = await Linking.canOpenURL(pkpassUrl);
    if (!canOpen) {
      return { success: false, error: "cannot_open_pkpass" };
    }

    await Linking.openURL(pkpassUrl);
    return { success: true };
  } catch (err: any) {
    console.error("[addToAppleWallet] Error:", err);
    const code = err?.code || "unknown";
    return { success: false, error: code };
  }
}

/**
 * Add ticket to Google Wallet (Android only).
 * 1. Calls `ticket_wallet_google` Edge Function with ticketId.
 * 2. Edge Function validates ownership, creates Wallet Object, returns Save URL.
 * 3. Client opens the URL — Google Wallet app handles it.
 */
export async function addToGoogleWallet(ticket: Ticket): Promise<WalletResult> {
  if (Platform.OS !== "android") {
    return { success: false, error: "google_wallet_android_only" };
  }

  try {
    const { saveUrl } = await callEdgeFunction<{ saveUrl: string }>(
      "ticket_wallet_google",
      { ticketId: ticket.id, eventId: ticket.eventId },
    );

    if (!saveUrl) {
      return { success: false, error: "no_save_url" };
    }

    await Linking.openURL(saveUrl);
    return { success: true };
  } catch (err: any) {
    console.error("[addToGoogleWallet] Error:", err);
    const code = err?.code || "unknown";
    return { success: false, error: code };
  }
}

/**
 * Platform-aware wallet add.
 * Calls the correct wallet function based on OS.
 */
export async function addToWallet(ticket: Ticket): Promise<WalletResult> {
  if (Platform.OS === "ios") {
    return addToAppleWallet(ticket);
  }
  if (Platform.OS === "android") {
    return addToGoogleWallet(ticket);
  }
  return { success: false, error: "unsupported_platform" };
}
