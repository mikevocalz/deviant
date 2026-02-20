/**
 * Edge Function: live-surface
 * Returns the LiveSurfacePayload for a user — used by iOS Live Activity,
 * Dynamic Island, and Android ongoing notification.
 *
 * Deploy: npx supabase functions deploy live-surface --no-verify-jwt --project-ref npfjanxturvmjyevoyfo
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { CORS_HEADERS, jsonResponse } from "../_shared/verify-session.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEEP_LINK_BASE = "https://dvntlive.app";

// ── Helpers ────────────────────────────────────────────────────────────

function buildDeepLink(path: string): string {
  return `${DEEP_LINK_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

function getWeekStartISO(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

function getSevenDaysAgoISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

function makeSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
  });
}

// ── Session verification (Better Auth) ─────────────────────────────────

async function verifySession(
  supabase: ReturnType<typeof createClient>,
  token: string,
): Promise<{ authId: string; appUserId: number | null } | null> {
  const { data: session, error } = await supabase
    .from("session")
    .select("id, token, userId, expiresAt")
    .eq("token", token)
    .single();

  if (error || !session) return null;
  if (new Date(session.expiresAt) < new Date()) return null;

  const authId = session.userId as string;

  // Resolve app users.id (integer)
  const { data: appUser } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", authId)
    .single();

  return { authId, appUserId: appUser?.id ?? null };
}

// ── Tile 1: Upcoming or most recent event ──────────────────────────────

interface Tile1Result {
  eventId: string | null;
  title: string;
  startAt: string | null;
  venueName?: string;
  city?: string;
  heroThumbUrl?: string | null;
  isUpcoming: boolean;
  deepLink: string;
}

async function buildTile1(
  supabase: ReturnType<typeof createClient>,
  _authId: string,
): Promise<Tile1Result> {
  const now = new Date().toISOString();

  // Try upcoming first
  const { data: upcoming } = await supabase
    .from("events")
    .select("id, title, start_date, location, location_name, cover_image_url, image")
    .gte("start_date", now)
    .order("start_date", { ascending: true })
    .limit(1);

  if (upcoming && upcoming.length > 0) {
    const ev = upcoming[0];
    return {
      eventId: String(ev.id),
      title: ev.title || "Untitled Event",
      startAt: ev.start_date,
      venueName: ev.location_name || undefined,
      city: ev.location || undefined,
      heroThumbUrl: ev.cover_image_url || ev.image || null,
      isUpcoming: true,
      deepLink: buildDeepLink(`/e/${ev.id}`),
    };
  }

  // Fallback to most recent
  const { data: recent } = await supabase
    .from("events")
    .select("id, title, start_date, location, location_name, cover_image_url, image")
    .order("start_date", { ascending: false })
    .limit(1);

  if (recent && recent.length > 0) {
    const ev = recent[0];
    return {
      eventId: String(ev.id),
      title: ev.title || "Untitled Event",
      startAt: ev.start_date,
      venueName: ev.location_name || undefined,
      city: ev.location || undefined,
      heroThumbUrl: ev.cover_image_url || ev.image || null,
      isUpcoming: false,
      deepLink: buildDeepLink(`/e/${ev.id}`),
    };
  }

  // No events at all — CTA fallback
  return {
    eventId: null,
    title: "Create your first event",
    startAt: null,
    isUpcoming: false,
    deepLink: buildDeepLink("/events/create"),
  };
}

// ── Tile 2: Top moments (most-liked posts, last 7 days) ───────────────

interface Tile2Item {
  id: string;
  thumbUrl: string | null;
  deepLink: string;
  a11yLabel?: string;
}

interface Tile2Result {
  weekStartISO: string;
  items: Tile2Item[];
  recapDeepLink: string;
}

async function buildTile2(
  supabase: ReturnType<typeof createClient>,
): Promise<Tile2Result> {
  const weekStart = getWeekStartISO();
  const sevenDaysAgo = getSevenDaysAgoISO();

  // Get top 6 most-liked posts from last 7 days that have media
  const { data: posts } = await supabase
    .from("posts")
    .select(`
      id, content, likes_count,
      media:posts_media(type, url)
    `)
    .gte("created_at", sevenDaysAgo)
    .eq("visibility", "public")
    .order("likes_count", { ascending: false })
    .limit(6);

  const items: Tile2Item[] = [];

  for (const post of posts || []) {
    const mediaArr = Array.isArray(post.media) ? post.media : [];
    // Find first image (not video) for thumbnail
    const thumb =
      mediaArr.find((m: any) => m.type === "image")?.url ||
      mediaArr.find((m: any) => m.type === "thumbnail")?.url ||
      null;

    items.push({
      id: String(post.id),
      thumbUrl: thumb,
      deepLink: buildDeepLink(`/p/${post.id}`),
      a11yLabel: post.content
        ? post.content.slice(0, 40)
        : `Post ${post.id}`,
    });
  }

  // Pad to exactly 6 items
  while (items.length < 6) {
    items.push({
      id: `placeholder-${items.length}`,
      thumbUrl: null,
      deepLink: buildDeepLink(`/recap/week?start=${weekStart}`),
      a11yLabel: "Add moments",
    });
  }

  return {
    weekStartISO: weekStart,
    items,
    recapDeepLink: buildDeepLink(`/recap/week?start=${weekStart}`),
  };
}

// ── Tile 3: Top 3 events soon ──────────────────────────────────────────

interface Tile3Item {
  eventId: string;
  title: string;
  startAt: string;
  venueName?: string;
  city?: string;
  heroThumbUrl?: string | null;
  deepLink: string;
}

interface Tile3Result {
  items: Tile3Item[];
  seeAllDeepLink: string;
}

async function buildTile3(
  supabase: ReturnType<typeof createClient>,
): Promise<Tile3Result> {
  const now = new Date().toISOString();

  const { data: events } = await supabase
    .from("events")
    .select("id, title, start_date, location, location_name, cover_image_url, image")
    .gte("start_date", now)
    .order("start_date", { ascending: true })
    .limit(3);

  const items: Tile3Item[] = (events || []).map((ev: any) => ({
    eventId: String(ev.id),
    title: ev.title || "Untitled Event",
    startAt: ev.start_date,
    venueName: ev.location_name || undefined,
    city: ev.location || undefined,
    heroThumbUrl: ev.cover_image_url || ev.image || null,
    deepLink: buildDeepLink(`/e/${ev.id}`),
  }));

  return {
    items,
    seeAllDeepLink: buildDeepLink("/events?sort=soon"),
  };
}

// ── Main handler ───────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const supabase = makeSupabaseAdmin();

    // Extract token
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return jsonResponse({ ok: false, error: "Missing auth token" }, 401);
    }

    // Verify session
    const session = await verifySession(supabase, token);
    if (!session) {
      return jsonResponse({ ok: false, error: "Invalid or expired session" }, 401);
    }

    // Check for cached payload (rate limit: recompute at most once per 5 min)
    const cacheKey = `live_surface_${session.authId}`;
    const { data: cached } = await supabase
      .from("kv_cache")
      .select("value, updated_at")
      .eq("key", cacheKey)
      .single();

    if (cached) {
      const age = Date.now() - new Date(cached.updated_at).getTime();
      if (age < 5 * 60 * 1000) {
        // Return cached payload
        return jsonResponse({
          ok: true,
          data: typeof cached.value === "string"
            ? JSON.parse(cached.value)
            : cached.value,
          cached: true,
        });
      }
    }

    // Build all 3 tiles in parallel
    const [tile1, tile2, tile3] = await Promise.all([
      buildTile1(supabase, session.authId),
      buildTile2(supabase),
      buildTile3(supabase),
    ]);

    const payload = {
      generatedAt: new Date().toISOString(),
      tile1,
      tile2,
      tile3,
    };

    // Cache the payload (upsert)
    await supabase
      .from("kv_cache")
      .upsert(
        {
          key: cacheKey,
          value: JSON.stringify(payload),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      )
      .then(() => {})
      .catch((err: Error) => {
        console.warn("[live-surface] Cache write failed:", err.message);
      });

    return jsonResponse({ ok: true, data: payload, cached: false });
  } catch (err) {
    console.error("[live-surface] Error:", err);
    return jsonResponse(
      { ok: false, error: "Internal server error" },
      500,
    );
  }
});
