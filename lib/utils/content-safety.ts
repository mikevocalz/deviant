/**
 * Content Safety — Client-side anomaly detection for feed/profile/post surfaces.
 *
 * Prevents silent content disappearance by detecting when a refetch returns
 * dramatically fewer items than the cache held. Logs anomalies and optionally
 * blocks the cache write so the user keeps seeing stale-but-present content
 * instead of a sudden empty screen.
 */

/**
 * Check if a feed refetch result represents a suspicious drop in content.
 * Returns true if the new data is anomalously smaller than cached data.
 *
 * Heuristic: if cached had ≥5 items and new has <30% of cached, flag it.
 */
export function isSuspiciousFeedDrop(
  cachedCount: number,
  newCount: number,
): boolean {
  if (cachedCount < 5) return false; // too few to judge
  if (newCount >= cachedCount) return false; // growth or same
  const ratio = newCount / cachedCount;
  return ratio < 0.3; // lost >70% of content — anomalous
}

/**
 * Log a content anomaly for observability.
 * In production this could be wired to a telemetry service.
 */
export function logContentAnomaly(
  surface: "feed" | "profile" | "postDetail" | "comments" | "likes",
  details: {
    cachedCount: number;
    newCount: number;
    userId?: string;
    postId?: string;
  },
): void {
  console.error(
    `[ContentSafety] ANOMALY on ${surface}: cached=${details.cachedCount} new=${details.newCount}`,
    details,
  );
}

/**
 * Validate that a counter reconciliation doesn't create an impossible state.
 * Returns the safe value.
 */
export function safeCounter(value: number | null | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}
