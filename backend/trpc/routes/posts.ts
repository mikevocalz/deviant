import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../create-context";
import { payloadFetch } from "../payload-client";

export const postsRouter = createTRPCRouter({
  getAll: publicProcedure
    .input(z.object({
      limit: z.number().optional().default(20),
      page: z.number().optional().default(1),
    }))
    .query(async ({ input }) => {
      console.log("[posts.getAll] Fetching posts, page:", input.page);
      const response = await payloadFetch(
        `/posts?limit=${input.limit}&page=${input.page}&sort=-createdAt`
      );
      return response;
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      console.log("[posts.getById] Fetching post:", input.id);
      const response = await payloadFetch(`/posts/${input.id}`);
      return response;
    }),

  getByUser: publicProcedure
    .input(z.object({
      userId: z.string(),
      limit: z.number().optional().default(20),
      page: z.number().optional().default(1),
    }))
    .query(async ({ input }) => {
      console.log("[posts.getByUser] Fetching posts for user:", input.userId);
      const response = await payloadFetch(
        `/posts?where[author][equals]=${input.userId}&limit=${input.limit}&page=${input.page}&sort=-createdAt`
      );
      return response;
    }),

  getFeed: protectedProcedure
    .input(z.object({
      limit: z.number().optional().default(20),
      page: z.number().optional().default(1),
    }))
    .query(async ({ input, ctx }) => {
      console.log("[posts.getFeed] Fetching feed");
      const response = await payloadFetch(
        `/posts/feed?limit=${input.limit}&page=${input.page}`,
        {
          headers: {
            Authorization: `Bearer ${ctx.token}`,
          },
        }
      );
      return response;
    }),

  create: protectedProcedure
    .input(z.object({
      content: z.string().optional(),
      media: z.array(z.object({
        type: z.enum(["image", "video"]),
        url: z.string(),
      })).optional(),
      location: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      console.log("[posts.create] Creating post");
      const response = await payloadFetch("/posts", {
        method: "POST",
        body: JSON.stringify(input),
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      console.log("[posts.create] Post created successfully");
      return response;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      content: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      console.log("[posts.update] Updating post:", input.id);
      const { id, ...data } = input;
      const response = await payloadFetch(`/posts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      return response;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      console.log("[posts.delete] Deleting post:", input.id);
      const response = await payloadFetch(`/posts/${input.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      return response;
    }),

  like: protectedProcedure
    .input(z.object({ postId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      console.log("[posts.like] Liking post:", input.postId);
      const response = await payloadFetch("/likes", {
        method: "POST",
        body: JSON.stringify({ post: input.postId }),
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      return response;
    }),

  unlike: protectedProcedure
    .input(z.object({ postId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      console.log("[posts.unlike] Unliking post:", input.postId);
      const response = await payloadFetch(`/likes?where[post][equals]=${input.postId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      return response;
    }),

  bookmark: protectedProcedure
    .input(z.object({ postId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      console.log("[posts.bookmark] Bookmarking post:", input.postId);
      const response = await payloadFetch("/bookmarks", {
        method: "POST",
        body: JSON.stringify({ post: input.postId }),
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      return response;
    }),

  unbookmark: protectedProcedure
    .input(z.object({ postId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      console.log("[posts.unbookmark] Removing bookmark:", input.postId);
      const response = await payloadFetch(`/bookmarks?where[post][equals]=${input.postId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      return response;
    }),
});
