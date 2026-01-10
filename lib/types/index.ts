export type Comment = {
  id: string
  username: string
  avatar: string
  text: string
  timeAgo: string
  likes: number
  replies?: Comment[]
}

export type Post = {
  id: string
  author: {
    username: string
    avatar: string
    verified?: boolean
    name?: string
  }
  media: { type: "image" | "video"; url: string }[]
  caption?: string
  likes: number
  comments: Comment[]
  timeAgo: string
  location?: string
}

export type StoryItem = {
  url: string
  type: "image" | "video"
  duration: number
  header: {
    heading: string
    subheading: string
    profileImage: string
  }
}

export type Story = {
  id: string
  username: string
  avatar: string
  hasStory: boolean
  isViewed: boolean
  isYou?: boolean
  stories: StoryItem[]
}

export type Conversation = {
  id: string
  user: {
    name: string
    username: string
    avatar: string
  }
  lastMessage: string
  timestamp: string
  unread: boolean
}

export type Message = {
  id: string
  text: string
  sender: "user" | "other"
  timestamp: string
  media?: { type: "image" | "video"; url: string }[]
}
