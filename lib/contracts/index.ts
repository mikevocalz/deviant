/**
 * CONTRACTS MODULE
 * 
 * Central export for all data contracts, DTOs, and invariants.
 * Import from this file to ensure consistent usage across the app.
 * 
 * @example
 * import { ProfileDTO, parseDTO, profileKeys, assertValidCount } from "@/lib/contracts";
 */

// DTOs
export * from "./dto";

// Parsing utilities
export * from "./parse";

// Query key registry
export * from "./query-keys";

// DEV-time invariants
export * from "./invariants";
