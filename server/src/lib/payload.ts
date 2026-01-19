/**
 * Payload CMS Client for Server
 */

const PAYLOAD_URL = process.env.PAYLOAD_URL;
const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY;

export interface PaginatedDocs<T> {
  docs: T[];
  totalDocs: number;
  limit: number;
  totalPages: number;
  page: number;
  pagingCounter: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
}

export interface FindOptions {
  collection: string;
  depth?: number;
  limit?: number;
  page?: number;
  sort?: string;
  where?: Record<string, unknown>;
}

function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;

    if (key === "where" && typeof value === "object") {
      searchParams.set(key, JSON.stringify(value));
    } else {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

async function payloadFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  cookies?: string,
): Promise<T> {
  if (!PAYLOAD_URL || !PAYLOAD_API_KEY) {
    throw new Error("Payload CMS is not configured");
  }

  const url = `${PAYLOAD_URL}/api${endpoint}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Authorization: `users API-Key ${PAYLOAD_API_KEY}`,
    ...options.headers,
  };

  if (cookies) {
    (headers as Record<string, string>)["Cookie"] = cookies;
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const error = new Error(`Payload API error: ${response.status}`);
    throw error;
  }

  return response.json();
}

export const payloadClient = {
  async find<T = Record<string, unknown>>(
    options: FindOptions,
    cookies?: string,
  ): Promise<PaginatedDocs<T>> {
    const { collection, ...queryParams } = options;
    const query = buildQueryString(queryParams);
    return payloadFetch<PaginatedDocs<T>>(
      `/${collection}${query}`,
      { method: "GET" },
      cookies,
    );
  },

  async findByID<T = Record<string, unknown>>(
    collection: string,
    id: string,
    depth?: number,
    cookies?: string,
  ): Promise<T> {
    const query = depth ? `?depth=${depth}` : "";
    return payloadFetch<T>(
      `/${collection}/${id}${query}`,
      { method: "GET" },
      cookies,
    );
  },

  async create<T = Record<string, unknown>>(
    collection: string,
    data: Record<string, unknown>,
    cookies?: string,
  ): Promise<T> {
    return payloadFetch<T>(
      `/${collection}`,
      { method: "POST", body: JSON.stringify(data) },
      cookies,
    );
  },

  async update<T = Record<string, unknown>>(
    collection: string,
    id: string,
    data: Record<string, unknown>,
    cookies?: string,
  ): Promise<T> {
    return payloadFetch<T>(
      `/${collection}/${id}`,
      { method: "PATCH", body: JSON.stringify(data) },
      cookies,
    );
  },

  async delete<T = Record<string, unknown>>(
    collection: string,
    id: string,
    cookies?: string,
  ): Promise<T> {
    return payloadFetch<T>(
      `/${collection}/${id}`,
      { method: "DELETE" },
      cookies,
    );
  },
};

export function getCookiesFromRequest(req: Request): string | undefined {
  return req.headers.get("Cookie") || undefined;
}
