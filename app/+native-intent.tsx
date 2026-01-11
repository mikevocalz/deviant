export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  console.log('[DeepLink] Received path:', path, 'initial:', initial);
  
  if (!path || path === '/') {
    return '/';
  }

  // Handle post deep links
  if (path.startsWith('/post/')) {
    const postId = path.replace('/post/', '');
    console.log('[DeepLink] Redirecting to post:', postId);
    return `/(protected)/post/${postId}`;
  }

  // Handle profile deep links
  if (path.startsWith('/profile/')) {
    const username = path.replace('/profile/', '');
    console.log('[DeepLink] Redirecting to profile:', username);
    return `/(protected)/profile/${username}`;
  }

  // Handle event deep links
  if (path.startsWith('/events/')) {
    const eventId = path.replace('/events/', '');
    console.log('[DeepLink] Redirecting to event:', eventId);
    return `/(protected)/events/${eventId}`;
  }

  // Handle story deep links
  if (path.startsWith('/story/')) {
    const storyId = path.replace('/story/', '');
    console.log('[DeepLink] Redirecting to story:', storyId);
    return `/(protected)/story/${storyId}`;
  }

  // Handle comments deep links
  if (path.startsWith('/comments/')) {
    const postId = path.replace('/comments/', '');
    console.log('[DeepLink] Redirecting to comments:', postId);
    return `/(protected)/comments/${postId}`;
  }

  // Handle messages deep links
  if (path.startsWith('/chat/')) {
    const chatId = path.replace('/chat/', '');
    console.log('[DeepLink] Redirecting to chat:', chatId);
    return `/(protected)/chat/${chatId}`;
  }

  console.log('[DeepLink] No matching route, using default path:', path);
  return path;
}
