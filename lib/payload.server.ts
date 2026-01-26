/**
 * Server-only Payload CMS REST API Client
 *
 * SECURITY: This file must ONLY be imported in +api.ts routes.
 * Never import this in client components - API keys will be exposed.
 *
 * Architecture:
 * Expo Client → Expo API Route (+api.ts) → This Client → Payload CMS
 */

const PAYLOAD_URL = process.env.PAYLOAD_URL;
const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY;

if (!PAYLOAD_URL) {
  console.warn("[Payload] PAYLOAD_URL environment variable is not set");
}

if (!PAYLOAD_API_KEY) {
  console.warn("[Payload] PAYLOAD_API_KEY environment variable is not set");
}

// Types for Payload API responses
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

export interface PayloadError {
  status: number;
  message: string;
  errors?: Array<{ message: string; field?: string }>;
}

// Query options for find operations
export interface FindOptions {
  collection: string;
  depth?: number;
  limit?: number;
  page?: number;
  sort?: string;
  where?: Record<string, unknown>;
  locale?: string;
  fallbackLocale?: string;
}

// Options for findByID operations
export interface FindByIDOptions {
  collection: string;
  id: string;
  depth?: number;
  locale?: string;
  fallbackLocale?: string;
}

// Options for create operations
export interface CreateOptions {
  collection: string;
  data: Record<string, unknown>;
  depth?: number;
  locale?: string;
  fallbackLocale?: string;
}

// Options for update operations
export interface UpdateOptions {
  collection: string;
  id: string;
  data: Record<string, unknown>;
  depth?: number;
  locale?: string;
  fallbackLocale?: string;
}

// Options for delete operations
export interface DeleteOptions {
  collection: string;
  id: string;
}

// Build query string from options
function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;

    if (key === "where" && typeof value === "object") {
      // Payload expects where as a JSON string or nested params
      searchParams.set(key, JSON.stringify(value));
    } else {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

// Base fetch function with auth headers
async function payloadFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  cookies?: string,
  jwtToken?: string,
): Promise<T> {
  if (!PAYLOAD_URL || !PAYLOAD_API_KEY) {
    throw new Error(
      "Payload CMS is not configured. Set PAYLOAD_URL and PAYLOAD_API_KEY environment variables.",
    );
  }

  const url = `${PAYLOAD_URL}/api${endpoint}`;

  // Priority: JWT token > API key
  // JWT token authenticates as the specific user, API key provides collection access
  const authHeader = jwtToken 
    ? `JWT ${jwtToken}`
    : `users API-Key ${PAYLOAD_API_KEY}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Authorization: authHeader,
    ...options.headers,
  };

  // Forward cookies for user authentication if provided
  if (cookies) {
    (headers as Record<string, string>)["Cookie"] = cookies;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData: PayloadError;
    try {
      errorData = await response.json();
    } catch {
      errorData = {
        status: response.status,
        message: response.statusText || "Unknown error",
      };
    }

    const error = new Error(
      errorData.message || `Payload API error: ${response.status}`,
    ) as Error & {
      status: number;
      errors?: Array<{ message: string; field?: string }>;
    };
    error.status = response.status;
    error.errors = errorData.errors;
    throw error;
  }

  return response.json();
}

/**
 * Payload REST API Client
 *
 * Usage in API routes:
 * ```ts
 * import { payloadClient } from '@/lib/payload.server'
 *
 * export async function GET(request: Request) {
 *   const posts = await payloadClient.find({ collection: 'posts', limit: 10 })
 *   return Response.json(posts)
 * }
 * ```
 */
// Auth context for API calls
interface AuthContext {
  cookies?: string;
  jwtToken?: string;
}

export const payloadClient = {
  /**
   * Find documents in a collection with pagination and filtering
   */
  async find<T = Record<string, unknown>>(
    options: FindOptions,
    auth?: string | AuthContext,
  ): Promise<PaginatedDocs<T>> {
    const { collection, ...queryParams } = options;
    const query = buildQueryString(queryParams);
    const { cookies, jwtToken } = normalizeAuth(auth);
    return payloadFetch<PaginatedDocs<T>>(
      `/${collection}${query}`,
      { method: "GET" },
      cookies,
      jwtToken,
    );
  },

  /**
   * Find a single document by ID
   */
  async findByID<T = Record<string, unknown>>(
    options: FindByIDOptions,
    auth?: string | AuthContext,
  ): Promise<T> {
    const { collection, id, ...queryParams } = options;
    const query = buildQueryString(queryParams);
    const { cookies, jwtToken } = normalizeAuth(auth);
    return payloadFetch<T>(
      `/${collection}/${id}${query}`,
      { method: "GET" },
      cookies,
      jwtToken,
    );
  },

  /**
   * Create a new document in a collection
   */
  async create<T = Record<string, unknown>>(
    options: CreateOptions,
    auth?: string | AuthContext,
  ): Promise<T> {
    const { collection, data, ...queryParams } = options;
    const query = buildQueryString(queryParams);
    const { cookies, jwtToken } = normalizeAuth(auth);
    return payloadFetch<T>(
      `/${collection}${query}`,
      { method: "POST", body: JSON.stringify(data) },
      cookies,
      jwtToken,
    );
  },

  /**
   * Update an existing document
   */
  async update<T = Record<string, unknown>>(
    options: UpdateOptions,
    auth?: string | AuthContext,
  ): Promise<T> {
    const { collection, id, data, ...queryParams } = options;
    const query = buildQueryString(queryParams);
    const { cookies, jwtToken } = normalizeAuth(auth);
    return payloadFetch<T>(
      `/${collection}/${id}${query}`,
      { method: "PATCH", body: JSON.stringify(data) },
      cookies,
      jwtToken,
    );
  },

  /**
   * Delete a document
   */
  async delete<T = Record<string, unknown>>(
    options: DeleteOptions,
    auth?: string | AuthContext,
  ): Promise<T> {
    const { collection, id } = options;
    const { cookies, jwtToken } = normalizeAuth(auth);
    return payloadFetch<T>(
      `/${collection}/${id}`,
      { method: "DELETE" },
      cookies,
      jwtToken,
    );
  },

  /**
   * Get current authenticated user (if using cookie/JWT auth)
   */
  async me<T = Record<string, unknown>>(auth?: string | AuthContext): Promise<T | null> {
    try {
      const { cookies, jwtToken } = normalizeAuth(auth);
      return await payloadFetch<T>("/users/me", { method: "GET" }, cookies, jwtToken);
    } catch (error) {
      // Return null if not authenticated
      if ((error as { status?: number }).status === 401) {
        return null;
      }
      throw error;
    }
  },
};

// Helper to normalize auth parameter (backwards compatible with just cookies string)
function normalizeAuth(auth?: string | AuthContext): { cookies?: string; jwtToken?: string } {
  if (!auth) return {};
  if (typeof auth === "string") return { cookies: auth };
  return auth;
}

// Helper to extract cookies from request for auth forwarding
export function getCookiesFromRequest(request: Request): string | undefined {
  return request.headers.get("Cookie") || undefined;
}

// Helper to extract JWT token from Authorization header
export function getJWTFromRequest(request: Request): string | undefined {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return undefined;
  
  // Support both "Bearer <token>" and "JWT <token>" formats
  const match = authHeader.match(/^(?:Bearer|JWT)\s+(.+)$/i);
  return match ? match[1] : undefined;
}

// Helper to get full auth context from request
export function getAuthFromRequest(request: Request): { cookies?: string; jwtToken?: string } {
  return {
    cookies: getCookiesFromRequest(request),
    jwtToken: getJWTFromRequest(request),
  };
}

// Helper to create error responses
export function createErrorResponse(
  error: unknown,
  defaultStatus = 500,
): Response {
  const err = error as Error & { status?: number; errors?: unknown[] };
  const status = err.status || defaultStatus;
  const message = err.message || "Internal server error";

  return Response.json(
    {
      error: message,
      errors: err.errors,
    },
    { status },
  );
}
