/**
 * DTO PARSING UTILITIES
 *
 * Safe parsing of API responses with DEV/PROD behavior:
 * - DEV: Throws immediately on schema mismatch
 * - PROD: Logs error + returns fallback or partial data
 *
 * @see dto.ts for schema definitions
 */

import { z } from "zod";

const IS_DEV = __DEV__;

interface ParseOptions {
  /** Context for error messages (e.g., "FeedPost", "ProfileScreen") */
  context: string;
  /** If true, return null instead of throwing in DEV */
  allowNull?: boolean;
  /** Fallback value if parsing fails in PROD */
  fallback?: unknown;
}

/**
 * Parse API response through a Zod schema.
 *
 * DEV: Throws on mismatch to catch bugs early
 * PROD: Logs warning and returns fallback or partial data
 *
 * @example
 * const post = parseDTO(PostDTO, apiResponse, { context: "FeedPost" });
 */
export function parseDTO<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  options: ParseOptions,
): z.infer<T> | null {
  const { context, allowNull = false, fallback } = options;

  const result = schema.safeParse(data);

  if (result.success) {
    return result.data;
  }

  // Format error message
  const errors = result.error.issues
    .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
    .join("\n");

  const message =
    `[DTO] ${context}: Schema validation failed.\n` +
    `Errors:\n${errors}\n` +
    `Data: ${JSON.stringify(data, null, 2).slice(0, 500)}`;

  if (IS_DEV) {
    if (allowNull) {
      console.error(message);
      return null;
    }
    throw new Error(message);
  } else {
    // PROD: Log and degrade gracefully
    console.warn(message);

    if (fallback !== undefined) {
      return fallback as z.infer<T>;
    }

    // Try to return partial data if possible
    if (typeof data === "object" && data !== null) {
      return data as z.infer<T>;
    }

    return null;
  }
}

/**
 * Parse an array of items through a schema.
 * Invalid items are filtered out in PROD, throws in DEV.
 */
export function parseDTOArray<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown[],
  options: ParseOptions,
): z.infer<T>[] {
  const { context } = options;

  if (!Array.isArray(data)) {
    const message = `[DTO] ${context}: Expected array, got ${typeof data}`;
    if (IS_DEV) {
      throw new Error(message);
    }
    console.warn(message);
    return [];
  }

  const results: z.infer<T>[] = [];
  const errors: string[] = [];

  for (let i = 0; i < data.length; i++) {
    const result = schema.safeParse(data[i]);
    if (result.success) {
      results.push(result.data);
    } else {
      errors.push(`  [${i}]: ${result.error.issues[0]?.message || "Invalid"}`);
    }
  }

  if (errors.length > 0) {
    const message =
      `[DTO] ${context}: ${errors.length}/${data.length} items failed validation.\n` +
      errors.slice(0, 5).join("\n") +
      (errors.length > 5 ? `\n  ... and ${errors.length - 5} more` : "");

    if (IS_DEV) {
      throw new Error(message);
    }
    console.warn(message);
  }

  return results;
}

/**
 * Validate that required fields exist (non-null, non-undefined).
 * Use for critical fields that MUST exist for UI to function.
 */
export function assertRequiredFields<T extends Record<string, unknown>>(
  data: T,
  fields: (keyof T)[],
  context: string,
): void {
  const missing: string[] = [];

  for (const field of fields) {
    if (data[field] === undefined || data[field] === null) {
      missing.push(String(field));
    }
  }

  if (missing.length > 0) {
    const message = `[DTO] ${context}: Missing required fields: ${missing.join(", ")}`;

    if (IS_DEV) {
      throw new Error(message);
    }
    console.error(message);
  }
}

/**
 * Validate count fields are non-negative.
 */
export function assertValidCounts<T extends Record<string, unknown>>(
  data: T,
  countFields: (keyof T)[],
  context: string,
): void {
  for (const field of countFields) {
    const value = data[field];
    if (typeof value === "number" && value < 0) {
      const message = `[DTO] ${context}: ${String(field)} is negative (${value})`;
      if (IS_DEV) {
        throw new Error(message);
      }
      console.warn(message);
    }
  }
}
