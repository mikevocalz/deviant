/**
 * Apply P0 Recovery + Hardening SQL directly to production.
 * Bypasses supabase migration history (which is tangled).
 * Uses the DATABASE_URL from .env for direct psql-like access via pg.
 *
 * Usage: npx tsx scripts/apply-p0-recovery.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envContent = readFileSync(".env", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
}

const supabaseUrl = envVars.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function main() {
  console.log("=== APPLYING P0 RECOVERY ===\n");

  // ── 1. Clean orphaned likes with NULL post_id ──
  console.log("Step 1: Clean orphaned null-ref likes...");
  const { data: nullLikes, error: nlErr } = await supabase
    .from("likes")
    .delete()
    .is("post_id", null)
    .select("id");
  if (nlErr) console.error("  ERROR:", nlErr.message);
  else console.log(`  Deleted ${nullLikes?.length || 0} null-ref likes`);

  // ── 2. Reconcile users.posts_count ──
  console.log("\nStep 2: Reconcile users.posts_count...");
  const { data: allUsers } = await supabase
    .from("users")
    .select("id, username, posts_count");

  let fixedUsers = 0;
  for (const u of allUsers || []) {
    const { count: actual } = await supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", u.id);

    const actualCount = actual || 0;
    const cached = u.posts_count || 0;

    if (cached !== actualCount) {
      const { error } = await supabase
        .from("users")
        .update({ posts_count: actualCount })
        .eq("id", u.id);
      if (error) {
        console.error(`  ERROR updating @${u.username}:`, error.message);
      } else {
        console.log(`  Fixed @${u.username}: ${cached} → ${actualCount}`);
        fixedUsers++;
      }
    }
  }
  console.log(`  Fixed ${fixedUsers} users`);

  // ── 3. Reconcile posts.likes_count ──
  console.log("\nStep 3: Reconcile posts.likes_count...");
  const { data: allPosts } = await supabase
    .from("posts")
    .select("id, likes_count");

  let fixedLikes = 0;
  for (const p of allPosts || []) {
    const { count: actual } = await supabase
      .from("likes")
      .select("id", { count: "exact", head: true })
      .eq("post_id", p.id);

    const actualCount = actual || 0;
    const cached = p.likes_count || 0;

    if (cached !== actualCount) {
      const { error } = await supabase
        .from("posts")
        .update({ likes_count: actualCount })
        .eq("id", p.id);
      if (error) {
        console.error(`  ERROR updating post ${p.id}:`, error.message);
      } else {
        console.log(`  Fixed post ${p.id}: likes ${cached} → ${actualCount}`);
        fixedLikes++;
      }
    }
  }
  console.log(`  Fixed ${fixedLikes} posts`);

  // ── 4. Reconcile posts.comments_count ──
  console.log("\nStep 4: Reconcile posts.comments_count...");
  let fixedComments = 0;
  for (const p of allPosts || []) {
    const { count: actual } = await supabase
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("post_id", p.id);

    // We need the current comments_count — refetch it
    const { data: postData } = await supabase
      .from("posts")
      .select("comments_count")
      .eq("id", p.id)
      .single();

    const actualCount = actual || 0;
    const cached = postData?.comments_count || 0;

    if (cached !== actualCount) {
      const { error } = await supabase
        .from("posts")
        .update({ comments_count: actualCount })
        .eq("id", p.id);
      if (error) {
        console.error(`  ERROR updating post ${p.id}:`, error.message);
      } else {
        console.log(`  Fixed post ${p.id}: comments ${cached} → ${actualCount}`);
        fixedComments++;
      }
    }
  }
  console.log(`  Fixed ${fixedComments} posts`);

  console.log("\n=== P0 RECOVERY COMPLETE ===");
}

main().catch(console.error);
