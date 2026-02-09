/**
 * Messages API - Re-exports from implementation
 */
export { messagesApi, messagesApi as messagesApiClient } from "./messages-impl";

// Conversation type for messages list
export interface Conversation {
  id: string;
  user: {
    id: string;
    name: string;
    username: string;
    avatar: string;
  };
  lastMessage: string;
  timestamp: string;
  unread: boolean;
  isGroup?: boolean;
}
