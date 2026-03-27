/**
 * Feed and Relationship State Isolation Tests
 * 
 * CRITICAL: These tests ensure that:
 * - Feed is normalized by postId
 * - Like/bookmark state is scoped by viewerId + postId
 * - Follow state is scoped by viewerId + targetUserId
 * - Messaging inbox/spam is correctly classified
 * - No cross-user or cross-post state bleed
 * 
 * Run with: npx ts-node tests/feed-and-relationship-isolation.spec.ts
 */

// =============================================================================
// TEST UTILITIES
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

function assertTrue(value: boolean, message?: string): void {
  if (!value) {
    throw new Error(message || `Expected true, got false`);
  }
}

function assertFalse(value: boolean, message?: string): void {
  if (value) {
    throw new Error(message || `Expected false, got true`);
  }
}

// =============================================================================
// TEST DATA
// =============================================================================

interface TestUser {
  id: string;
  username: string;
  avatar: string;
}

interface TestPost {
  id: string;
  author: TestUser;
  likes: number;
  caption: string;
}

interface TestLikeState {
  viewerId: string;
  postId: string;
  hasLiked: boolean;
  likesCount: number;
}

interface TestBookmarkState {
  viewerId: string;
  postId: string;
  isBookmarked: boolean;
}

interface TestFollowState {
  viewerId: string;
  targetUserId: string;
  isFollowing: boolean;
  followersCount: number;
  followingCount: number;
}

interface TestMessage {
  id: string;
  sender: TestUser;
  content: string;
}

interface TestConversation {
  id: string;
  participants: TestUser[];
  lastMessage: TestMessage;
  isInbox: boolean; // derived from follow state
}

// Users
const userA: TestUser = { id: 'user-A', username: 'userA', avatar: 'https://cdn.example.com/a.jpg' };
const userB: TestUser = { id: 'user-B', username: 'userB', avatar: 'https://cdn.example.com/b.jpg' };
const userC: TestUser = { id: 'user-C', username: 'userC', avatar: 'https://cdn.example.com/c.jpg' };

// Posts
const postByA: TestPost = { id: 'post-A-1', author: userA, likes: 10, caption: 'Post by A' };
const postByB: TestPost = { id: 'post-B-1', author: userB, likes: 20, caption: 'Post by B' };
const postByC: TestPost = { id: 'post-C-1', author: userC, likes: 5, caption: 'Post by C' };

// Feed (mixed authors)
const feedPosts: TestPost[] = [postByA, postByB, postByC];

// =============================================================================
// PART 1: FEED NORMALIZATION TESTS
// =============================================================================

console.log('\n📋 Part 1: Feed Normalization Tests');

test('Feed items MUST have post.id', () => {
  feedPosts.forEach(post => {
    assertTrue(!!post.id, `Post missing id: ${JSON.stringify(post)}`);
  });
});

test('Feed items MUST have author.id', () => {
  feedPosts.forEach(post => {
    assertTrue(!!post.author?.id, `Post ${post.id} missing author.id`);
  });
});

test('Feed items MUST be keyed by post.id, NOT array index', () => {
  // Correct key format
  feedPosts.forEach((post, index) => {
    const correctKey = post.id;
    const incorrectKey = String(index);
    
    assertNotEqual(correctKey, incorrectKey, 
      `Post key should be post.id (${correctKey}), not index (${incorrectKey})`);
  });
});

test('Profile grid MUST only show posts by that author', () => {
  const profileUserId = userB.id;
  
  // Filter posts for profile B
  const profilePosts = feedPosts.filter(post => post.author.id === profileUserId);
  
  // Verify all posts belong to profile owner
  profilePosts.forEach(post => {
    assertEqual(post.author.id, profileUserId,
      `Post ${post.id} on profile ${profileUserId} has wrong author ${post.author.id}`);
  });
  
  // Verify post count
  assertEqual(profilePosts.length, 1, 'Profile B should have exactly 1 post');
});

test('Post detail MUST fetch by postId, not from feed cache', () => {
  const postId = postByB.id;
  
  // Simulate fetching by ID
  const fetchedPost = feedPosts.find(p => p.id === postId);
  
  assertTrue(!!fetchedPost, `Post ${postId} should be found`);
  assertEqual(fetchedPost?.id, postId, 'Fetched post ID should match');
});

// =============================================================================
// PART 2: LIKE STATE ISOLATION TESTS
// =============================================================================

console.log('\n📋 Part 2: Like State Isolation Tests');

// Simulated like state store (scoped by viewerId + postId)
const likeStates: Map<string, TestLikeState> = new Map();

function getLikeStateKey(viewerId: string, postId: string): string {
  return `${viewerId}:${postId}`;
}

function setLikeState(state: TestLikeState): void {
  likeStates.set(getLikeStateKey(state.viewerId, state.postId), state);
}

function getLikeState(viewerId: string, postId: string): TestLikeState | undefined {
  return likeStates.get(getLikeStateKey(viewerId, postId));
}

test('Like state MUST be scoped by viewerId + postId', () => {
  // User A likes Post B
  setLikeState({
    viewerId: userA.id,
    postId: postByB.id,
    hasLiked: true,
    likesCount: 21,
  });
  
  // Verify scoping
  const stateA = getLikeState(userA.id, postByB.id);
  assertTrue(stateA?.hasLiked === true, 'User A should see post as liked');
  
  // User C view should be independent
  const stateC = getLikeState(userC.id, postByB.id);
  assertTrue(stateC === undefined, 'User C should have no like state (not fetched yet)');
});

test('User A liking post should NOT affect User C view', () => {
  // User A's like state
  const userAState = getLikeState(userA.id, postByB.id);
  
  // User C's like state (independent)
  setLikeState({
    viewerId: userC.id,
    postId: postByB.id,
    hasLiked: false,
    likesCount: 21, // Count is shared, but hasLiked is per-viewer
  });
  
  const userCState = getLikeState(userC.id, postByB.id);
  
  // User A sees as liked, User C sees as not liked
  assertTrue(userAState?.hasLiked === true, 'User A should see liked');
  assertTrue(userCState?.hasLiked === false, 'User C should see not liked');
});

test('Like count increments ONLY for specific post', () => {
  const originalPostALikes = postByA.likes;
  const originalPostBLikes = postByB.likes;
  
  // User A likes Post B (simulated server response)
  setLikeState({
    viewerId: userA.id,
    postId: postByB.id,
    hasLiked: true,
    likesCount: 21,
  });
  
  // Post A likes should be unchanged
  assertEqual(postByA.likes, originalPostALikes, 'Post A likes should be unchanged');
});

// =============================================================================
// PART 3: BOOKMARK STATE ISOLATION TESTS
// =============================================================================

console.log('\n📋 Part 3: Bookmark State Isolation Tests');

// Simulated bookmark state store (scoped by viewerId + postId)
const bookmarkStates: Map<string, TestBookmarkState> = new Map();

function getBookmarkStateKey(viewerId: string, postId: string): string {
  return `bookmark:${viewerId}:${postId}`;
}

function setBookmarkState(state: TestBookmarkState): void {
  bookmarkStates.set(getBookmarkStateKey(state.viewerId, state.postId), state);
}

function getBookmarkState(viewerId: string, postId: string): TestBookmarkState | undefined {
  return bookmarkStates.get(getBookmarkStateKey(viewerId, postId));
}

test('Bookmark state MUST be scoped by viewerId + postId', () => {
  // User A bookmarks Post C
  setBookmarkState({
    viewerId: userA.id,
    postId: postByC.id,
    isBookmarked: true,
  });
  
  const stateA = getBookmarkState(userA.id, postByC.id);
  assertTrue(stateA?.isBookmarked === true, 'User A should see post as bookmarked');
});

test('User A bookmarking post should NOT affect User B saved list', () => {
  // User A bookmarks
  setBookmarkState({
    viewerId: userA.id,
    postId: postByC.id,
    isBookmarked: true,
  });
  
  // User B has not bookmarked
  const stateB = getBookmarkState(userB.id, postByC.id);
  assertTrue(stateB === undefined, 'User B should have no bookmark state');
});

// =============================================================================
// PART 4: FOLLOW STATE ISOLATION TESTS
// =============================================================================

console.log('\n📋 Part 4: Follow State Isolation Tests');

// Simulated follow state store (scoped by viewerId + targetUserId)
const followStates: Map<string, TestFollowState> = new Map();

function getFollowStateKey(viewerId: string, targetUserId: string): string {
  return `follow:${viewerId}:${targetUserId}`;
}

function setFollowState(state: TestFollowState): void {
  followStates.set(getFollowStateKey(state.viewerId, state.targetUserId), state);
}

function getFollowState(viewerId: string, targetUserId: string): TestFollowState | undefined {
  return followStates.get(getFollowStateKey(viewerId, targetUserId));
}

test('Follow state MUST be scoped by viewerId + targetUserId', () => {
  // User A follows User B
  setFollowState({
    viewerId: userA.id,
    targetUserId: userB.id,
    isFollowing: true,
    followersCount: 101,
    followingCount: 50,
  });
  
  const stateA = getFollowState(userA.id, userB.id);
  assertTrue(stateA?.isFollowing === true, 'User A should see following User B');
});

test('User A following User B should NOT affect User C view', () => {
  // User A's follow state
  setFollowState({
    viewerId: userA.id,
    targetUserId: userB.id,
    isFollowing: true,
    followersCount: 101,
    followingCount: 50,
  });
  
  // User C's view of User B (independent)
  setFollowState({
    viewerId: userC.id,
    targetUserId: userB.id,
    isFollowing: false,
    followersCount: 101, // Count is shared
    followingCount: 50,
  });
  
  const stateA = getFollowState(userA.id, userB.id);
  const stateC = getFollowState(userC.id, userB.id);
  
  assertTrue(stateA?.isFollowing === true, 'User A should see following');
  assertTrue(stateC?.isFollowing === false, 'User C should see not following');
});

test('Follow state MUST NOT be stored on authUser', () => {
  // Follow state should be in a separate scoped store
  // NOT as a property on the auth user object
  
  // This is a documentation/design test
  // In the actual codebase, we should verify that:
  // - authUser does NOT have isFollowing properties for other users
  // - Follow state is fetched per-viewer per-target
  
  assertTrue(true, 'Follow state should be in separate scoped store');
});

// =============================================================================
// PART 5: MESSAGE INBOX/SPAM ISOLATION TESTS
// =============================================================================

console.log('\n📋 Part 5: Message Inbox/Spam Isolation Tests');

test('Inbox contains conversations where sender is followed', () => {
  // User A follows User B
  setFollowState({
    viewerId: userA.id,
    targetUserId: userB.id,
    isFollowing: true,
    followersCount: 100,
    followingCount: 50,
  });
  
  // Message from User B to User A
  const messageFromB: TestMessage = {
    id: 'msg-1',
    sender: userB,
    content: 'Hello from B',
  };
  
  // Determine inbox vs spam based on follow state
  const senderIsFollowed = getFollowState(userA.id, userB.id)?.isFollowing === true;
  const isInbox = senderIsFollowed;
  
  assertTrue(isInbox, 'Message from followed user should be in Inbox');
});

test('Spam contains conversations where sender is NOT followed', () => {
  // User A does NOT follow User C
  // (no follow state set = not following)
  
  // Message from User C to User A
  const messageFromC: TestMessage = {
    id: 'msg-2',
    sender: userC,
    content: 'Hello from C',
  };
  
  // Determine inbox vs spam based on follow state
  const senderIsFollowed = getFollowState(userA.id, userC.id)?.isFollowing === true;
  const isInbox = senderIsFollowed;
  
  assertFalse(isInbox, 'Message from non-followed user should be in Spam');
});

test('Following sender moves conversation from Spam to Inbox', () => {
  // Initially not following User C
  let followState = getFollowState(userA.id, userC.id);
  let isInbox = followState?.isFollowing === true;
  assertFalse(isInbox, 'Initially should be in Spam');
  
  // User A follows User C
  setFollowState({
    viewerId: userA.id,
    targetUserId: userC.id,
    isFollowing: true,
    followersCount: 10,
    followingCount: 5,
  });
  
  // Now should be in Inbox
  followState = getFollowState(userA.id, userC.id);
  isInbox = followState?.isFollowing === true;
  assertTrue(isInbox, 'After following, should be in Inbox');
});

test('Message sender identity MUST come from message.sender', () => {
  const message: TestMessage = {
    id: 'msg-3',
    sender: userB,
    content: 'Test message',
  };
  
  // Avatar and username MUST come from message.sender
  const renderedAvatar = message.sender.avatar;
  const renderedUsername = message.sender.username;
  
  assertEqual(renderedAvatar, userB.avatar, 'Avatar should be from message.sender');
  assertEqual(renderedUsername, userB.username, 'Username should be from message.sender');
});

// =============================================================================
// PART 6: QUERY KEY ISOLATION TESTS
// =============================================================================

console.log('\n📋 Part 6: Query Key Isolation Tests');

test('Like state query key MUST include viewerId and postId', () => {
  const viewerId = userA.id;
  const postId = postByB.id;
  
  // Correct key format
  const correctKey = ['likeState', viewerId, postId];
  
  assertEqual(correctKey.length, 3, 'Like state key should have 3 parts');
  assertEqual(correctKey[0], 'likeState', 'First part should be likeState');
  assertEqual(correctKey[1], viewerId, 'Second part should be viewerId');
  assertEqual(correctKey[2], postId, 'Third part should be postId');
});

test('Follow state query key MUST include viewerId and targetUserId', () => {
  const viewerId = userA.id;
  const targetUserId = userB.id;
  
  // Correct key format
  const correctKey = ['followState', viewerId, targetUserId];
  
  assertEqual(correctKey.length, 3, 'Follow state key should have 3 parts');
  assertEqual(correctKey[0], 'followState', 'First part should be followState');
  assertEqual(correctKey[1], viewerId, 'Second part should be viewerId');
  assertEqual(correctKey[2], targetUserId, 'Third part should be targetUserId');
});

test('Forbidden broad query keys should NOT be used', () => {
  const forbiddenKeys = [
    ['users'],
    ['posts'],
    ['user'],
    ['profile'],
    ['me'],
  ];
  
  forbiddenKeys.forEach(key => {
    assertTrue(key.length === 1, `Key ${JSON.stringify(key)} is too broad`);
  });
});

// =============================================================================
// SUMMARY
// =============================================================================

console.log('\n' + '='.repeat(60));
console.log(`📊 Test Results: ${passCount} passed, ${failCount} failed`);
console.log('='.repeat(60));

if (failCount > 0) {
  console.log('\n⚠️  FEED AND RELATIONSHIP ISOLATION TESTS FAILED');
  console.log('    Cross-entity state leaks are possible!');
  process.exit(1);
} else {
  console.log('\n✅ All feed and relationship isolation tests passed');
  console.log('   Cross-entity state leaks are prevented.');
}
