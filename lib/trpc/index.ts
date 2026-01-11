const getBaseUrl = () => {
  const url = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;

  if (!url) {
    console.warn("[API] EXPO_PUBLIC_RORK_API_BASE_URL not set");
    return "";
  }

  return url;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
};

export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/trpc/${endpoint}`;

  console.log(`[API] ${options.method || "GET"} ${url}`);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[API] Error ${response.status}:`, errorData);
      throw new Error(
        (errorData as { message?: string }).message ||
          `API request failed with status ${response.status}`
      );
    }

    const data = await response.json();
    console.log(`[API] Success`);
    return data as T;
  } catch (error) {
    console.error(`[API] Request failed:`, error);
    throw error;
  }
}

export const api = {
  auth: {
    login: (input: { email: string; password: string }) =>
      apiClient("auth.login", { method: "POST", body: { input } }),
    register: (input: { email: string; password: string; username: string }) =>
      apiClient("auth.register", { method: "POST", body: { input } }),
    me: () => apiClient("auth.me"),
    logout: () => apiClient("auth.logout", { method: "POST" }),
  },
  users: {
    getById: (id: string) => apiClient(`users.getById?input=${encodeURIComponent(JSON.stringify({ id }))}`),
    getByUsername: (username: string) => apiClient(`users.getByUsername?input=${encodeURIComponent(JSON.stringify({ username }))}`),
    update: (input: { displayName?: string; bio?: string; avatar?: string }) =>
      apiClient("users.update", { method: "POST", body: { input } }),
    follow: (userId: string) => apiClient("users.follow", { method: "POST", body: { input: { userId } } }),
    unfollow: (userId: string) => apiClient("users.unfollow", { method: "POST", body: { input: { userId } } }),
  },
  posts: {
    getAll: (params?: { limit?: number; page?: number }) =>
      apiClient(`posts.getAll?input=${encodeURIComponent(JSON.stringify(params || {}))}`),
    getById: (id: string) => apiClient(`posts.getById?input=${encodeURIComponent(JSON.stringify({ id }))}`),
    getFeed: (params?: { limit?: number; page?: number }) =>
      apiClient(`posts.getFeed?input=${encodeURIComponent(JSON.stringify(params || {}))}`),
    create: (input: { content?: string; media?: { type: string; url: string }[]; location?: string }) =>
      apiClient("posts.create", { method: "POST", body: { input } }),
    like: (postId: string) => apiClient("posts.like", { method: "POST", body: { input: { postId } } }),
    unlike: (postId: string) => apiClient("posts.unlike", { method: "POST", body: { input: { postId } } }),
    bookmark: (postId: string) => apiClient("posts.bookmark", { method: "POST", body: { input: { postId } } }),
    unbookmark: (postId: string) => apiClient("posts.unbookmark", { method: "POST", body: { input: { postId } } }),
  },
  comments: {
    getByPost: (postId: string) => apiClient(`comments.getByPost?input=${encodeURIComponent(JSON.stringify({ postId }))}`),
    create: (input: { postId: string; content: string; parentId?: string }) =>
      apiClient("comments.create", { method: "POST", body: { input } }),
    delete: (id: string) => apiClient("comments.delete", { method: "POST", body: { input: { id } } }),
  },
  messages: {
    getConversations: () => apiClient("messages.getConversations"),
    getMessages: (conversationId: string) =>
      apiClient(`messages.getMessages?input=${encodeURIComponent(JSON.stringify({ conversationId }))}`),
    send: (input: { recipientId: string; content: string }) =>
      apiClient("messages.send", { method: "POST", body: { input } }),
  },
  events: {
    getAll: () => apiClient("events.getAll"),
    getById: (id: string) => apiClient(`events.getById?input=${encodeURIComponent(JSON.stringify({ id }))}`),
    rsvp: (eventId: string) => apiClient("events.rsvp", { method: "POST", body: { input: { eventId } } }),
    unrsvp: (eventId: string) => apiClient("events.unrsvp", { method: "POST", body: { input: { eventId } } }),
  },
  stories: {
    getAll: () => apiClient("stories.getAll"),
    create: (input: { mediaUrl: string; mediaType: string }) =>
      apiClient("stories.create", { method: "POST", body: { input } }),
    view: (storyId: string) => apiClient("stories.view", { method: "POST", body: { input: { storyId } } }),
  },
};
