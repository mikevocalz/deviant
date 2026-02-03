export type Comment = {
  id: string;
  username: string;
  avatar: string;
  text: string;
  timeAgo: string;
  likes: number;
  hasLiked?: boolean;
  postId?: string;
  parentId?: string | null;
  replies?: Comment[];
};

export type Post = {
  id: string;
  author: {
    id?: string;
    username: string;
    avatar: string;
    verified?: boolean;
    name?: string;
  };
  media: { type: "image" | "video"; url: string; thumbnail?: string }[];
  caption?: string;
  likes: number;
  viewerHasLiked?: boolean; // CRITICAL: Viewer's like state from API
  comments: Comment[];
  timeAgo: string;
  createdAt?: string;
  location?: string;
  isNSFW?: boolean;
  thumbnail?: string; // First media thumbnail for grid display
  type?: "image" | "video"; // Primary media type
  hasMultipleImages?: boolean; // Has carousel/multiple media
};

export type StoryItem = {
  url?: string;
  type: "image" | "video" | "text";
  duration: number;
  text?: string;
  textColor?: string;
  backgroundColor?: string;
  header: {
    heading: string;
    subheading: string;
    profileImage: string;
  };
};

export type Story = {
  id: string;
  userId?: string;
  username: string;
  avatar: string;
  hasStory?: boolean;
  isViewed: boolean;
  isYou?: boolean;
  stories?: StoryItem[];
  items?: Array<{
    id?: string;
    type: "image" | "video" | "text";
    url?: string;
    text?: string;
    textColor?: string;
    backgroundColor?: string;
    duration?: number;
  }>;
};

export type Conversation = {
  id: string;
  user: {
    name: string;
    username: string;
    avatar: string;
  };
  lastMessage: string;
  timestamp: string;
  unread: boolean;
};

export type Message = {
  id: string;
  text: string;
  sender: "user" | "other";
  timestamp: string;
  media?: { type: "image" | "video"; url: string }[];
};
