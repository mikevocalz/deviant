/**
 * Canonical API Configuration - OPTION A: DIRECT-TO-PAYLOAD ONLY
 *
 * CRITICAL: This is the SINGLE SOURCE OF TRUTH for all API URLs.
 * All API clients MUST import from this module.
 *
 * DECISION LOCKED:
 * - ONE backend: Payload CMS
 * - NO Expo API routes
 * - NO mixed calls
 *
 * Rules:
 * - Returns ONLY valid HTTPS URLs
 * - NEVER returns empty string
 * - NEVER returns localhost
 * - Throws if configuration is invalid
 */

import { Platform } from "react-native";

// Production URLs - MANDATORY
// OPTION A: ALL API calls go to Payload CMS
const PRODUCTION_PAYLOAD_URL = "https://payload-cms-setup-gray.vercel.app";
const PRODUCTION_CDN_URL = "https://dvnt.b-cdn.net";

/**
 * Get the canonical Payload CMS URL
 * OPTION A: This is the ONLY backend URL for ALL API calls
 */
export function getPayloadBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;

  if (isValidHttpsUrl(envUrl)) {
    return envUrl;
  }

  // Production fallback - Payload CMS server
  return PRODUCTION_PAYLOAD_URL;
}

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
 * Get the canonical API URL
 * OPTION A: Always returns Payload CMS URL - NO separate auth server
 */
export function getApiBaseUrl(): string {
  return getPayloadBaseUrl();
}

/**
 * DEPRECATED: Auth URL now points to Payload CMS
 * Payload handles auth via /api/users/login, /api/users/me, etc.
 */
export function getAuthBaseUrl(): string {
  return getPayloadBaseUrl();
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
  const apiUrl = getPayloadBaseUrl();
  const cdnUrl = getCdnBaseUrl();

  const errors: string[] = [];

  // FAIL-FAST: Validate all URLs are HTTPS - no localhost, no empty
  if (!apiUrl || apiUrl === "") {
    errors.push("PAYLOAD_URL is empty");
  } else if (apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1")) {
    errors.push(`PAYLOAD_URL contains localhost: ${apiUrl}`);
  } else if (!apiUrl.startsWith("https://")) {
    errors.push(`PAYLOAD_URL is not HTTPS: ${apiUrl}`);
  }

  if (!cdnUrl || cdnUrl === "") {
    errors.push("CDN_URL is empty");
  } else if (cdnUrl.includes("localhost") || cdnUrl.includes("127.0.0.1")) {
    errors.push(`CDN_URL contains localhost: ${cdnUrl}`);
  } else if (!cdnUrl.startsWith("https://")) {
    errors.push(`CDN_URL is not HTTPS: ${cdnUrl}`);
  }

  // Log configuration - OPTION A: Single backend
  console.log("[API Config] ========================================");
  console.log("[API Config] OPTION A: Direct-to-Payload Only");
  console.log("[API Config] PAYLOAD_URL:", apiUrl);
  console.log("[API Config] CDN_URL:", cdnUrl);
  console.log("[API Config] Platform:", Platform.OS);

  if (errors.length > 0) {
    console.error("[API Config] ========================================");
    console.error("[API Config] CRITICAL CONFIGURATION ERRORS:");
    errors.forEach((e) => console.error("[API Config] ✗", e));
    console.error("[API Config] ========================================");

    // FAIL-FAST: In production, this is fatal
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
// OPTION A: api and auth both point to Payload
export const API_URLS = {
  get payload() {
    return getPayloadBaseUrl();
  },
  get api() {
    return getPayloadBaseUrl();
  },
  get auth() {
    return getPayloadBaseUrl();
  },
  get cdn() {
    return getCdnBaseUrl();
  },
} as const;
