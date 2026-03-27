/**
 * Restore captions from backup project to production.
 * Run: npx tsx scripts/restore-captions.ts
 */
import { readFileSync } from "fs";
import { execSync } from "child_process";

const envContent = readFileSync(".env", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)/);
  if (match) envVars[match[1].trim()] = match[2].trim();
}

const raw = execSync(
  'security find-generic-password -s "Supabase CLI" -a "supabase" -w',
  { encoding: "utf-8" }
).trim();
const token = Buffer.from(raw.replace("go-keyring-base64:", ""), "base64").toString("utf-8");
const PROD_REF = "npfjanxturvmjyevoyfo";

async function query(sql: string) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROD_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return r.json();
}

// Confirmed matches: prod_id -> { content, location, likes_count, comments_count, is_nsfw }
const updates: Array<{
  id: number;
  content: string;
  location: string | null;
  likes_count: number;
  comments_count: number;
  is_nsfw: boolean;
  note: string;
}> = [
  {
    id: 111,
    content: "mic check.",
    location: "Madison Square Garden",
    likes_count: 4,
    comments_count: 1,
    is_nsfw: false,
    note: "bigtymer — backup id=63",
  },
  {
    id: 112,
    content: "Hello 👋🏾",
    location: null,
    likes_count: 5,
    comments_count: 1,
    is_nsfw: false,
    note: "c4our — backup id=56",
  },
  {
    id: 114,
    content: "Hi\n\n#DeviantAmbassador",
    location: null,
    likes_count: 3,
    comments_count: 1,
    is_nsfw: false,
    note: "leryia — backup id=66",
  },
  {
    id: 116,
    content: "Slow start to a perfect day 💝",
    location: null,
    likes_count: 5,
    comments_count: 1,
    is_nsfw: false,
    note: "micah_marquez — backup id=51",
  },
  {
    id: 118,
    content: "Tits to refresh the timeline",
    location: null,
    likes_count: 1,
    comments_count: 0,
    is_nsfw: true,
    note: "micah_marquez — backup id=52 (8-min CDN gap, probable match)",
  },
  {
    id: 119,
    content: "Leg day updates",
    location: null,
    likes_count: 6,
    comments_count: 1,
    is_nsfw: true,
    note: "micah_marquez — backup id=54 (22s CDN gap, probable match)",
  },
  {
    id: 121,
    content:
      'Look at my #PowerRangersTheMovie Funkos ⚡️❤️🙌🏿\n\n"It\'s Morphin Time"\n\n#powerrangers #mmpr #mightymorphinpowerrangers #zordon #ivanooze',
    location: "Harlem, New York",
    likes_count: 2,
    comments_count: 0,
    is_nsfw: false,
    note: "mikevocalz — backup id=49",
  },
  {
    id: 123,
    content:
      "I miss being a wedding singer in ATL 😩. I was really gigging every weekend.\n#music #weddingsinger #mj #michaeljackson #rockwithyou",
    location: null,
    likes_count: 4,
    comments_count: 2,
    is_nsfw: false,
    note: "mikevocalz — backup id=50",
  },
  {
    id: 124,
    content:
      "Classic album! I'll argue wit ya mammy bout this one! Brandy Full Moon hits!\n#brandy #fullmoon",
    location: "Times Square",
    likes_count: 1,
    comments_count: 0,
    is_nsfw: false,
    note: "mikevocalz — backup id=55",
  },
  {
    id: 125,
    content: "..and a star was born",
    location: null,
    likes_count: 5,
    comments_count: 3,
    is_nsfw: true,
    note: "plantdaddy88 — backup id=57",
  },
];

async function main() {
  console.log("=== CAPTION RESTORATION ===\n");

  // 1. UPDATE existing CDN-recovered posts with captions
  let success = 0;
  let failed = 0;

  for (const u of updates) {
    const contentSql = u.content.replace(/'/g, "''");
    const locationSql = u.location ? `'${u.location.replace(/'/g, "''")}'` : "NULL";
    const sql = `
      UPDATE posts
      SET content = '${contentSql}',
          location = ${locationSql},
          likes_count = ${u.likes_count},
          comments_count = ${u.comments_count},
          is_nsfw = ${u.is_nsfw}
      WHERE id = ${u.id}
      RETURNING id, content, location, likes_count
    `;
    const result = await query(sql);
    if (Array.isArray(result) && result.length > 0) {
      console.log(`✅ id=${u.id} (${u.note})`);
      console.log(`   content: "${result[0].content?.slice(0, 60)}"`);
      success++;
    } else {
      console.error(`❌ id=${u.id} FAILED: ${JSON.stringify(result)}`);
      failed++;
    }
  }

  // 2. INSERT text post — backup id=67, mikevocalz "Good Morning ☀️"
  // Skip 68 and 69 — exact duplicates submitted 7 seconds apart (UI double-tap bug)
  console.log('\n--- Inserting text post (backup id=67) ---');
  const insertResult = await query(`
    INSERT INTO posts (author_id, content, post_kind, visibility, created_at,
                       likes_count, comments_count, bookmarks_count, is_nsfw, is_repost, text_theme)
    VALUES (11, 'Good Morning ☀️', 'text', 'public', '2026-03-26 08:16:43.58+00',
            0, 0, 0, false, false, 'graphite')
    RETURNING id, content, created_at
  `);
  if (Array.isArray(insertResult) && insertResult.length > 0) {
    console.log(`✅ Inserted text post → id=${insertResult[0].id} "${insertResult[0].content}"`);
  } else {
    console.error(`❌ Insert failed: ${JSON.stringify(insertResult)}`);
  }

  // 3. Reconcile posts_count for all affected authors
  console.log('\n--- Reconciling posts_count ---');
  const authorIds = [11, 15, 46, 47, 54, 58];
  for (const authorId of authorIds) {
    const r = await query(`
      UPDATE users u
      SET posts_count = (SELECT COUNT(*) FROM posts WHERE author_id = ${authorId})
      WHERE u.id = ${authorId}
      RETURNING username, posts_count
    `);
    if (Array.isArray(r) && r[0]) {
      console.log(`  @${r[0].username}: posts_count = ${r[0].posts_count}`);
    }
  }

  // 4. Final verification
  console.log('\n--- Final check ---');
  const check = await query(`
    SELECT p.id, u.username, p.content, p.location, p.likes_count, p.post_kind
    FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.id IN (111,112,114,116,118,119,121,123,124,125)
       OR (p.author_id = 11 AND p.post_kind = 'text' AND p.created_at::date = '2026-03-26')
    ORDER BY p.id
  `);
  console.log(JSON.stringify(check, null, 2));

  console.log(`\n=== DONE === ✅ ${success} updated, ❌ ${failed} failed`);
}

main().catch(console.error);
