/**
 * Messages API - Re-exports from Supabase implementation
 */
export {
  messagesApi,
  messagesApi as messagesApiClient,
} from "./supabase-messages";

// Conversation type for messages list
export interface Conversation {
  id: string;
  user: {
    name: string;
    username: string;
    avatar: string;
  };
  lastMessage: string;
  timestamp: string;
  unread: boolean;
}
