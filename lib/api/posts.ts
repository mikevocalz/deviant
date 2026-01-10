import type { Post } from "@/lib/constants"

// Simulated API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// API functions that simulate server calls
export const postsApi = {
  // Fetch feed posts
  async getFeedPosts(): Promise<Post[]> {
    await delay(500)
    const { feedPosts } = await import("@/lib/constants")
    return feedPosts
  },

  // Fetch profile posts
  async getProfilePosts(username: string): Promise<Post[]> {
    await delay(500)
    const { profilePosts } = await import("@/lib/constants")
    return profilePosts
  },

  // Fetch single post by ID
  async getPostById(id: string): Promise<Post | null> {
    await delay(300)
    const { getPostById } = await import("@/lib/constants")
    return getPostById(id) || null
  },

  // Like a post
  async likePost(postId: string): Promise<{ postId: string; likes: number }> {
    await delay(200)
    return { postId, likes: Math.floor(Math.random() * 10000) }
  },

  // Create a new post
  async createPost(data: Partial<Post>): Promise<Post> {
    await delay(800)
    const newPost: Post = {
      id: `p-${Date.now()}`,
      author: data.author || {
        username: "alex.creator",
        avatar: "https://i.pravatar.cc/150?img=12",
        verified: true,
      },
      media: data.media || [],
      caption: data.caption,
      likes: 0,
      comments: [],
      timeAgo: "Just now",
      location: data.location,
    }
    return newPost
  },

  // Delete a post
  async deletePost(postId: string): Promise<string> {
    await delay(300)
    return postId
  },
}
