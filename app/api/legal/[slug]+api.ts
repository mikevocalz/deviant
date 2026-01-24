/**
 * Legal Pages API Route
 *
 * Fetches legal content from Payload CMS by slug.
 * PUBLIC ACCESS - No authentication required.
 * Falls back to static content if Payload is unavailable.
 */

import { LEGAL_CONTENT } from "@/lib/constants/legal-content";
import { payloadClient } from "@/lib/payload.server";

export async function GET(request: Request, { slug }: { slug: string }) {
  console.log("[Legal API] Fetching legal page:", slug);
  
  try {
    // Try to fetch from Payload CMS first
    // No cookies needed - this is public content
    try {
      const result = await payloadClient.find({
        collection: "legal-pages",
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 1,
      });
      
      console.log("[Legal API] Payload response:", {
        found: result.docs?.length > 0,
        count: result.docs?.length || 0,
      });

      if (result.docs && result.docs.length > 0) {
        const page = result.docs[0] as any;
        
        // Validate that the page has content
        if (page.content && typeof page.content === "string" && page.content.trim().length > 0) {
          console.log("[Legal API] ✓ Returning CMS content for:", slug);
          return Response.json({
            id: page.id,
            slug: page.slug,
            title: page.title || LEGAL_CONTENT[slug as keyof typeof LEGAL_CONTENT]?.title || slug,
            subtitle: page.subtitle,
            content: page.content,
            lastUpdated: page.lastUpdated || page.updatedAt || page.createdAt,
            effectiveDate: page.effectiveDate,
            faqs: page.faqs || [],
          });
        } else {
          console.log("[Legal API] CMS page found but content is empty, using static fallback");
        }
      } else {
        console.log("[Legal API] No page found in CMS for slug:", slug);
      }
    } catch (payloadError: any) {
      console.error("[Legal API] Payload fetch error:", {
        message: payloadError?.message,
        status: payloadError?.status,
        error: payloadError,
      });
      // Continue to static fallback
    }

    // Fall back to static content
    console.log("[Legal API] Using static content fallback for:", slug);
    const staticContent = LEGAL_CONTENT[slug as keyof typeof LEGAL_CONTENT];

    if (staticContent) {
      return Response.json(staticContent);
    }

    return Response.json({ error: "Page not found" }, { status: 404 });
  } catch (error) {
    console.error("[Legal API] Unexpected error:", error);

    // Fall back to static content on error
    const staticContent = LEGAL_CONTENT[slug as keyof typeof LEGAL_CONTENT];

    if (staticContent) {
      return Response.json(staticContent);
    }

    return Response.json(
      { error: "Failed to fetch legal page" },
      { status: 500 },
    );
  }
}
