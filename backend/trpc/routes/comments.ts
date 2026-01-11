import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../create-context";
import { payloadFetch } from "../payload-client";

export const commentsRouter = createTRPCRouter({
  getByPost: publicProcedure
    .input(z.object({
      postId: z.string(),
      limit: z.number().optional().default(20),
      page: z.number().optional().default(1),
    }))
    .query(async ({ input }: { input: any }) => {
      console.log("[comments.getByPost] Fetching comments for post:", input.postId);
      const response = await payloadFetch(
        `/comments?where[post][equals]=${input.postId}&where[parent][exists]=false&limit=${input.limit}&page=${input.page}&sort=-createdAt`
      );
      return response;
    }),

  getReplies: publicProcedure
    .input(z.object({
      commentId: z.string(),
      limit: z.number().optional().default(20),
      page: z.number().optional().default(1),
    }))
    .query(async ({ input }: { input: any }) => {
      console.log("[comments.getReplies] Fetching replies for comment:", input.commentId);
      const response = await payloadFetch(
        `/comments?where[parent][equals]=${input.commentId}&limit=${input.limit}&page=${input.page}&sort=createdAt`
      );
      return response;
    }),

  create: protectedProcedure
    .input(z.object({
      postId: z.string(),
      content: z.string().min(1),
      parentId: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
      console.log("[comments.create] Creating comment on post:", input.postId);
      const response = await payloadFetch("/comments", {
        method: "POST",
        body: JSON.stringify({
          post: input.postId,
          content: input.content,
          parent: input.parentId,
        }),
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      console.log("[comments.create] Comment created successfully");
      return response;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      content: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
      console.log("[comments.update] Updating comment:", input.id);
      const response = await payloadFetch(`/comments/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify({ content: input.content }),
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      return response;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
      console.log("[comments.delete] Deleting comment:", input.id);
      const response = await payloadFetch(`/comments/${input.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      return response;
    }),

  like: protectedProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
      console.log("[comments.like] Liking comment:", input.commentId);
      const response = await payloadFetch("/comment-likes", {
        method: "POST",
        body: JSON.stringify({ comment: input.commentId }),
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      return response;
    }),

  unlike: protectedProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
      console.log("[comments.unlike] Unliking comment:", input.commentId);
      const response = await payloadFetch(`/comment-likes?where[comment][equals]=${input.commentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      return response;
    }),
});
