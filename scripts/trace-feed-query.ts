/**
 * Trace exactly what the feed query returns — same query the app uses.
 * Simulates both the direct PostgREST path and the bootstrap-feed edge function.
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

async function main() {
  console.log("=== FEED QUERY TRACE ===\n");

  // 1. Direct PostgREST query (same as getFeedPostsPaginated)
  console.log("--- 1. Direct PostgREST feed query (page 0, 20 items) ---");
  const PAGE_SIZE = 20;
  const { data: posts, error, count } = await supabase
    .from("posts")
    .select(
      `
      *,
      author:users!posts_author_id_users_id_fk(
        id, username, first_name, verified,
        avatar:avatar_id(url)
      ),
      media:posts_media(
        type, url, "order", mime_type, live_photo_video_url
      )
    `,
      { count: "exact" },
    )
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .range(0, PAGE_SIZE - 1);

  if (error) {
    console.error("  QUERY ERROR:", error);
  } else {
    console.log(`  Total count: ${count}`);
    console.log(`  Page 0 returned: ${posts?.length || 0} posts`);
    if (posts) {
      for (const p of posts) {
        const authorName = (p as any).author?.username || "unknown";
        const mediaCount = (p as any).media?.length || 0;
        const contentPreview = p.content ? p.content.substring(0, 50) : "(no content)";
        console.log(`  [${new Date(p.created_at).toISOString().slice(0, 16)}] id=${p.id} @${authorName} kind=${p.post_kind} media=${mediaCount} "${contentPreview}"`);
      }
    }
  }

  // 2. Check if bootstrap-feed edge function works
  console.log("\n--- 2. Bootstrap-feed edge function ---");
  try {
    // We need a user_id to call this. Let's try mikevocalz (id=11)
    const { data: bsData, error: bsError } = await supabase.functions.invoke(
      "bootstrap-feed",
      { body: { user_id: "11", cursor: 0, limit: 20 } },
    );
    if (bsError) {
      console.error("  BOOTSTRAP ERROR:", bsError);
    } else if (bsData) {
      console.log(`  Posts returned: ${bsData.posts?.length || 0}`);
      console.log(`  Stories returned: ${bsData.stories?.length || 0}`);
      if (bsData.posts) {
        for (const p of bsData.posts.slice(0, 10)) {
          console.log(`  [${p.created_at?.slice(0, 16)}] id=${p.id} @${p.author?.username || "?"} kind=${p.post_kind}`);
        }
      }
      if (bsData.error) console.error("  BOOTSTRAP DATA ERROR:", bsData.error);
    } else {
      console.log("  BOOTSTRAP RETURNED NULL");
    }
  } catch (err) {
    console.error("  BOOTSTRAP EXCEPTION:", err);
  }

  // 3. Check auth - is the anon key able to read posts?
  console.log("\n--- 3. Raw anon SELECT (no joins) ---");
  const { data: raw, error: rawErr } = await supabase
    .from("posts")
    .select("id, created_at, author_id, post_kind, visibility")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(10);
  if (rawErr) {
    console.error("  RAW ERROR:", rawErr);
  } else {
    console.log(`  Returned: ${raw?.length || 0} posts`);
    for (const p of raw || []) {
      console.log(`  id=${p.id} author=${p.author_id} kind=${p.post_kind} vis=${p.visibility}`);
    }
  }

  // 4. Check RLS - what policy is on posts?
  console.log("\n--- 4. Check if text_slides hydration works ---");
  const textPosts = (posts || []).filter((p: any) => p.post_kind === "text");
  if (textPosts.length > 0) {
    const textPostIds = textPosts.map((p: any) => p.id);
    const { data: slides, error: slidesErr } = await supabase
      .from("post_text_slides")
      .select("*")
      .in("post_id", textPostIds);
    if (slidesErr) {
      console.error("  SLIDES ERROR:", slidesErr);
    } else {
      console.log(`  Text posts: ${textPosts.length}, Slides: ${slides?.length || 0}`);
    }
  } else {
    console.log("  No text posts in first page");
  }

  // 5. Check if the transformPost function could be dropping posts
  console.log("\n--- 5. Check for posts with null/broken author join ---");
  const brokenAuthor = (posts || []).filter((p: any) => !p.author || !p.author.username);
  console.log(`  Posts with broken author join: ${brokenAuthor.length}`);
  for (const p of brokenAuthor) {
    console.log(`  id=${p.id} author_id=${p.author_id} author_data=${JSON.stringify((p as any).author)}`);
  }

  // 6. Check for posts with null/broken media
  console.log("\n--- 6. Check media posts missing media rows ---");
  const mediaPosts = (posts || []).filter((p: any) => p.post_kind === "media");
  const mediaPostsMissingMedia = mediaPosts.filter((p: any) => !p.media || p.media.length === 0);
  console.log(`  Media posts: ${mediaPosts.length}, Missing media: ${mediaPostsMissingMedia.length}`);
  for (const p of mediaPostsMissingMedia) {
    console.log(`  id=${p.id} author_id=${p.author_id} content="${p.content?.substring(0, 30) || "(none)"}"`);
  }

  console.log("\n=== TRACE COMPLETE ===");
}

main().catch(console.error);
