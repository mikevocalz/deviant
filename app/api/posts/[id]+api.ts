/**
 * Single Post API Route
 *
 * GET    /api/posts/:id - Get a single post
 * PATCH  /api/posts/:id - Update a post
 * DELETE /api/posts/:id - Delete a post
 */

import {
  payloadClient,
  getCookiesFromRequest,
  createErrorResponse,
} from "@/lib/payload.server";

// GET /api/posts/:id
export async function GET(request: Request, { id }: { id: string }) {
  try {
    const cookies = getCookiesFromRequest(request);
    const url = new URL(request.url);
    const depth = parseInt(url.searchParams.get("depth") || "1", 10);

    const result = await payloadClient.findByID(
      {
        collection: "posts",
        id,
        depth,
      },
      cookies,
    );

    return Response.json(result);
  } catch (error) {
    console.error(`[API] GET /api/posts/${id} error:`, error);
    return createErrorResponse(error);
  }
}

// PATCH /api/posts/:id
export async function PATCH(request: Request, { id }: { id: string }) {
  try {
    const cookies = getCookiesFromRequest(request);
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return Response.json(
        { error: "Request body is required" },
        { status: 400 },
      );
    }

    const url = new URL(request.url);
    const depth = parseInt(url.searchParams.get("depth") || "1", 10);

    const result = await payloadClient.update(
      {
        collection: "posts",
        id,
        data: body,
        depth,
      },
      cookies,
    );

    return Response.json(result);
  } catch (error) {
    console.error(`[API] PATCH /api/posts/${id} error:`, error);
    return createErrorResponse(error);
  }
}

// DELETE /api/posts/:id
export async function DELETE(request: Request, { id }: { id: string }) {
  try {
    const cookies = getCookiesFromRequest(request);

    const result = await payloadClient.delete(
      {
        collection: "posts",
        id,
      },
      cookies,
    );

    return Response.json(result);
  } catch (error) {
    console.error(`[API] DELETE /api/posts/${id} error:`, error);
    return createErrorResponse(error);
  }
}
