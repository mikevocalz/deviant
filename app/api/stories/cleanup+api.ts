/**
 * Stories Cleanup API Route
 *
 * DELETE /api/stories/cleanup - Delete stories older than 24 hours
 *
 * This endpoint should be called periodically (e.g., via cron job) to:
 * 1. Find stories older than 24 hours
 * 2. Delete their media files from Bunny CDN
 * 3. Delete the story records from Payload CMS
 *
 * Security: Should be protected with an API key or secret token
 */

import {
  payloadClient,
  getAuthFromRequest,
  createErrorResponse,
} from "@/lib/payload.server";
import {
  deleteMultipleFromBunny,
  extractStoragePathFromUrl,
} from "@/lib/bunny-storage.server";

// Optional: Add a secret token for security
const CLEANUP_SECRET = process.env.STORIES_CLEANUP_SECRET || "";

export async function DELETE(request: Request) {
  try {
    // Optional: Verify secret token for security
    const url = new URL(request.url);
    const secret = url.searchParams.get("secret");
    
    if (CLEANUP_SECRET && secret !== CLEANUP_SECRET) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    console.log("[Cleanup] Starting story cleanup...");
    const auth = getAuthFromRequest(request);

    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Find all stories older than 24 hours
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
        auth,
      );

      if (result.docs && result.docs.length > 0) {
        allExpiredStories = [...allExpiredStories, ...result.docs as Array<{ id: string; items?: Array<{ url?: string; type?: string }> }>];
        hasMore = result.hasNextPage || false;
        page++;
      } else {
        hasMore = false;
      }
    }

    console.log(`[Cleanup] Found ${allExpiredStories.length} expired stories`);

    if (allExpiredStories.length === 0) {
      return Response.json({
        success: true,
        deleted: 0,
        mediaFilesDeleted: 0,
        message: "No expired stories found",
      });
    }

    // Extract all media URLs from expired stories
    const mediaUrls: string[] = [];
    for (const story of allExpiredStories) {
      if (story.items && Array.isArray(story.items)) {
        for (const item of story.items) {
          // Only delete media files (images/videos), not text stories
          if (item.url && (item.type === "image" || item.type === "video")) {
            mediaUrls.push(item.url);
          }
        }
      }
    }

    console.log(`[Cleanup] Found ${mediaUrls.length} media files to delete`);

    // Delete media files from Bunny CDN
    let mediaDeleteResult = { deleted: 0, failed: 0, errors: [] as string[] };
    if (mediaUrls.length > 0) {
      mediaDeleteResult = await deleteMultipleFromBunny(mediaUrls);
      console.log(`[Cleanup] Media deletion: ${mediaDeleteResult.deleted} deleted, ${mediaDeleteResult.failed} failed`);
    }

    // Delete story records from Payload CMS
    // Use API key authentication for deletion (no cookies needed for cleanup)
    let deletedCount = 0;
    let failedCount = 0;
    const deleteErrors: string[] = [];

    for (const story of allExpiredStories) {
      try {
        // Delete without cookies - use API key auth
        await payloadClient.delete(
          {
            collection: "stories",
            id: story.id,
          },
          undefined, // No cookies needed - API key is used
        );
        deletedCount++;
        console.log(`[Cleanup] ✓ Deleted story: ${story.id}`);
      } catch (error: any) {
        failedCount++;
        const errorMsg = error?.message || "Unknown error";
        deleteErrors.push(`Story ${story.id}: ${errorMsg}`);
        console.error(`[Cleanup] ✗ Failed to delete story ${story.id}:`, errorMsg);
      }
    }

    console.log(`[Cleanup] Complete: ${deletedCount} stories deleted, ${failedCount} failed`);

    return Response.json({
      success: true,
      deleted: deletedCount,
      failed: failedCount,
      mediaFilesDeleted: mediaDeleteResult.deleted,
      mediaFilesFailed: mediaDeleteResult.failed,
      totalExpired: allExpiredStories.length,
      errors: deleteErrors.length > 0 ? deleteErrors : undefined,
      mediaErrors: mediaDeleteResult.errors.length > 0 ? mediaDeleteResult.errors : undefined,
    });
  } catch (error) {
    console.error("[Cleanup] Story cleanup error:", error);
    return createErrorResponse(error);
  }
}

// Also support GET for easier cron job setup
export async function GET(request: Request) {
  return DELETE(request);
}
