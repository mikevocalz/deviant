/**
 * Apply P0 Hardening DDL directly to production via Supabase Management API.
 * Reads the hardening SQL file and executes it via the SQL endpoint.
 *
 * Usage: npx tsx scripts/apply-p0-hardening.ts
 */

import { readFileSync } from "fs";

const envContent = readFileSync(".env", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
}

const projectRef = "npfjanxturvmjyevoyfo";

// Read the Supabase access token from env or linked config
async function getAccessToken(): Promise<string> {
  // Try reading from supabase CLI config
  const { execSync } = await import("child_process");
  try {
    const token = execSync("npx supabase projects list 2>&1 | head -1", {
      encoding: "utf-8",
    });
    // If we get here, CLI is authenticated. Use the Management API approach.
  } catch {}

  // Fallback: use DATABASE_URL for direct psql
  return "";
}

async function executeSqlViaPsql(sql: string): Promise<void> {
  const { execSync } = await import("child_process");

  // Use the pooler connection string from .env
  const dbUri = envVars.DATABASE_URI || envVars.DATABASE_URL;
  if (!dbUri) {
    throw new Error("No DATABASE_URI or DATABASE_URL in .env");
  }

  // Write SQL to a temp file to avoid shell escaping issues
  const { writeFileSync, unlinkSync } = await import("fs");
  const tmpFile = "/tmp/p0_hardening.sql";
  writeFileSync(tmpFile, sql);

  try {
    const result = execSync(`psql "${dbUri}" -f "${tmpFile}" 2>&1`, {
      encoding: "utf-8",
      timeout: 30000,
    });
    console.log(result);
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

async function executeSqlViaSupabaseApi(sql: string): Promise<void> {
  const { execSync } = await import("child_process");

  // Use supabase CLI's db execute (if available)
  const { writeFileSync, unlinkSync } = await import("fs");
  const tmpFile = "/tmp/p0_hardening.sql";
  writeFileSync(tmpFile, sql);

  try {
    const result = execSync(
      `npx supabase db execute --linked < "${tmpFile}" 2>&1`,
      { encoding: "utf-8", timeout: 60000 },
    );
    console.log(result);
  } catch (err: any) {
    console.error("supabase db execute failed, trying psql fallback...");
    await executeSqlViaPsql(sql);
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

async function main() {
  console.log("=== APPLYING P0 HARDENING DDL ===\n");

  const hardeningSql = readFileSync(
    "supabase/migrations/20260327200100_p0_hardening_audit_and_guards.sql",
    "utf-8",
  );

  console.log("SQL length:", hardeningSql.length, "chars");
  console.log("Executing against production...\n");

  await executeSqlViaSupabaseApi(hardeningSql);

  console.log("\n=== P0 HARDENING APPLIED ===");
}

main().catch(console.error);
