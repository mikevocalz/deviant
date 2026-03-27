/**
 * addToWallet — Client-side wallet integration
 *
 * Apple Wallet: Calls Supabase Edge Function which returns a signed .pkpass
 *               binary. We write it to a temp file and open it — iOS handles
 *               .pkpass natively and shows the "Add to Wallet" sheet.
 * Google Wallet: Calls Supabase Edge Function to get a Save URL,
 *                then opens it via Linking.
 *
 * Pass generation and signing happens SERVER-SIDE only.
 */

import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as LegacyFileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { supabase } from "@/lib/supabase/client";
import { authClient } from "@/lib/auth-client";
import type { Ticket } from "@/lib/stores/ticket-store";

export interface WalletResult {
  success: boolean;
  error?: string;
}

/**
 * Get the current Better Auth session token for edge function calls.
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const session = await authClient.getSession();
    return session?.data?.session?.token || null;
  } catch {
    return null;
  }
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

async function callEdgeFunctionJson<T = any>(
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
 * 2. Edge Function validates ownership, generates signed .pkpass, returns binary.
 * 3. Client writes .pkpass to temp file and opens it via sharing (iOS native add-to-wallet sheet).
 */
export async function addToAppleWallet(ticket: Ticket): Promise<WalletResult> {
  if (Platform.OS !== "ios") {
    return { success: false, error: "apple_wallet_ios_only" };
  }

  try {
    const token = await getAuthToken();
    if (!token) {
      return { success: false, error: "not_authenticated" };
    }

    // Call edge function — returns binary .pkpass
    const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseUrl =
      typeof rawUrl === "string" && rawUrl.startsWith("https://")
        ? rawUrl
        : "https://npfjanxturvmjyevoyfo.supabase.co";
    const response = await fetch(
      `${supabaseUrl}/functions/v1/ticket_wallet_apple`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ticketId: ticket.id,
          eventId: ticket.eventId,
        }),
      },
    );

    // Check for JSON error responses
    const contentType = response.headers.get("Content-Type") || "";
    if (contentType.includes("application/json")) {
      const json = await response.json();
      const code = json?.error?.code || "server_error";
      const message = json?.error?.message || "Failed to generate pass";
      return { success: false, error: code };
    }

    if (!response.ok) {
      return { success: false, error: `http_${response.status}` };
    }

    // Write .pkpass binary to temp file
    const blob = await response.blob();
    const reader = new FileReader();
    const base64Data = await new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data URL prefix: "data:application/...;base64,"
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const tmpPath = `${LegacyFileSystem.cacheDirectory}ticket_${ticket.id}.pkpass`;
    await LegacyFileSystem.writeAsStringAsync(tmpPath, base64Data, {
      encoding: LegacyFileSystem.EncodingType.Base64,
    });

    // Open .pkpass — iOS shows the native "Add to Apple Wallet" sheet
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(tmpPath, {
        mimeType: "application/vnd.apple.pkpass",
        UTI: "com.apple.pkpass",
      });
    } else {
      // Fallback: try opening the file URL directly
      const fileUri = tmpPath.startsWith("file://")
        ? tmpPath
        : `file://${tmpPath}`;
      await Linking.openURL(fileUri);
    }

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
    const { saveUrl } = await callEdgeFunctionJson<{ saveUrl: string }>(
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
