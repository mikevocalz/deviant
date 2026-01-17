/**
 * Legal Pages API Route
 *
 * Fetches legal content from Payload CMS by slug.
 * Falls back to static content if Payload is unavailable.
 */

import { LEGAL_CONTENT } from "@/lib/constants/legal-content";

export async function GET(request: Request, { slug }: { slug: string }) {
  try {
    // Try to fetch from Payload CMS first
    const payloadUrl =
      process.env.PAYLOAD_URL || process.env.PAYLOAD_SERVER_URL;
    const payloadApiKey = process.env.PAYLOAD_API_KEY;

    if (payloadUrl && payloadApiKey) {
      const response = await fetch(
        `${payloadUrl}/api/legal-pages?where[slug][equals]=${slug}&limit=1`,
        {
          headers: {
            Authorization: `Api-Key ${payloadApiKey}`,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        if (data.docs && data.docs.length > 0) {
          return Response.json(data.docs[0]);
        }
      }
    }

    // Fall back to static content
    const staticContent = LEGAL_CONTENT[slug as keyof typeof LEGAL_CONTENT];

    if (staticContent) {
      return Response.json(staticContent);
    }

    return Response.json({ error: "Page not found" }, { status: 404 });
  } catch (error) {
    console.error("[Legal API] Error:", error);

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
