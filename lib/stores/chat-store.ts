import { create } from "zustand"

interface Message {
  id: string
  text: string
  sender: "me" | "them"
  time: string
}

interface ChatState {
  messages: Record<string, Message[]>
  currentMessage: string
  setCurrentMessage: (message: string) => void
  sendMessage: (chatId: string) => void
  initializeChat: (chatId: string, initialMessages: Message[]) => void
}

const mockMessages: Message[] = [
  { id: "1", text: "Hey! How are you doing?", sender: "them", time: "10:30 AM" },
  { id: "2", text: "I'm good! Just working on some projects", sender: "me", time: "10:32 AM" },
  { id: "3", text: "That sounds great! What kind of projects?", sender: "them", time: "10:33 AM" },
  { id: "4", text: "Building a social media app with React Native", sender: "me", time: "10:35 AM" },
  { id: "5", text: "Oh nice! I'd love to see it when it's done", sender: "them", time: "10:36 AM" },
]

export const useChatStore = create<ChatState>((set, get) => ({
  messages: {},
  currentMessage: "",
  setCurrentMessage: (message) => set({ currentMessage: message }),
  sendMessage: (chatId) => {
    const { currentMessage, messages } = get()
    if (!currentMessage.trim()) return
    
    const chatMessages = messages[chatId] || mockMessages
    const newMessage: Message = {
      id: Date.now().toString(),
      text: currentMessage,
      sender: "me",
      time: "Now",
    }
    
    set({
      messages: {
        ...messages,
        [chatId]: [...chatMessages, newMessage],
      },
      currentMessage: "",
    })
  },
  initializeChat: (chatId, initialMessages) => {
    const { messages } = get()
    if (!messages[chatId]) {
      set({
        messages: {
          ...messages,
          [chatId]: initialMessages,
        },
      })
    }
  },
}))
