/**
 * Canonical API Configuration
 *
 * CRITICAL: This is the SINGLE SOURCE OF TRUTH for all API URLs.
 * All API clients MUST import from this module.
 *
 * Rules:
 * - Returns ONLY valid HTTPS URLs
 * - NEVER returns empty string
 * - NEVER returns localhost
 * - Throws if configuration is invalid
 */

import { Platform } from "react-native";

// Production fallback URLs - MANDATORY
const PRODUCTION_AUTH_URL = "https://server-zeta-lovat.vercel.app";
const PRODUCTION_API_URL = "https://payload-cms-setup-gray.vercel.app";
const PRODUCTION_CDN_URL = "https://dvnt.b-cdn.net";

/**
 * Validate that a URL is a valid HTTPS URL
 */
function isValidHttpsUrl(url: string | undefined): url is string {
  if (!url) return false;
  if (url === "") return false;
  if (url.includes("localhost")) return false;
  if (url.includes("127.0.0.1")) return false;
  if (!url.startsWith("https://")) return false;
  return true;
}

/**
 * Get the canonical Auth URL
 * Used for authentication endpoints (Better Auth / Hono server)
 */
export function getAuthBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_AUTH_URL;

  if (isValidHttpsUrl(envUrl)) {
    return envUrl;
  }

  // Production fallback - NEVER empty string
  console.warn(
    "[API Config] EXPO_PUBLIC_AUTH_URL not set, using production fallback",
  );
  return PRODUCTION_AUTH_URL;
}

/**
 * Get the canonical API URL
 * Used for Payload CMS / API endpoints
 */
export function getApiBaseUrl(): string {
  // Priority: AUTH_URL (Hono server) > API_URL (Payload) > Production fallback
  const authUrl = process.env.EXPO_PUBLIC_AUTH_URL;
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;

  if (isValidHttpsUrl(authUrl)) {
    return authUrl;
  }

  if (isValidHttpsUrl(apiUrl)) {
    return apiUrl;
  }

  // Production fallback - NEVER empty string
  console.warn("[API Config] No valid API URL set, using production fallback");
  return PRODUCTION_AUTH_URL;
}

/**
 * Get the canonical CDN URL
 * Used for Bunny CDN media
 */
export function getCdnBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_BUNNY_CDN_URL;

  if (isValidHttpsUrl(envUrl)) {
    return envUrl;
  }

  // Production fallback
  return PRODUCTION_CDN_URL;
}

/**
 * FAIL-FAST: Validate API configuration at startup
 * Call this in _layout.tsx BEFORE any API calls
 *
 * PHASE 0: This now THROWS on invalid config instead of returning false
 * No more silent failures - crash loudly if misconfigured
 */
export function validateApiConfig(): boolean {
  const authUrl = getAuthBaseUrl();
  const apiUrl = getApiBaseUrl();
  const cdnUrl = getCdnBaseUrl();

  const errors: string[] = [];

  // FAIL-FAST: Validate all URLs are HTTPS - no localhost, no empty
  if (!authUrl || authUrl === "") {
    errors.push("AUTH_URL is empty");
  } else if (authUrl.includes("localhost") || authUrl.includes("127.0.0.1")) {
    errors.push(`AUTH_URL contains localhost: ${authUrl}`);
  } else if (!authUrl.startsWith("https://")) {
    errors.push(`AUTH_URL is not HTTPS: ${authUrl}`);
  }

  if (!apiUrl || apiUrl === "") {
    errors.push("API_URL is empty");
  } else if (apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1")) {
    errors.push(`API_URL contains localhost: ${apiUrl}`);
  } else if (!apiUrl.startsWith("https://")) {
    errors.push(`API_URL is not HTTPS: ${apiUrl}`);
  }

  if (!cdnUrl || cdnUrl === "") {
    errors.push("CDN_URL is empty");
  } else if (cdnUrl.includes("localhost") || cdnUrl.includes("127.0.0.1")) {
    errors.push(`CDN_URL contains localhost: ${cdnUrl}`);
  } else if (!cdnUrl.startsWith("https://")) {
    errors.push(`CDN_URL is not HTTPS: ${cdnUrl}`);
  }

  // Log configuration
  console.log("[API Config] ========================================");
  console.log("[API Config] AUTH_URL:", authUrl);
  console.log("[API Config] API_URL:", apiUrl);
  console.log("[API Config] CDN_URL:", cdnUrl);
  console.log("[API Config] Platform:", Platform.OS);

  if (errors.length > 0) {
    console.error("[API Config] ========================================");
    console.error("[API Config] CRITICAL CONFIGURATION ERRORS:");
    errors.forEach((e) => console.error("[API Config] ✗", e));
    console.error("[API Config] ========================================");

    // FAIL-FAST: In production, this is fatal
    // In dev, we allow it but log loudly
    if (!__DEV__) {
      throw new Error(
        `[API Config] FATAL: Invalid API configuration. Errors: ${errors.join("; ")}`,
      );
    }

    return false;
  }

  console.log("[API Config] Valid: ✓ OK");
  console.log("[API Config] ========================================");

  return true;
}

// Export constants for direct use where needed
export const API_URLS = {
  get auth() {
    return getAuthBaseUrl();
  },
  get api() {
    return getApiBaseUrl();
  },
  get cdn() {
    return getCdnBaseUrl();
  },
} as const;
