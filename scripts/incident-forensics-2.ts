/**
 * P0 Incident Forensics Part 2 — Quantify blast radius
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envContent = readFileSync(".env", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
}

const supabase = createClient(envVars.EXPO_PUBLIC_SUPABASE_URL, envVars.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("=== P0 INCIDENT FORENSICS — BLAST RADIUS ===\n");

  // 1. Find ALL existing post IDs
  const { data: allPosts } = await supabase
    .from("posts")
    .select("id")
    .order("id", { ascending: true });
  const postIds = new Set((allPosts || []).map(p => p.id));
  console.log("--- Existing post IDs ---");
  console.log(`  IDs: ${[...postIds].join(", ")}`);
  console.log(`  Count: ${postIds.size}`);

  // Find gaps in IDs
  const maxId = Math.max(...postIds);
  const missingIds: number[] = [];
  for (let i = 1; i <= maxId; i++) {
    if (!postIds.has(i)) missingIds.push(i);
  }
  console.log(`  Max ID: ${maxId}`);
  console.log(`  Missing IDs (gaps): ${missingIds.length}`);
  console.log(`  Missing: ${missingIds.join(", ")}`);

  // 2. Orphaned likes (likes pointing to missing posts)
  console.log("\n--- Orphaned likes (reference deleted posts) ---");
  const { data: allLikes } = await supabase
    .from("likes")
    .select("id, post_id, user_id, created_at")
    .order("created_at", { ascending: false });

  const orphanedLikes = (allLikes || []).filter(l => !postIds.has(l.post_id));
  console.log(`  Total likes: ${allLikes?.length || 0}`);
  console.log(`  Orphaned likes (post deleted): ${orphanedLikes.length}`);

  // Group orphaned likes by deleted post_id
  const orphanByPost: Record<number, number> = {};
  for (const l of orphanedLikes) {
    orphanByPost[l.post_id] = (orphanByPost[l.post_id] || 0) + 1;
  }
  console.log("  Orphaned likes by deleted post_id:");
  for (const [pid, count] of Object.entries(orphanByPost).sort((a, b) => Number(b[1]) - Number(a[1]))) {
    console.log(`    post_id=${pid}: ${count} likes`);
  }

  // 3. Orphaned comments (comments pointing to missing posts)
  console.log("\n--- Orphaned comments (reference deleted posts) ---");
  const { data: allComments } = await supabase
    .from("comments")
    .select("id, post_id, author_id, content, created_at, parent_id, root_id")
    .order("created_at", { ascending: false });

  const orphanedComments = (allComments || []).filter(c => !postIds.has(c.post_id));
  console.log(`  Total comments: ${allComments?.length || 0}`);
  console.log(`  Orphaned comments (post deleted): ${orphanedComments.length}`);

  if (orphanedComments.length > 0) {
    const orphanCommentsByPost: Record<number, number> = {};
    for (const c of orphanedComments) {
      orphanCommentsByPost[c.post_id] = (orphanCommentsByPost[c.post_id] || 0) + 1;
    }
    console.log("  Orphaned comments by deleted post_id:");
    for (const [pid, count] of Object.entries(orphanCommentsByPost)) {
      console.log(`    post_id=${pid}: ${count} comments`);
    }
  }

  // 4. Orphaned bookmarks
  console.log("\n--- Orphaned bookmarks ---");
  const { data: allBookmarks } = await supabase
    .from("bookmarks")
    .select("id, post_id")
    .limit(1000);
  const orphanedBookmarks = (allBookmarks || []).filter(b => !postIds.has(b.post_id));
  console.log(`  Total bookmarks: ${allBookmarks?.length || 0}`);
  console.log(`  Orphaned bookmarks: ${orphanedBookmarks.length}`);

  // 5. Orphaned posts_media
  console.log("\n--- Orphaned posts_media ---");
  const { data: allMedia } = await supabase
    .from("posts_media")
    .select("id, _parent_id, url")
    .limit(1000);
  const orphanedMedia = (allMedia || []).filter(m => !postIds.has(m._parent_id));
  console.log(`  Total media rows: ${allMedia?.length || 0}`);
  console.log(`  Orphaned media (post deleted): ${orphanedMedia.length}`);
  if (orphanedMedia.length > 0) {
    console.log("  Orphaned media URLs (potential recovery source):");
    for (const m of orphanedMedia.slice(0, 20)) {
      console.log(`    post_id=${m._parent_id}: ${m.url}`);
    }
  }

  // 6. Orphaned post_text_slides
  console.log("\n--- Orphaned post_text_slides ---");
  const { data: allSlides } = await supabase
    .from("post_text_slides")
    .select("id, post_id, content")
    .limit(1000);
  const orphanedSlides = (allSlides || []).filter(s => !postIds.has(s.post_id));
  console.log(`  Total slides: ${allSlides?.length || 0}`);
  console.log(`  Orphaned slides: ${orphanedSlides.length}`);

  // 7. Orphaned notifications
  console.log("\n--- Orphaned notifications (reference deleted posts) ---");
  const { data: allNotifs } = await supabase
    .from("notifications")
    .select("id, post_id, type, created_at")
    .not("post_id", "is", null)
    .limit(1000);
  const orphanedNotifs = (allNotifs || []).filter(n => n.post_id && !postIds.has(n.post_id));
  console.log(`  Total post-related notifications: ${allNotifs?.length || 0}`);
  console.log(`  Orphaned notifications: ${orphanedNotifs.length}`);
  if (orphanedNotifs.length > 0) {
    const orphanNotifsByPost: Record<number, number> = {};
    for (const n of orphanedNotifs) {
      orphanNotifsByPost[n.post_id] = (orphanNotifsByPost[n.post_id] || 0) + 1;
    }
    console.log("  Orphaned notifications by deleted post_id:");
    for (const [pid, count] of Object.entries(orphanNotifsByPost).sort((a, b) => Number(b[1]) - Number(a[1]))) {
      console.log(`    post_id=${pid}: ${count} notifications`);
    }
  }

  // 8. All users posts_count vs actual
  console.log("\n--- ALL users posts_count vs actual ---");
  const { data: allUsers } = await supabase
    .from("users")
    .select("id, username, posts_count");

  if (allUsers) {
    for (const u of allUsers) {
      const { count: actual } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("author_id", u.id);
      const cached = u.posts_count || 0;
      const actualCount = actual || 0;
      if (cached !== actualCount) {
        console.log(`  MISMATCH: @${u.username} (id=${u.id}) cached=${cached} actual=${actualCount} delta=${cached - actualCount}`);
      }
    }
  }

  // 9. Deleted post IDs that still have artifacts (recovery evidence)
  console.log("\n--- Deleted posts with surviving artifacts (recovery candidates) ---");
  const allOrphanPostIds = new Set([
    ...orphanedLikes.map(l => l.post_id),
    ...orphanedComments.map(c => c.post_id),
    ...orphanedMedia.map(m => m._parent_id),
    ...orphanedSlides.map(s => s.post_id),
    ...orphanedNotifs.map(n => n.post_id),
  ]);
  console.log(`  Unique deleted post IDs with surviving artifacts: ${allOrphanPostIds.size}`);
  console.log(`  IDs: ${[...allOrphanPostIds].sort((a, b) => a - b).join(", ")}`);

  console.log("\n=== BLAST RADIUS ASSESSMENT COMPLETE ===");
}

main().catch(console.error);
