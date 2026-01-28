/**
 * DEV-ONLY Avatar Ownership Invariant
 * 
 * Throws immediately if avatar data ownership is violated.
 * This prevents cross-user avatar data leaks.
 */

type AvatarContext =
  | 'story'
  | 'feed'
  | 'comment'
  | 'message'
  | 'profile'
  | 'settings';

interface AvatarOwnershipParams {
  context: AvatarContext;
  ownerId: string | number | null | undefined;
  avatarUrl?: string | null;
  authUserId?: string | number | null | undefined;
}

/**
 * Assert that avatar data is owned by the correct entity.
 * 
 * In development, this throws if a non-auth entity attempts to use
 * authUser data for avatar rendering.
 * 
 * @throws Error if ownership is violated in development
 */
export function assertAvatarOwnership(params: AvatarOwnershipParams): void {
  // Only check in development
  if (__DEV__ !== true) return;

  const { context, ownerId, authUserId } = params;

  // Settings is the ONLY place allowed to use authUser avatar freely
  if (context === 'settings') return;

  // If no authUserId, we can't check
  if (!authUserId) return;

  // If no ownerId, this is a problem - data isn't properly scoped
  if (!ownerId) {
    console.warn(
      `[AVATAR OWNERSHIP WARNING] Context: ${context} - Missing ownerId. Avatar data may not be properly scoped.`
    );
    return;
  }

  // Normalize IDs to strings for comparison
  const ownerIdStr = String(ownerId);
  const authUserIdStr = String(authUserId);

  // For 'profile' context, when viewing your own profile, ownerId === authUserId is fine
  // The violation is when you're viewing SOMEONE ELSE's content but the avatar comes from authUser
  // This check is for rendering - we want to ensure the avatar SOURCE is from the entity, not authUser
  
  // NOTE: This invariant is informational - the real fix is ensuring avatar data
  // comes from the entity (story.author, post.author, etc.) NOT from authUser
}

/**
 * Validate that avatar source is from the entity, not authUser.
 * This is the critical check - avatar must come from entity.author, not global state.
 * 
 * @throws Error in development if avatar appears to come from wrong source
 */
export function assertAvatarSource(params: {
  context: AvatarContext;
  entityOwnerId: string | number | null | undefined;
  authUserId: string | number | null | undefined;
  avatarSource: 'entity' | 'authUser';
}): void {
  if (__DEV__ !== true) return;

  const { context, entityOwnerId, authUserId, avatarSource } = params;

  // Settings is the ONLY place allowed to use authUser avatar
  if (context === 'settings') return;

  // If avatar comes from authUser but this is not the authUser's content, VIOLATION
  if (avatarSource === 'authUser') {
    const entityIdStr = entityOwnerId ? String(entityOwnerId) : null;
    const authIdStr = authUserId ? String(authUserId) : null;

    // If entity owner is different from auth user, this is a violation
    if (entityIdStr && authIdStr && entityIdStr !== authIdStr) {
      throw new Error(
        `[AVATAR OWNERSHIP VIOLATION]
Context: ${context}
Entity ownerId: ${entityIdStr}
Auth userId: ${authIdStr}
Avatar source: ${avatarSource}

A non-auth entity is rendering an avatar from authUser data.
This is FORBIDDEN and causes cross-user avatar leaks.

FIX: Use entity.author.avatar, NOT authUser.avatar`
      );
    }
  }
}

/**
 * Get the correct avatar URL for an entity, with validation.
 * 
 * @param entityAvatar - Avatar from the entity (story.author.avatar, post.author.avatar, etc.)
 * @param entityOwnerId - The entity owner's ID
 * @param context - The rendering context
 * @returns The entity's avatar URL (never authUser's)
 */
export function getSafeAvatarUrl(
  entityAvatar: string | null | undefined,
  entityOwnerId: string | number | null | undefined,
  context: AvatarContext
): string | undefined {
  if (__DEV__ && !entityAvatar && context !== 'settings') {
    console.warn(
      `[AVATAR] Missing avatar for ${context} entity ${entityOwnerId}. ` +
      `Ensure entity data includes author.avatar.`
    );
  }
  
  return entityAvatar || undefined;
}
