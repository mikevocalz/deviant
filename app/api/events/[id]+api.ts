/**
 * Single Event API Route
 */

import {
  payloadClient,
  getCookiesFromRequest,
  createErrorResponse,
} from "@/lib/payload.server";

export async function GET(request: Request, { id }: { id: string }) {
  try {
    const cookies = getCookiesFromRequest(request);
    const url = new URL(request.url);
    const depth = parseInt(url.searchParams.get("depth") || "2", 10);

    const result = await payloadClient.findByID(
      {
        collection: "events",
        id,
        depth,
      },
      cookies,
    );

    return Response.json(result);
  } catch (error) {
    console.error(`[API] GET /api/events/${id} error:`, error);
    return createErrorResponse(error);
  }
}

export async function PATCH(request: Request, { id }: { id: string }) {
  try {
    const cookies = getCookiesFromRequest(request);
    const body = await request.json();

    const result = await payloadClient.update(
      {
        collection: "events",
        id,
        data: body,
        depth: 2,
      },
      cookies,
    );

    return Response.json(result);
  } catch (error) {
    console.error(`[API] PATCH /api/events/${id} error:`, error);
    return createErrorResponse(error);
  }
}

export async function DELETE(request: Request, { id }: { id: string }) {
  try {
    const cookies = getCookiesFromRequest(request);

    const result = await payloadClient.delete(
      {
        collection: "events",
        id,
      },
      cookies,
    );

    return Response.json(result);
  } catch (error) {
    console.error(`[API] DELETE /api/events/${id} error:`, error);
    return createErrorResponse(error);
  }
}
