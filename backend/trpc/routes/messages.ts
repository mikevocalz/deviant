import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../create-context";
import { payloadFetch } from "../payload-client";

export const messagesRouter = createTRPCRouter({
  getConversations: protectedProcedure
    .input(z.object({
      limit: z.number().optional().default(20),
      page: z.number().optional().default(1),
    }))
    .query(async ({ input, ctx }: { input: any; ctx: any }) => {
      console.log("[messages.getConversations] Fetching conversations");
      const response = await payloadFetch(
        `/conversations?limit=${input.limit}&page=${input.page}&sort=-updatedAt`,
        {
          headers: {
            Authorization: `Bearer ${ctx.token}`,
          },
        }
      );
      return response;
    }),

  getConversation: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }: { input: any; ctx: any }) => {
      console.log("[messages.getConversation] Fetching conversation:", input.id);
      const response = await payloadFetch(`/conversations/${input.id}`, {
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      return response;
    }),

  getMessages: protectedProcedure
    .input(z.object({
      conversationId: z.string(),
      limit: z.number().optional().default(50),
      page: z.number().optional().default(1),
    }))
    .query(async ({ input, ctx }: { input: any; ctx: any }) => {
      console.log("[messages.getMessages] Fetching messages for conversation:", input.conversationId);
      const response = await payloadFetch(
        `/messages?where[conversation][equals]=${input.conversationId}&limit=${input.limit}&page=${input.page}&sort=-createdAt`,
        {
          headers: {
            Authorization: `Bearer ${ctx.token}`,
          },
        }
      );
      return response;
    }),

  createConversation: protectedProcedure
    .input(z.object({
      participantIds: z.array(z.string()),
    }))
    .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
      console.log("[messages.createConversation] Creating conversation with:", input.participantIds);
      const response = await payloadFetch("/conversations", {
        method: "POST",
        body: JSON.stringify({ participants: input.participantIds }),
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      return response;
    }),

  sendMessage: protectedProcedure
    .input(z.object({
      conversationId: z.string(),
      content: z.string().min(1),
      mentions: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
      console.log("[messages.sendMessage] Sending message to conversation:", input.conversationId);
      const response = await payloadFetch("/messages", {
        method: "POST",
        body: JSON.stringify({
          conversation: input.conversationId,
          content: input.content,
          mentions: input.mentions,
        }),
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      console.log("[messages.sendMessage] Message sent successfully");
      return response;
    }),

  markAsRead: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
      console.log("[messages.markAsRead] Marking conversation as read:", input.conversationId);
      const response = await payloadFetch(`/conversations/${input.conversationId}/read`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      return response;
    }),

  deleteMessage: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
      console.log("[messages.deleteMessage] Deleting message:", input.id);
      const response = await payloadFetch(`/messages/${input.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      return response;
    }),
});
