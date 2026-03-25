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
  rootId?: string | null;
  depth?: number;
  replies?: Comment[];
};

export type MediaKind = "image" | "gif" | "video" | "livePhoto";
export type PostKind = "media" | "text";
export type TextPostThemeKey = "graphite" | "cobalt" | "ember" | "sage";

export type PostMediaItem = {
  type: MediaKind;
  url: string;
  thumbnail?: string;
  mimeType?: string;
  livePhotoVideoUrl?: string;
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
  media: PostMediaItem[];
  kind?: PostKind;
  textTheme?: TextPostThemeKey;
  caption?: string;
  likes: number;
  viewerHasLiked?: boolean; // CRITICAL: Viewer's like state from API
  comments: Comment[] | number;
  timeAgo: string;
  createdAt?: string;
  location?: string;
  isNSFW?: boolean;
  thumbnail?: string; // First media thumbnail for grid display
  type?: MediaKind; // Primary media type
  hasMultipleImages?: boolean; // Has carousel/multiple media
};

export type StoryItemType = "image" | "gif" | "video" | "livePhoto" | "text";

export type StoryItem = {
  url?: string;
  thumbnail?: string;
  type: StoryItemType;
  mimeType?: string;
  livePhotoVideoUrl?: string;
  duration: number;
  visibility?: "public" | "close_friends";
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
  hasCloseFriendsStory?: boolean;
  stories?: StoryItem[];
  items?: Array<{
    id?: string;
    type: StoryItemType;
    url?: string;
    thumbnail?: string;
    mimeType?: string;
    livePhotoVideoUrl?: string;
    text?: string;
    textColor?: string;
    backgroundColor?: string;
    duration?: number;
    visibility?: "public" | "close_friends";
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
