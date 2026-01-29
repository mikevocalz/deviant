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
  username: string;
  avatar: string;
  hasStory: boolean;
  isViewed: boolean;
  isYou?: boolean;
  stories: StoryItem[];
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
