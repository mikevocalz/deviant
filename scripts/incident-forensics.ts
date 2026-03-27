/**
 * P0 Incident Forensics — Query production DB to determine data state.
 * Run: npx tsx scripts/incident-forensics.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Load env from .env file manually
const envContent = readFileSync(".env", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
}

const supabaseUrl = envVars.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function main() {
  console.log("=== P0 INCIDENT FORENSICS ===\n");

  // 1. Posts by day for last 7 days
  console.log("--- Posts by day (last 7 days) ---");
  const { data: allPosts, error: postsErr } = await supabase
    .from("posts")
    .select("id, created_at, author_id, post_kind, visibility, content")
    .gte(
      "created_at",
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    )
    .order("created_at", { ascending: true });

  if (postsErr) {
    console.error("Posts query error:", postsErr);
  } else {
    const byDay: Record<string, number> = {};
    for (const p of allPosts || []) {
      const day = new Date(p.created_at).toISOString().split("T")[0];
      byDay[day] = (byDay[day] || 0) + 1;
    }
    for (const [day, count] of Object.entries(byDay).sort()) {
      console.log(`  ${day}: ${count} posts`);
    }
    console.log(`  TOTAL: ${allPosts?.length || 0} posts in last 7 days`);
  }

  // 2. Total posts in DB
  console.log("\n--- Total posts in DB ---");
  const { count: totalPosts } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true });
  console.log(`  Total posts: ${totalPosts}`);

  // 3. Total comments
  console.log("\n--- Total comments in DB ---");
  const { count: totalComments } = await supabase
    .from("comments")
    .select("id", { count: "exact", head: true });
  console.log(`  Total comments: ${totalComments}`);

  // 4. Total likes
  console.log("\n--- Total likes in DB ---");
  const { count: totalLikes } = await supabase
    .from("likes")
    .select("id", { count: "exact", head: true });
  console.log(`  Total likes: ${totalLikes}`);

  // 5. Check for orphaned comments (pointing to non-existent posts)
  console.log("\n--- Orphaned comments (post_id doesn't exist) ---");
  const { data: orphanedComments, error: orphanErr } = await supabase
    .from("comments")
    .select("id, post_id, created_at, content")
    .not(
      "post_id",
      "in",
      `(${(allPosts || []).map((p) => p.id).join(",") || "0"})`,
    )
    .limit(20);
  // This won't work via PostgREST easily; let's try a different approach

  // 6. Check posts with 0 likes_count but should have likes
  console.log("\n--- Posts with likes_count mismatch (sample) ---");
  const { data: recentPosts } = await supabase
    .from("posts")
    .select("id, likes_count, comments_count, created_at, author_id")
    .gte(
      "created_at",
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    )
    .order("created_at", { ascending: false })
    .limit(20);

  if (recentPosts) {
    for (const p of recentPosts) {
      // Check actual likes count
      const { count: actualLikes } = await supabase
        .from("likes")
        .select("id", { count: "exact", head: true })
        .eq("post_id", p.id);

      // Check actual comments count
      const { count: actualComments } = await supabase
        .from("comments")
        .select("id", { count: "exact", head: true })
        .eq("post_id", p.id);

      const likeMismatch = (p.likes_count || 0) !== (actualLikes || 0);
      const commentMismatch = (p.comments_count || 0) !== (actualComments || 0);

      if (likeMismatch || commentMismatch) {
        console.log(
          `  POST ${p.id} (${new Date(p.created_at).toISOString()}):`,
        );
        if (likeMismatch)
          console.log(`    likes_count=${p.likes_count} actual=${actualLikes}`);
        if (commentMismatch)
          console.log(
            `    comments_count=${p.comments_count} actual=${actualComments}`,
          );
      }
    }
  }

  // 7. Check users posts_count vs actual
  console.log("\n--- Users with posts_count mismatch ---");
  const { data: users } = await supabase
    .from("users")
    .select("id, username, posts_count")
    .gt("posts_count", 0)
    .limit(50);

  if (users) {
    for (const u of users) {
      const { count: actualCount } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("author_id", u.id);

      if ((u.posts_count || 0) !== (actualCount || 0)) {
        console.log(
          `  USER ${u.username} (id=${u.id}): posts_count=${u.posts_count} actual=${actualCount}`,
        );
      }
    }
  }

  // 8. Check for deleted_at or soft-delete columns
  console.log("\n--- Schema check: soft delete columns on posts ---");
  const { data: postsSample } = await supabase
    .from("posts")
    .select("*")
    .limit(1);
  if (postsSample && postsSample[0]) {
    const cols = Object.keys(postsSample[0]);
    const softDeleteCols = cols.filter(
      (c) =>
        c.includes("deleted") ||
        c.includes("hidden") ||
        c.includes("archived") ||
        c.includes("removed"),
    );
    console.log(`  All columns: ${cols.join(", ")}`);
    console.log(
      `  Soft-delete columns: ${softDeleteCols.length > 0 ? softDeleteCols.join(", ") : "NONE"}`,
    );
  }

  // 9. Check RLS policies on posts
  console.log("\n--- RLS check: can we read all visibility types? ---");
  for (const vis of ["public", "followers", "private"]) {
    const { count } = await supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("visibility", vis);
    console.log(`  visibility='${vis}': ${count || 0} posts`);
  }

  // 10. Check migration history
  console.log("\n--- Migration history (last entries) ---");
  const { data: migrations } = await supabase
    .from("schema_migrations" as any)
    .select("*")
    .order("version", { ascending: false })
    .limit(10);
  if (migrations) {
    for (const m of migrations) {
      console.log(`  ${JSON.stringify(m)}`);
    }
  } else {
    console.log("  Could not read schema_migrations (may need service role)");
  }

  // 11. Check foreign key constraints on posts
  console.log("\n--- FK constraints check ---");
  // We check if likes reference posts that exist
  const { data: likesWithMissingPost } = await supabase
    .from("likes")
    .select("id, post_id")
    .limit(100);

  if (likesWithMissingPost) {
    const postIds = [...new Set(likesWithMissingPost.map((l) => l.post_id))];
    const { data: existingPosts } = await supabase
      .from("posts")
      .select("id")
      .in("id", postIds);
    const existingSet = new Set((existingPosts || []).map((p) => p.id));
    const orphanedLikes = likesWithMissingPost.filter(
      (l) => !existingSet.has(l.post_id),
    );
    console.log(
      `  Sampled ${likesWithMissingPost.length} likes, ${orphanedLikes.length} point to missing posts`,
    );
  }

  // 12. Most recent posts (last 48 hours) - detailed view
  console.log("\n--- Last 48h posts (detailed) ---");
  const { data: recent48h } = await supabase
    .from("posts")
    .select(
      "id, created_at, author_id, post_kind, visibility, likes_count, comments_count, content",
    )
    .gte("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false });

  if (recent48h) {
    console.log(`  Total posts in last 48h: ${recent48h.length}`);
    for (const p of recent48h) {
      const contentPreview = p.content
        ? p.content.substring(0, 40)
        : "(no content)";
      console.log(
        `  [${new Date(p.created_at).toISOString()}] id=${p.id} kind=${p.post_kind} vis=${p.visibility} likes=${p.likes_count} comments=${p.comments_count} "${contentPreview}"`,
      );
    }
  }

  console.log("\n=== FORENSICS COMPLETE ===");
}

main().catch(console.error);
