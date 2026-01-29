/**
 * DEV-TIME INVARIANTS
 * 
 * These functions enforce critical data integrity rules.
 * They THROW in development mode to catch bugs early.
 * They LOG warnings in production to avoid crashes.
 * 
 * @see PREVENTION.md for guardrail documentation
 */

const IS_DEV = __DEV__;

// =============================================================================
// IDENTITY INVARIANTS
// =============================================================================

/**
 * Assert that identity data (avatar, username, verified) for content
 * is NOT coming from authUser when the content belongs to another user.
 * 
 * This prevents the cross-user data leak bug where authUser's avatar
 * was displayed on other users' posts/stories/comments.
 * 
 * @example
 * // In a Post component:
 * assertIdentityOwnership({
 *   entityUserId: post.author.id,
 *   authUserId: currentUser.id,
 *   avatarSource: "post.author.avatar",
 *   context: "FeedPost",
 * });
 */
export function assertIdentityOwnership(params: {
  entityUserId: string | number;
  authUserId: string | number;
  avatarSource: string;
  context: string;
}): void {
  const { entityUserId, authUserId, avatarSource, context } = params;
  
  // If the entity belongs to the auth user, authUser data is allowed
  if (String(entityUserId) === String(authUserId)) {
    return;
  }
  
  // If using authUser data for another user's content, that's a bug
  if (avatarSource.includes("authUser") || avatarSource.includes("currentUser")) {
    const message =
      `[IDENTITY LEAK] ${context}: Using authUser data for entity owned by ${entityUserId}.\n` +
      `Avatar source: ${avatarSource}\n` +
      `Rule: Content avatar/username MUST come from entity.author, NOT authUser.`;
    
    if (IS_DEV) {
      throw new Error(message);
    } else {
      console.error(message);
    }
  }
}

/**
 * Assert that a story/post/comment avatar comes from the entity,
 * not from authUser.
 */
export function assertEntityAvatar(params: {
  entityAvatar: unknown;
  authUserAvatar: unknown;
  entityId: string;
  context: string;
}): void {
  const { entityAvatar, authUserAvatar, entityId, context } = params;
  
  // If they're the same object reference, that's suspicious
  if (entityAvatar === authUserAvatar && entityAvatar !== undefined) {
    const message =
      `[IDENTITY LEAK] ${context}: Entity ${entityId} avatar === authUser avatar.\n` +
      `This may indicate incorrect data source.`;
    
    if (IS_DEV) {
      console.warn(message);
    }
  }
}

// =============================================================================
// QUERY KEY INVARIANTS
// =============================================================================

/**
 * Assert that a query key includes required IDs.
 * Prevents generic keys like ['profile'] without userId.
 */
export function assertQueryKeyHasId(
  key: readonly unknown[],
  expectedIdPositions: number[],
  context: string
): void {
  for (const position of expectedIdPositions) {
    const value = key[position];
    if (value === undefined || value === null || value === "") {
      const message =
        `[QUERY KEY] ${context}: Missing ID at position ${position}.\n` +
        `Key: ${JSON.stringify(key)}\n` +
        `Rule: User-specific queries MUST include userId/viewerId.`;
      
      if (IS_DEV) {
        throw new Error(message);
      } else {
        console.warn(message);
      }
    }
  }
}

/**
 * Assert that a query key is not a forbidden generic pattern.
 */
export function assertNotGenericKey(
  key: readonly unknown[],
  context: string
): void {
  const FORBIDDEN_SINGLE_KEYS = ["user", "users", "profile", "bookmarks", "notifications"];
  
  if (key.length === 1 && typeof key[0] === "string") {
    if (FORBIDDEN_SINGLE_KEYS.includes(key[0])) {
      const message =
        `[QUERY KEY] ${context}: Forbidden generic key detected.\n` +
        `Key: ${JSON.stringify(key)}\n` +
        `Rule: Use scoped keys with IDs. See lib/contracts/query-keys.ts`;
      
      if (IS_DEV) {
        throw new Error(message);
      } else {
        console.warn(message);
      }
    }
  }
}

// =============================================================================
// COUNT INVARIANTS
// =============================================================================

/**
 * Assert that counts are valid (non-negative, not NaN).
 * Prevents bugs where optimistic updates go negative.
 */
export function assertValidCount(
  value: number,
  fieldName: string,
  context: string
): void {
  if (typeof value !== "number" || isNaN(value)) {
    const message = `[COUNT] ${context}: ${fieldName} is not a valid number (${value})`;
    if (IS_DEV) {
      throw new Error(message);
    } else {
      console.warn(message);
    }
  }
  
  if (value < 0) {
    const message =
      `[COUNT] ${context}: ${fieldName} is negative (${value}).\n` +
      `Rule: Counts must never go below zero.`;
    
    if (IS_DEV) {
      throw new Error(message);
    } else {
      console.warn(message);
    }
  }
}

/**
 * Assert that a count increment/decrement is valid.
 * Prevents double-increments from race conditions.
 */
export function assertCountDelta(
  previousValue: number,
  newValue: number,
  expectedDelta: number,
  fieldName: string,
  context: string
): void {
  const actualDelta = newValue - previousValue;
  
  if (Math.abs(actualDelta) > Math.abs(expectedDelta)) {
    const message =
      `[COUNT] ${context}: ${fieldName} changed by ${actualDelta}, expected ${expectedDelta}.\n` +
      `Previous: ${previousValue}, New: ${newValue}\n` +
      `Rule: Possible double-increment/decrement detected.`;
    
    if (IS_DEV) {
      console.warn(message);
    }
  }
}

// =============================================================================
// CACHE MUTATION INVARIANTS
// =============================================================================

/**
 * Assert that cached objects are not mutated in place.
 * Pass the original and new object - they should not be ===.
 */
export function assertImmutableUpdate<T extends object>(
  original: T,
  updated: T,
  context: string
): void {
  if (original === updated) {
    const message =
      `[CACHE] ${context}: Object was mutated in place.\n` +
      `Rule: Always create new object references when updating cache.`;
    
    if (IS_DEV) {
      throw new Error(message);
    } else {
      console.warn(message);
    }
  }
}

/**
 * Assert that a partial update preserves required fields.
 * Prevents replacing full objects with partial API responses.
 */
export function assertPreservesFields<T extends Record<string, unknown>>(
  original: T,
  updated: T,
  requiredFields: (keyof T)[],
  context: string
): void {
  for (const field of requiredFields) {
    const originalHas = original[field] !== undefined;
    const updatedHas = updated[field] !== undefined;
    
    if (originalHas && !updatedHas) {
      const message =
        `[CACHE] ${context}: Required field '${String(field)}' was lost in update.\n` +
        `Rule: Merge partial responses, don't replace full objects.`;
      
      if (IS_DEV) {
        throw new Error(message);
      } else {
        console.warn(message);
      }
    }
  }
}

// =============================================================================
// COMMENT THREADING INVARIANTS
// =============================================================================

/**
 * Assert that threaded comments maintain parent-child relationships.
 */
export function assertThreadedComments(
  comments: Array<{ id: string; parentId?: string | null; replies?: unknown[] }>,
  context: string
): void {
  const commentIds = new Set(comments.map((c) => c.id));
  
  for (const comment of comments) {
    // If has parentId, parent should exist (unless it's a root reply from backend)
    if (comment.parentId && !commentIds.has(comment.parentId)) {
      if (IS_DEV) {
        console.warn(
          `[COMMENTS] ${context}: Comment ${comment.id} has parentId ${comment.parentId} ` +
          `but parent not found in comment list.`
        );
      }
    }
    
    // If has replies, they should reference this comment as parent
    if (comment.replies && Array.isArray(comment.replies)) {
      for (const reply of comment.replies as Array<{ parentId?: string }>) {
        if (reply.parentId && reply.parentId !== comment.id) {
          const message =
            `[COMMENTS] ${context}: Reply has mismatched parentId.\n` +
            `Expected: ${comment.id}, Got: ${reply.parentId}`;
          
          if (IS_DEV) {
            throw new Error(message);
          }
        }
      }
    }
  }
}

// =============================================================================
// STATE ISOLATION INVARIANTS
// =============================================================================

/**
 * Assert that user-specific state is properly isolated.
 * Prevents one user's likes/follows/bookmarks from leaking to another.
 */
export function assertStateIsolation(params: {
  stateType: "like" | "bookmark" | "follow";
  viewerId: string;
  expectedViewerId: string;
  context: string;
}): void {
  const { stateType, viewerId, expectedViewerId, context } = params;
  
  if (viewerId !== expectedViewerId) {
    const message =
      `[STATE ISOLATION] ${context}: ${stateType} state for wrong user.\n` +
      `Expected viewerId: ${expectedViewerId}, Got: ${viewerId}\n` +
      `Rule: User-specific state MUST be scoped by viewerId.`;
    
    if (IS_DEV) {
      throw new Error(message);
    } else {
      console.error(message);
    }
  }
}
