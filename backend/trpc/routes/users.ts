import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../create-context";
import { payloadFetch } from "../payload-client";

export const usersRouter = createTRPCRouter({
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      console.log("[users.getById] Fetching user:", input.id);
      const response = await payloadFetch(`/users/${input.id}`);
      return response;
    }),

  getByUsername: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ input }) => {
      console.log("[users.getByUsername] Fetching user:", input.username);
      const response = await payloadFetch(`/users?where[username][equals]=${input.username}`);
      return response;
    }),

  search: publicProcedure
    .input(z.object({ 
      query: z.string(),
      limit: z.number().optional().default(20),
    }))
    .query(async ({ input }) => {
      console.log("[users.search] Searching users:", input.query);
      const response = await payloadFetch(
        `/users?where[or][0][username][contains]=${input.query}&where[or][1][displayName][contains]=${input.query}&limit=${input.limit}`
      );
      return response;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      displayName: z.string().optional(),
      bio: z.string().optional(),
      avatar: z.string().optional(),
      website: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      console.log("[users.update] Updating user:", input.id);
      const { id, ...data } = input;
      const response = await payloadFetch(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      return response;
    }),

  follow: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      console.log("[users.follow] Following user:", input.userId);
      const response = await payloadFetch(`/follows`, {
        method: "POST",
        body: JSON.stringify({ following: input.userId }),
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      return response;
    }),

  unfollow: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      console.log("[users.unfollow] Unfollowing user:", input.userId);
      const response = await payloadFetch(`/follows?where[following][equals]=${input.userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      return response;
    }),

  getFollowers: publicProcedure
    .input(z.object({ 
      userId: z.string(),
      limit: z.number().optional().default(20),
      page: z.number().optional().default(1),
    }))
    .query(async ({ input }) => {
      console.log("[users.getFollowers] Fetching followers for:", input.userId);
      const response = await payloadFetch(
        `/follows?where[following][equals]=${input.userId}&limit=${input.limit}&page=${input.page}`
      );
      return response;
    }),

  getFollowing: publicProcedure
    .input(z.object({ 
      userId: z.string(),
      limit: z.number().optional().default(20),
      page: z.number().optional().default(1),
    }))
    .query(async ({ input }) => {
      console.log("[users.getFollowing] Fetching following for:", input.userId);
      const response = await payloadFetch(
        `/follows?where[follower][equals]=${input.userId}&limit=${input.limit}&page=${input.page}`
      );
      return response;
    }),
});
