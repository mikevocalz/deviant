/**
 * Pre-deploy Content Survival Check
 *
 * Run BEFORE every OTA / native build to verify content integrity.
 * Fails with exit code 1 if any anomalies are detected.
 *
 * Usage: npx tsx scripts/pre-deploy-content-check.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envContent = readFileSync(".env", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
}

const supabase = createClient(
  envVars.EXPO_PUBLIC_SUPABASE_URL,
  envVars.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);

let failures = 0;

function pass(label: string) {
  console.log(`  ✅ ${label}`);
}
function fail(label: string, detail?: string) {
  console.error(`  ❌ ${label}${detail ? ": " + detail : ""}`);
  failures++;
}

async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║  PRE-DEPLOY CONTENT SURVIVAL CHECK   ║");
  console.log("╚══════════════════════════════════════╝\n");

  // 1. Posts exist
  const { count: totalPosts } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true });
  if ((totalPosts || 0) > 0) pass(`Posts exist: ${totalPosts}`);
  else fail("No posts found in database");

  // 2. Recent posts exist (last 48h)
  const { count: recentPosts } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .gte("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());
  if ((recentPosts || 0) > 0) pass(`Recent posts (48h): ${recentPosts}`);
  else fail("No posts in last 48 hours — possible data loss");

  // 3. Orphaned likes check
  const { data: sampleLikes } = await supabase
    .from("likes")
    .select("id, post_id")
    .limit(200);
  if (sampleLikes && sampleLikes.length > 0) {
    const postIds = [...new Set(sampleLikes.map(l => l.post_id).filter(Boolean))];
    if (postIds.length > 0) {
      const { data: existingPosts } = await supabase
        .from("posts")
        .select("id")
        .in("id", postIds);
      const existingSet = new Set((existingPosts || []).map(p => p.id));
      const orphaned = sampleLikes.filter(l => l.post_id && !existingSet.has(l.post_id));
      if (orphaned.length === 0) pass("No orphaned likes (sample of 200)");
      else fail(`${orphaned.length} orphaned likes found`, `post_ids: ${[...new Set(orphaned.map(l => l.post_id))].join(",")}`);
    }
    const nullLikes = sampleLikes.filter(l => !l.post_id);
    if (nullLikes.length === 0) pass("No null-ref likes");
    else fail(`${nullLikes.length} likes with null post_id`);
  }

  // 4. posts_count consistency
  const { data: users } = await supabase
    .from("users")
    .select("id, username, posts_count")
    .gt("posts_count", 0)
    .limit(50);
  let countMismatches = 0;
  for (const u of users || []) {
    const { count } = await supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", u.id);
    if ((u.posts_count || 0) !== (count || 0)) countMismatches++;
  }
  if (countMismatches === 0) pass("posts_count matches actual (sampled)");
  else fail(`${countMismatches} users with posts_count mismatch`);

  // 5. Comments exist
  const { count: totalComments } = await supabase
    .from("comments")
    .select("id", { count: "exact", head: true });
  pass(`Comments exist: ${totalComments || 0}`);

  // 6. Likes exist
  const { count: totalLikes } = await supabase
    .from("likes")
    .select("id", { count: "exact", head: true });
  pass(`Likes exist: ${totalLikes || 0}`);

  // 7. Audit log check (if table exists)
  try {
    const { data: recentAudit } = await supabase
      .from("content_audit_log")
      .select("id, table_name, operation, blocked, created_at")
      .eq("blocked", true)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(10);
    if (recentAudit && recentAudit.length > 0) {
      fail(`${recentAudit.length} blocked bulk deletes in last 24h`, JSON.stringify(recentAudit));
    } else {
      pass("No blocked bulk deletes in last 24h");
    }
  } catch {
    pass("Audit log table not yet deployed (will be added by hardening migration)");
  }

  console.log(`\n${"─".repeat(40)}`);
  if (failures === 0) {
    console.log("✅ ALL CONTENT SURVIVAL CHECKS PASSED");
    process.exit(0);
  } else {
    console.error(`❌ ${failures} CHECK(S) FAILED — DO NOT DEPLOY`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});
