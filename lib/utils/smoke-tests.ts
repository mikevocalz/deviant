/**
 * Core Smoke Test Suite
 * 
 * PHASE 3: E2E Regression Gate
 * 
 * These tests should run on every PR/commit.
 * Run until ALL pass - do not ship if any fail.
 * 
 * Usage:
 * - Import and run in dev mode: runSmokeTests()
 * - Or run individual tests for debugging
 */

import { getApiBaseUrl, getAuthBaseUrl, getCdnBaseUrl } from "@/lib/api-config";

export interface SmokeTestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

export interface SmokeTestSuite {
  results: SmokeTestResult[];
  passed: number;
  failed: number;
  total: number;
  allPassed: boolean;
}

/**
 * Run a single smoke test with error handling and timing
 */
async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<SmokeTestResult> {
  const start = Date.now();
  try {
    await testFn();
    return {
      name,
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error: any) {
    return {
      name,
      passed: false,
      error: error?.message || String(error),
      duration: Date.now() - start,
    };
  }
}

/**
 * Test: API Configuration is valid
 */
export async function testApiConfig(): Promise<void> {
  const authUrl = getAuthBaseUrl();
  const apiUrl = getApiBaseUrl();
  const cdnUrl = getCdnBaseUrl();

  if (!authUrl || !authUrl.startsWith("https://")) {
    throw new Error(`Invalid AUTH_URL: ${authUrl}`);
  }
  if (!apiUrl || !apiUrl.startsWith("https://")) {
    throw new Error(`Invalid API_URL: ${apiUrl}`);
  }
  if (!cdnUrl || !cdnUrl.startsWith("https://")) {
    throw new Error(`Invalid CDN_URL: ${cdnUrl}`);
  }
  if (authUrl.includes("localhost") || apiUrl.includes("localhost")) {
    throw new Error("URLs contain localhost - invalid for production");
  }
}

/**
 * Test: API Health Check
 */
export async function testApiHealth(): Promise<void> {
  const apiUrl = getApiBaseUrl();
  const response = await fetch(`${apiUrl}/api/users?limit=1`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok && response.status !== 401) {
    throw new Error(`API health check failed: ${response.status}`);
  }
}

/**
 * Test: Auth endpoint reachable
 */
export async function testAuthEndpoint(): Promise<void> {
  const authUrl = getAuthBaseUrl();
  const response = await fetch(`${authUrl}/api/auth/session`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  // Should return 200 (with null session) or 401
  if (!response.ok && response.status !== 401) {
    throw new Error(`Auth endpoint failed: ${response.status}`);
  }
}

/**
 * Test: Feed endpoint returns data
 */
export async function testFeedEndpoint(): Promise<void> {
  const apiUrl = getApiBaseUrl();
  const response = await fetch(`${apiUrl}/api/posts?limit=5`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Feed endpoint failed: ${response.status}`);
  }

  const data = await response.json();
  if (!data || typeof data !== "object") {
    throw new Error("Feed returned invalid data structure");
  }
}

/**
 * Test: CDN is reachable
 */
export async function testCdnReachable(): Promise<void> {
  const cdnUrl = getCdnBaseUrl();
  // Just do a HEAD request to check reachability
  const response = await fetch(cdnUrl, {
    method: "HEAD",
  });

  // CDN might return 403 for root, but should be reachable
  if (response.status >= 500) {
    throw new Error(`CDN unreachable: ${response.status}`);
  }
}

/**
 * Run all smoke tests
 */
export async function runSmokeTests(): Promise<SmokeTestSuite> {
  console.log("[SmokeTests] ========================================");
  console.log("[SmokeTests] Starting Core Smoke Test Suite");
  console.log("[SmokeTests] ========================================");

  const tests = [
    { name: "API Configuration Valid", fn: testApiConfig },
    { name: "API Health Check", fn: testApiHealth },
    { name: "Auth Endpoint Reachable", fn: testAuthEndpoint },
    { name: "Feed Endpoint Works", fn: testFeedEndpoint },
    { name: "CDN Reachable", fn: testCdnReachable },
  ];

  const results: SmokeTestResult[] = [];

  for (const test of tests) {
    console.log(`[SmokeTests] Running: ${test.name}...`);
    const result = await runTest(test.name, test.fn);
    results.push(result);

    if (result.passed) {
      console.log(`[SmokeTests] ✓ ${test.name} (${result.duration}ms)`);
    } else {
      console.error(`[SmokeTests] ✗ ${test.name}: ${result.error}`);
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log("[SmokeTests] ========================================");
  console.log(`[SmokeTests] Results: ${passed}/${results.length} passed`);
  if (failed > 0) {
    console.error(`[SmokeTests] FAILED: ${failed} tests failed`);
  } else {
    console.log("[SmokeTests] ALL TESTS PASSED ✓");
  }
  console.log("[SmokeTests] ========================================");

  return {
    results,
    passed,
    failed,
    total: results.length,
    allPassed: failed === 0,
  };
}

/**
 * Manual test checklist for UI testing
 * These require manual verification but should be checked on every release
 */
export const MANUAL_TEST_CHECKLIST = [
  "[ ] Signup (18+) - DOB validation works",
  "[ ] Login - Auth flow completes",
  "[ ] Open profile - No crash",
  "[ ] Create post with caption - Post appears",
  "[ ] Post appears in feed + profile + detail",
  "[ ] Like twice → count only +1",
  "[ ] Bookmark twice → only one bookmark",
  "[ ] Saved shows bookmarked post",
  "[ ] Follow/unfollow works",
  "[ ] Comments + reply show threaded (2 levels)",
  "[ ] Comment input clears after submit",
  "[ ] Open video post detail - No crash",
  "[ ] My Story shows only mine",
  "[ ] Other stories grouped correctly",
  "[ ] No double-play on stories",
  "[ ] Message from non-followed → Spam",
  "[ ] Follow back → moves to Inbox",
  "[ ] Badge count matches Inbox unread only",
];

/**
 * Print manual test checklist
 */
export function printManualChecklist(): void {
  console.log("\n========================================");
  console.log("MANUAL TEST CHECKLIST");
  console.log("Check each item before releasing:");
  console.log("========================================\n");
  MANUAL_TEST_CHECKLIST.forEach((item) => console.log(item));
  console.log("\n========================================\n");
}
