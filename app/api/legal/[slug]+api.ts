/**
 * Legal Pages API Route
 *
 * Fetches legal content from Payload CMS by slug.
 * PUBLIC ACCESS - No authentication required.
 * Falls back to static content if CMS unavailable.
 */

import { payloadClient } from "@/lib/payload.server";
import { LEGAL_CONTENT } from "@/lib/constants/legal-content";

export async function GET(request: Request, { slug }: { slug: string }) {
  console.log("[Legal API] Fetching legal page:", slug);
  
  // Try CMS first
  try {
    const result = await payloadClient.find({
      collection: "legal-pages",
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 2,
    });
    
    if (result.docs && result.docs.length > 0) {
      const page = result.docs[0] as any;
      
      // Only use CMS content if it has actual content
      if (page.content && page.content.trim().length > 0) {
        console.log("[Legal API] ✓ Returning CMS content for:", slug);
        return Response.json({
          id: page.id,
          slug: page.slug,
          title: page.title || slug,
          subtitle: page.subtitle || "",
          content: page.content,
          lastUpdated: page.lastUpdated || page.updatedAt || page.createdAt,
          effectiveDate: page.effectiveDate || "",
          faqs: page.faqs || [],
        });
      }
    }
    
    console.log("[Legal API] No CMS content, using static fallback for:", slug);
  } catch (error: any) {
    console.log("[Legal API] CMS unavailable, using static fallback:", error?.message);
  }

  // Fallback to static content
  const staticContent = LEGAL_CONTENT[slug as keyof typeof LEGAL_CONTENT];
  
  if (staticContent) {
    console.log("[Legal API] ✓ Returning static content for:", slug);
    return Response.json(staticContent);
  }

  return Response.json(
    { error: `Legal page "${slug}" not found` },
    { status: 404 }
  );
}
