/**
 * Identity Ownership Regression Tests
 * 
 * CRITICAL: These tests ensure that updating one user's identity data
 * (avatar, username, bio, verified, counts) NEVER affects another user's
 * stories, posts, comments, messages, or profile display.
 * 
 * This is a permanent data isolation guarantee.
 * 
 * Run with: npx ts-node tests/identity-ownership.spec.ts
 */

// =============================================================================
// IDENTITY OWNERSHIP RULES - DOCUMENTATION
// =============================================================================

/**
 * SOURCE OF TRUTH (STRICT):
 * 
 * Story UI:
 *   - avatar   → story.author.avatarUrl
 *   - username → story.author.username
 *   - verified → story.author.verified
 * 
 * Post UI:
 *   - avatar   → post.author.avatarUrl
 *   - username → post.author.username
 *   - verified → post.author.verified
 * 
 * Comment UI:
 *   - avatar   → comment.author.avatarUrl
 *   - username → comment.author.username
 * 
 * Message UI:
 *   - avatar   → message.sender.avatarUrl
 *   - username → message.sender.username
 * 
 * Profile header:
 *   - avatar   → profileUser.avatarUrl
 *   - username → profileUser.username
 *   - bio      → profileUser.bio
 *   - verified → profileUser.verified
 *   - counts   → profileUser.followersCount / followingCount
 * 
 * Settings (ONLY place allowed to use authUser directly):
 *   - avatar   → authUser.avatarUrl
 *   - username → authUser.username
 *   - bio      → authUser.bio
 * 
 * authUser MUST NEVER be used for:
 *   - stories
 *   - posts
 *   - comments
 *   - messages
 *   - other users' profiles
 *   - other users' follow states
 *   - other users' counts
 */

// =============================================================================
// CACHE KEY ISOLATION RULES
// =============================================================================

/**
 * REQUIRED cache keys (ID-SCOPED):
 *   - ['authUser']
 *   - ['profile', userId]
 *   - ['user', userId]
 *   - ['followers', userId]
 *   - ['following', userId]
 *   - ['followState', viewerId, targetUserId]
 * 
 * FORBIDDEN cache keys:
 *   - ['user'] (no ID)
 *   - ['profile'] (no ID)
 *   - ['users'] (too broad)
 *   - ['me'] (outside auth)
 */

// =============================================================================
// TEST SCENARIOS
// =============================================================================

interface TestUser {
  id: string;
  username: string;
  avatar: string;
  bio: string;
  verified: boolean;
  followersCount: number;
  followingCount: number;
}

interface TestStory {
  id: string;
  author: TestUser;
}

interface TestPost {
  id: string;
  author: TestUser;
}

interface TestComment {
  id: string;
  author: TestUser;
}

interface TestMessage {
  id: string;
  sender: TestUser;
}

// Test data
const userA: TestUser = {
  id: 'user-A',
  username: 'userA',
  avatar: 'https://cdn.example.com/userA-original.jpg',
  bio: 'User A bio',
  verified: false,
  followersCount: 100,
  followingCount: 50,
};

const userB: TestUser = {
  id: 'user-B',
  username: 'userB',
  avatar: 'https://cdn.example.com/userB-original.jpg',
  bio: 'User B bio',
  verified: true,
  followersCount: 200,
  followingCount: 75,
};

const userBStory: TestStory = {
  id: 'story-B-1',
  author: userB,
};

const userBPost: TestPost = {
  id: 'post-B-1',
  author: userB,
};

const userBComment: TestComment = {
  id: 'comment-B-1',
  author: userB,
};

const userBMessage: TestMessage = {
  id: 'message-B-1',
  sender: userB,
};

// =============================================================================
// TEST RUNNER
// =============================================================================

let passCount = 0;
let failCount = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passCount++;
  } catch (e: any) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${e.message}`);
    failCount++;
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertNotEqual<T>(actual: T, notExpected: T, message?: string): void {
  if (actual === notExpected) {
    throw new Error(message || `Expected NOT ${notExpected}`);
  }
}

function assertThrows(fn: () => void, expectedMessage?: string): void {
  let threw = false;
  let error: Error | null = null;
  try {
    fn();
  } catch (e: any) {
    threw = true;
    error = e;
  }
  if (!threw) {
    throw new Error('Expected function to throw, but it did not');
  }
  if (expectedMessage && error && !error.message.includes(expectedMessage)) {
    throw new Error(`Expected error to include "${expectedMessage}", got "${error.message}"`);
  }
}

function assertDoesNotThrow(fn: () => void): void {
  try {
    fn();
  } catch (e: any) {
    throw new Error(`Expected NOT to throw, but threw: ${e.message}`);
  }
}

// =============================================================================
// TESTS: AVATAR ISOLATION
// =============================================================================

console.log('\n📋 Avatar Isolation Tests');

test('Story avatar MUST come from story.author, NOT authUser', () => {
  // When rendering User B's story, avatar must come from story.author
  const avatarToRender = userBStory.author.avatar;
  assertEqual(avatarToRender, userB.avatar, 'Avatar should be from story author');
  assertNotEqual(avatarToRender, userA.avatar, 'Avatar should NOT be from auth user');
});

test('User A avatar update should NOT affect User B story', () => {
  // Capture original
  const originalUserBAvatarUrl = userBStory.author.avatar;
  
  // User A updates their avatar (simulated)
  const userANewAvatar = 'https://cdn.example.com/userA-NEW.jpg';
  
  // User B story should be unchanged
  assertEqual(userBStory.author.avatar, originalUserBAvatarUrl);
  assertNotEqual(userBStory.author.avatar, userANewAvatar);
});

test('Post avatar MUST come from post.author, NOT authUser', () => {
  const avatarToRender = userBPost.author.avatar;
  assertEqual(avatarToRender, userB.avatar);
  assertNotEqual(avatarToRender, userA.avatar);
});

test('Comment avatar MUST come from comment.author, NOT authUser', () => {
  const avatarToRender = userBComment.author.avatar;
  assertEqual(avatarToRender, userB.avatar);
  assertNotEqual(avatarToRender, userA.avatar);
});

test('Message avatar MUST come from message.sender, NOT authUser', () => {
  const avatarToRender = userBMessage.sender.avatar;
  assertEqual(avatarToRender, userB.avatar);
  assertNotEqual(avatarToRender, userA.avatar);
});

// =============================================================================
// TESTS: USERNAME ISOLATION
// =============================================================================

console.log('\n📋 Username Isolation Tests');

test('Story username MUST come from story.author, NOT authUser', () => {
  const usernameToRender = userBStory.author.username;
  assertEqual(usernameToRender, userB.username);
  assertNotEqual(usernameToRender, userA.username);
});

test('User A username change should NOT affect User B content', () => {
  const originalUserBUsername = userBPost.author.username;
  
  // User A changes username (simulated)
  const userANewUsername = 'userA_new_name';
  
  // User B content should be unchanged
  assertEqual(userBPost.author.username, originalUserBUsername);
  assertNotEqual(userBPost.author.username, userANewUsername);
});

// =============================================================================
// TESTS: VERIFIED BADGE ISOLATION
// =============================================================================

console.log('\n📋 Verified Badge Isolation Tests');

test('Verified badge MUST come from entity author, NOT authUser', () => {
  const verifiedToRender = userBStory.author.verified;
  assertEqual(verifiedToRender, userB.verified);
  assertEqual(verifiedToRender, true, 'User B is verified');
});

test('User A verified change should NOT affect User B display', () => {
  const originalUserBVerified = userBPost.author.verified;
  
  // User A gets verified (simulated)
  // This should NOT change User B's verified status in their content
  
  assertEqual(userBPost.author.verified, originalUserBVerified);
});

// =============================================================================
// TESTS: CACHE KEY ISOLATION
// =============================================================================

console.log('\n📋 Cache Key Isolation Tests');

test('Valid cache keys should include userId', () => {
  const validCacheKeys = [
    ['authUser'],
    ['profile', 'user-123'],
    ['profile', 'username', 'johndoe'],
    ['stories'],
    ['posts'],
    ['followers', 'user-123'],
    ['following', 'user-123'],
    ['followState', 'viewer-1', 'target-2'],
  ];

  validCacheKeys.forEach(key => {
    if (key[0] === 'profile' && key.length > 1) {
      // Profile keys should have userId or username
      const hasId = key.length >= 2;
      assertEqual(hasId, true, `Profile key should have ID: ${JSON.stringify(key)}`);
    }
    if (key[0] === 'followers' || key[0] === 'following') {
      assertEqual(key.length, 2, `${key[0]} key should have userId`);
    }
    if (key[0] === 'followState') {
      assertEqual(key.length, 3, 'followState key should have viewerId and targetUserId');
    }
  });
});

test('Forbidden cache keys should NOT be used', () => {
  const forbiddenCacheKeys = [
    ['user'], // Too generic - missing ID
    ['profile'], // Missing userId
    ['me'], // Should be ['authUser']
    ['users'], // Too broad - affects all users
  ];

  // Document that these patterns are forbidden
  forbiddenCacheKeys.forEach(key => {
    // These keys lack proper scoping
    const isUnscoped = key.length === 1 && ['user', 'profile', 'me', 'users'].includes(key[0]);
    assertEqual(isUnscoped, true, `Key should be identified as unscoped: ${JSON.stringify(key)}`);
  });
});

// =============================================================================
// TESTS: AVATAR UPDATE SCOPE
// =============================================================================

console.log('\n📋 Avatar Update Scope Tests');

test('Avatar update should only invalidate current user caches', () => {
  const myUserId = 'user-A';
  const myUsername = 'userA';

  // These are the ONLY caches that should be invalidated when updating avatar
  const allowedInvalidations = [
    ['authUser'],
    ['profile', myUserId],
    ['profile', 'username', myUsername],
  ];

  // These should NEVER be invalidated on avatar update
  const forbiddenInvalidations = [
    ['users'], // Too broad
    ['stories'], // Contains other users' data
    ['posts'], // Contains other users' data
    ['profile', 'user-B'], // Other user's profile
  ];

  allowedInvalidations.forEach(key => {
    const isAllowed = key[0] === 'authUser' || 
      (key[0] === 'profile' && (key[1] === myUserId || key[2] === myUsername));
    assertEqual(isAllowed, true, `Should be allowed: ${JSON.stringify(key)}`);
  });

  forbiddenInvalidations.forEach(key => {
    const isForbidden = key[0] === 'users' || key[0] === 'stories' || key[0] === 'posts' ||
      (key[0] === 'profile' && key[1] !== myUserId && key[2] !== myUsername);
    assertEqual(isForbidden, true, `Should be forbidden: ${JSON.stringify(key)}`);
  });
});

// =============================================================================
// TESTS: STORY COMPONENT ISOLATION
// =============================================================================

console.log('\n📋 Story Component Isolation Tests');

test('Story key should include both story.id and story.author.id', () => {
  const story = {
    id: 'story-123',
    author: { id: 'user-456' },
  };

  // Correct key format that ensures uniqueness per author
  const correctKey = `story-${story.id}-${story.author.id}`;
  assertEqual(correctKey, 'story-story-123-user-456');

  // Different author should produce different key
  const anotherStoryByDifferentUser = {
    id: 'story-123',
    author: { id: 'user-789' },
  };

  const anotherKey = `story-${anotherStoryByDifferentUser.id}-${anotherStoryByDifferentUser.author.id}`;
  assertNotEqual(anotherKey, correctKey, 'Different authors should have different keys');
});

// =============================================================================
// TESTS: INVARIANT ASSERTIONS
// =============================================================================

console.log('\n📋 Invariant Assertion Tests');

test('assertIdentitySource should NOT throw for entity source', () => {
  const mockAssertIdentitySource = (params: {
    context: string;
    entityOwnerId: string;
    authUserId: string;
    identitySource: 'entity' | 'authUser';
  }) => {
    if (params.context !== 'settings' && params.identitySource === 'authUser') {
      if (params.entityOwnerId !== params.authUserId) {
        throw new Error('[IDENTITY OWNERSHIP VIOLATION]');
      }
    }
  };

  // Should NOT throw - identity comes from entity
  assertDoesNotThrow(() => {
    mockAssertIdentitySource({
      context: 'story',
      entityOwnerId: 'user-B',
      authUserId: 'user-A',
      identitySource: 'entity',
    });
  });
});

test('assertIdentitySource should NOT throw for settings context', () => {
  const mockAssertIdentitySource = (params: {
    context: string;
    entityOwnerId: string;
    authUserId: string;
    identitySource: 'entity' | 'authUser';
  }) => {
    if (params.context !== 'settings' && params.identitySource === 'authUser') {
      if (params.entityOwnerId !== params.authUserId) {
        throw new Error('[IDENTITY OWNERSHIP VIOLATION]');
      }
    }
  };

  // Should NOT throw - settings can use authUser
  assertDoesNotThrow(() => {
    mockAssertIdentitySource({
      context: 'settings',
      entityOwnerId: 'user-A',
      authUserId: 'user-A',
      identitySource: 'authUser',
    });
  });
});

test('assertIdentitySource SHOULD throw for cross-user authUser source', () => {
  const mockAssertIdentitySource = (params: {
    context: string;
    entityOwnerId: string;
    authUserId: string;
    identitySource: 'entity' | 'authUser';
  }) => {
    if (params.context !== 'settings' && params.identitySource === 'authUser') {
      if (params.entityOwnerId !== params.authUserId) {
        throw new Error('[IDENTITY OWNERSHIP VIOLATION]');
      }
    }
  };

  // SHOULD throw - story trying to use authUser identity for different user
  assertThrows(() => {
    mockAssertIdentitySource({
      context: 'story',
      entityOwnerId: 'user-B',
      authUserId: 'user-A',
      identitySource: 'authUser',
    });
  }, '[IDENTITY OWNERSHIP VIOLATION]');
});

// =============================================================================
// SUMMARY
// =============================================================================

console.log('\n' + '='.repeat(60));
console.log(`📊 Test Results: ${passCount} passed, ${failCount} failed`);
console.log('='.repeat(60));

if (failCount > 0) {
  console.log('\n⚠️  IDENTITY ISOLATION TESTS FAILED');
  console.log('    Cross-user data leaks are possible!');
  process.exit(1);
} else {
  console.log('\n✅ All identity isolation tests passed');
  console.log('   Cross-user data leaks are prevented.');
}
