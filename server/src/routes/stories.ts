import { Hono } from "hono";
import { payloadClient, getCookiesFromRequest } from "../lib/payload";

// Import Bunny storage utilities (server-side only)
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || process.env.EXPO_PUBLIC_BUNNY_STORAGE_ZONE || "";
const BUNNY_STORAGE_API_KEY = process.env.BUNNY_STORAGE_API_KEY || process.env.EXPO_PUBLIC_BUNNY_STORAGE_API_KEY || "";
const BUNNY_STORAGE_REGION = process.env.BUNNY_STORAGE_REGION || process.env.EXPO_PUBLIC_BUNNY_STORAGE_REGION || "ny";
const BUNNY_CDN_URL = process.env.BUNNY_CDN_URL || process.env.EXPO_PUBLIC_BUNNY_CDN_URL || "";

const getStorageEndpoint = () => {
  if (BUNNY_STORAGE_REGION === "de" || BUNNY_STORAGE_REGION === "falkenstein") {
    return "storage.bunnycdn.com";
  }
  return `${BUNNY_STORAGE_REGION}.storage.bunnycdn.com`;
};

function extractStoragePathFromUrl(cdnUrl: string): string | null {
  if (!cdnUrl || typeof cdnUrl !== "string") return null;
  try {
    let path = cdnUrl;
    if (BUNNY_CDN_URL && cdnUrl.startsWith(BUNNY_CDN_URL)) {
      path = cdnUrl.replace(BUNNY_CDN_URL, "");
    } else {
      const bCdnMatch = cdnUrl.match(/\.b-cdn\.net\/(.+)$/);
      if (bCdnMatch) {
        path = bCdnMatch[1];
      } else {
        const storageMatch = cdnUrl.match(/storage\.bunnycdn\.com\/[^\/]+\/(.+)$/);
        if (storageMatch) {
          path = storageMatch[1];
        } else {
          const urlMatch = cdnUrl.match(/https?:\/\/[^\/]+\/(.+)$/);
          if (urlMatch) path = urlMatch[1];
        }
      }
    }
    path = path.replace(/^\//, "");
    if (BUNNY_STORAGE_ZONE && path.startsWith(`${BUNNY_STORAGE_ZONE}/`)) {
      path = path.replace(`${BUNNY_STORAGE_ZONE}/`, "");
    }
    return path || null;
  } catch {
    return null;
  }
}

async function deleteFromBunnyByUrl(cdnUrl: string): Promise<boolean> {
  if (!BUNNY_STORAGE_ZONE || !BUNNY_STORAGE_API_KEY) return false;
  const path = extractStoragePathFromUrl(cdnUrl);
  if (!path) return false;
  try {
    const endpoint = getStorageEndpoint();
    const deleteUrl = `https://${endpoint}/${BUNNY_STORAGE_ZONE}/${path}`;
    const response = await fetch(deleteUrl, {
      method: "DELETE",
      headers: { AccessKey: BUNNY_STORAGE_API_KEY },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export const storiesRoutes = new Hono();

// GET /api/stories
storiesRoutes.get("/", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const limit = parseInt(c.req.query("limit") || "30", 10);

    const result = await payloadClient.find(
      { collection: "stories", limit, sort: "-createdAt" },
      cookies,
    );

    return c.json(result);
  } catch (error) {
    console.error("[API] GET /api/stories error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/stories
storiesRoutes.post("/", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const body = await c.req.json();

    const result = await payloadClient.create("stories", body, cookies);
    return c.json(result, 201);
  } catch (error) {
    console.error("[API] POST /api/stories error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// DELETE /api/stories/cleanup - Delete stories older than 24 hours
storiesRoutes.delete("/cleanup", async (c) => {
  try {
    const secret = c.req.query("secret");
    const CLEANUP_SECRET = process.env.STORIES_CLEANUP_SECRET || "";
    
    if (CLEANUP_SECRET && secret !== CLEANUP_SECRET) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    console.log("[Cleanup] Starting story cleanup...");
    const cookies = getCookiesFromRequest(c.req.raw);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    let allExpiredStories: Array<{ id: string; items?: Array<{ url?: string; type?: string }> }> = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await payloadClient.find(
        {
          collection: "stories",
          limit: 100,
          page,
          depth: 1,
          where: {
            createdAt: {
              less_than: twentyFourHoursAgo.toISOString(),
            },
          },
        },
        cookies,
      );

      if (result.docs && result.docs.length > 0) {
        allExpiredStories = [...allExpiredStories, ...result.docs as Array<{ id: string; items?: Array<{ url?: string; type?: string }> }>];
        hasMore = result.hasNextPage || false;
        page++;
      } else {
        hasMore = false;
      }
    }

    if (allExpiredStories.length === 0) {
      return c.json({
        success: true,
        deleted: 0,
        mediaFilesDeleted: 0,
        message: "No expired stories found",
      });
    }

    const mediaUrls: string[] = [];
    for (const story of allExpiredStories) {
      if (story.items && Array.isArray(story.items)) {
        for (const item of story.items) {
          if (item.url && (item.type === "image" || item.type === "video")) {
            mediaUrls.push(item.url);
          }
        }
      }
    }

    let mediaDeleted = 0;
    let mediaFailed = 0;
    if (mediaUrls.length > 0) {
      const results = await Promise.allSettled(mediaUrls.map((url) => deleteFromBunnyByUrl(url)));
      mediaDeleted = results.filter((r) => r.status === "fulfilled" && r.value).length;
      mediaFailed = results.length - mediaDeleted;
    }

    let deletedCount = 0;
    let failedCount = 0;
    for (const story of allExpiredStories) {
      try {
        await payloadClient.delete({ collection: "stories", id: story.id }, undefined);
        deletedCount++;
      } catch {
        failedCount++;
      }
    }

    return c.json({
      success: true,
      deleted: deletedCount,
      failed: failedCount,
      mediaFilesDeleted: mediaDeleted,
      mediaFilesFailed: mediaFailed,
      totalExpired: allExpiredStories.length,
    });
  } catch (error) {
    console.error("[Cleanup] Story cleanup error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/stories/cleanup - Also support GET for cron jobs
storiesRoutes.get("/cleanup", async (c) => {
  // Convert GET to DELETE
  const deleteRequest = new Request(c.req.url, { method: "DELETE" });
  return storiesRoutes.fetch(deleteRequest);
});
