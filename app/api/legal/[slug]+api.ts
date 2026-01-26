/**
 * Legal Pages API Route
 *
 * Fetches legal content from Payload CMS by slug.
 * PUBLIC ACCESS - No authentication required.
 * Content MUST come from CMS - no static fallbacks.
 */

import { payloadClient } from "@/lib/payload.server";

export async function GET(request: Request, { slug }: { slug: string }) {
  console.log("[Legal API] Fetching legal page from CMS:", slug);
  
  try {
    const result = await payloadClient.find({
      collection: "legal-pages",
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 2,
    });
    
    console.log("[Legal API] Payload response:", {
      found: result.docs?.length > 0,
      count: result.docs?.length || 0,
    });

    if (result.docs && result.docs.length > 0) {
      const page = result.docs[0] as any;
      
      console.log("[Legal API] ✓ Returning CMS content for:", slug);
      return Response.json({
        id: page.id,
        slug: page.slug,
        title: page.title || slug,
        subtitle: page.subtitle || "",
        content: page.content || "",
        lastUpdated: page.lastUpdated || page.updatedAt || page.createdAt,
        effectiveDate: page.effectiveDate || "",
        faqs: page.faqs || [],
      });
    }

    console.error("[Legal API] Page not found in CMS:", slug);
    return Response.json(
      { error: `Legal page "${slug}" not found in CMS` },
      { status: 404 }
    );
  } catch (error: any) {
    console.error("[Legal API] CMS fetch error:", {
      slug,
      message: error?.message,
      status: error?.status,
    });

    return Response.json(
      { error: "Failed to fetch legal page from CMS" },
      { status: 500 }
    );
  }
}
