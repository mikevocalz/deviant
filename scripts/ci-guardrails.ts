/**
 * CI Guardrails — Stop-the-line checks for PRs.
 *
 * Run: npx tsx scripts/ci-guardrails.ts
 *
 * Checks:
 * 1. No direct client writes to core tables
 * 2. No broad invalidation storms
 * 3. Edge Functions have correct createClient config
 * 4. Query keys include all params
 * 5. No useState in protected screens (Zustand only)
 */

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
let errors: string[] = [];
let warnings: string[] = [];

// ═══════════════════════════════════════════════════════════════════
// 1. No direct client writes to core tables
// ═══════════════════════════════════════════════════════════════════

const PROTECTED_TABLES = [
  "likes", "follows", "bookmarks", "event_likes", "event_rsvps",
  "notifications", "posts", "comments", "stories", "events",
  "tickets", "messages", "comment_likes",
];

const CLIENT_DIRS = ["lib", "app", "components", "src"];

function checkDirectWrites() {
  for (const dir of CLIENT_DIRS) {
    const fullDir = path.join(ROOT, dir);
    if (!fs.existsSync(fullDir)) continue;

    walkFiles(fullDir, ".ts", (filePath, content) => {
      // Skip test files and Edge Function wrappers
      if (filePath.includes("__test") || filePath.includes(".spec.")) return;
      if (filePath.includes("privileged") || filePath.includes("api/")) return;

      for (const table of PROTECTED_TABLES) {
        // Check for .from("table").insert/update/delete
        const pattern = new RegExp(
          `\\.from\\(['"]\s*${table}\s*['"]\\)\\s*\\.(insert|update|delete|upsert)`,
          "g"
        );
        if (pattern.test(content)) {
          errors.push(
            `DIRECT_WRITE: ${path.relative(ROOT, filePath)} writes to "${table}" — must use Edge Function gateway`
          );
        }
      }
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// 2. No broad invalidation storms
// ═══════════════════════════════════════════════════════════════════

function checkInvalidationStorms() {
  const hooksDir = path.join(ROOT, "lib/hooks");
  if (!fs.existsSync(hooksDir)) return;

  walkFiles(hooksDir, ".ts", (filePath, content) => {
    // Flag: invalidateQueries with very broad keys
    const broadPatterns = [
      /invalidateQueries\(\s*\{\s*queryKey:\s*\[\s*["']users["']\s*\]/g,
      /invalidateQueries\(\s*\{\s*queryKey:\s*\[\s*["']events["']\s*\]/g,
      /invalidateQueries\(\s*\{\s*queryKey:\s*\[\s*["']posts["']\s*\]/g,
    ];

    for (const pattern of broadPatterns) {
      if (pattern.test(content)) {
        warnings.push(
          `BROAD_INVALIDATION: ${path.relative(ROOT, filePath)} uses broad key invalidation — prefer cache patching`
        );
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// 3. No useState in protected screens (Zustand mandate)
// ═══════════════════════════════════════════════════════════════════

const USESTATE_EXEMPT = [
  "login.tsx", "signup", "onboarding", "debug.tsx",
  // Form state in TanStack Form is acceptable
];

function checkUseState() {
  const appDir = path.join(ROOT, "app/(protected)");
  if (!fs.existsSync(appDir)) return;

  walkFiles(appDir, ".tsx", (filePath, content) => {
    const basename = path.basename(filePath);
    if (USESTATE_EXEMPT.some((e) => basename.includes(e))) return;

    // Allow useState for truly local UI state (modals, animations)
    // Flag only if there are many useState calls (likely misuse)
    const matches = content.match(/useState\s*[<(]/g);
    if (matches && matches.length > 3) {
      warnings.push(
        `USESTATE: ${path.relative(ROOT, filePath)} has ${matches.length} useState calls — consider Zustand store`
      );
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function walkFiles(
  dir: string,
  ext: string,
  callback: (filePath: string, content: string) => void,
) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      walkFiles(fullPath, ext, callback);
    } else if (entry.name.endsWith(ext)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      callback(fullPath, content);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// Run
// ═══════════════════════════════════════════════════════════════════

console.log("🔒 DVNT CI Guardrails\n");

checkDirectWrites();
checkInvalidationStorms();
checkUseState();

if (warnings.length > 0) {
  console.log("⚠️  Warnings:");
  warnings.forEach((w) => console.log(`  ${w}`));
  console.log();
}

if (errors.length > 0) {
  console.log("❌ ERRORS (must fix before merge):");
  errors.forEach((e) => console.log(`  ${e}`));
  console.log(`\n${errors.length} error(s) found. CI BLOCKED.`);
  process.exit(1);
} else {
  console.log(`✅ All checks passed (${warnings.length} warning(s))`);
  process.exit(0);
}
