/**
 * DTO PARSING UTILITIES
 *
 * These functions parse API responses through Zod schemas.
 * In DEV mode, they throw on validation failures.
 * In PROD mode, they log errors but attempt graceful degradation.
 *
 * USAGE:
 *   const profile = parseDTO(ProfileDTO, apiResponse, "ProfileDTO");
 *
 * @see PREVENTION.md for guardrail documentation
 */

import { z, ZodError } from "zod";

const IS_DEV = __DEV__;

/**
 * Parse data through a Zod schema with DEV-mode fail-fast behavior.
 *
 * @param schema - Zod schema to validate against
 * @param data - Raw data from API
 * @param name - Human-readable name for error messages
 * @returns Parsed and validated data
 * @throws In DEV mode if validation fails
 */
export function parseDTO<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  name: string,
): z.infer<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errorMessage = formatZodError(result.error, name);

    if (IS_DEV) {
      // FAIL FAST in development
      console.error(`[DTO VALIDATION FAILED] ${name}:`, result.error.issues);
      console.error(
        "[DTO] Raw data:",
        JSON.stringify(data, null, 2).slice(0, 500),
      );
      throw new Error(errorMessage);
    } else {
      // Log but don't crash in production
      console.warn(
        `[DTO] Validation warning for ${name}:`,
        result.error.issues,
      );
    }
  }

  return result.success ? result.data : (data as z.infer<T>);
}

/**
 * Safe parse that never throws, returns null on failure.
 * Use sparingly - prefer parseDTO for fail-fast behavior.
 */
export function safeParseDTOOrNull<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  name: string,
): z.infer<T> | null {
  const result = schema.safeParse(data);

  if (!result.success) {
    if (IS_DEV) {
      console.warn(`[DTO] Safe parse failed for ${name}:`, result.error.issues);
    }
    return null;
  }

  return result.data;
}

/**
 * Parse an array of items, filtering out invalid entries.
 * Logs warnings for each invalid item in DEV.
 */
export function parseDTOArray<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown[],
  name: string,
): z.infer<T>[] {
  if (!Array.isArray(data)) {
    if (IS_DEV) {
      console.error(`[DTO] Expected array for ${name}, got:`, typeof data);
      throw new Error(`[DTO] ${name} expected array, got ${typeof data}`);
    }
    return [];
  }

  const results: z.infer<T>[] = [];

  for (let i = 0; i < data.length; i++) {
    const result = schema.safeParse(data[i]);
    if (result.success) {
      results.push(result.data);
    } else if (IS_DEV) {
      console.warn(
        `[DTO] ${name}[${i}] validation failed:`,
        result.error.issues,
      );
    }
  }

  return results;
}

/**
 * Format Zod errors into a human-readable message.
 */
function formatZodError(error: ZodError, name: string): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.join(".");
    return `  - ${path || "root"}: ${issue.message}`;
  });

  return `[DTO] ${name} validation failed:\n${issues.join("\n")}`;
}

/**
 * Assert that required fields are present.
 * Use for critical fields that must never be missing.
 */
export function assertRequiredFields<T extends Record<string, unknown>>(
  data: T,
  requiredFields: (keyof T)[],
  name: string,
): void {
  const missing = requiredFields.filter((field) => {
    const value = data[field];
    return value === undefined || value === null;
  });

  if (missing.length > 0) {
    const message = `[DTO] ${name} missing required fields: ${missing.join(", ")}`;
    if (IS_DEV) {
      throw new Error(message);
    } else {
      console.warn(message);
    }
  }
}

/**
 * Assert that counts are non-negative.
 * Prevents negative like/follow counts from bad mutations.
 */
export function assertNonNegativeCounts(
  data: Record<string, unknown>,
  countFields: string[],
  name: string,
): void {
  for (const field of countFields) {
    const value = data[field];
    if (typeof value === "number" && value < 0) {
      const message = `[DTO] ${name}.${field} is negative (${value})`;
      if (IS_DEV) {
        throw new Error(message);
      } else {
        console.warn(message);
      }
    }
  }
}
