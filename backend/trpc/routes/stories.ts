import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../create-context";
import { payloadFetch } from "../payload-client";

export const storiesRouter = createTRPCRouter({
  getFeed: protectedProcedure
    .input(z.object({
      limit: z.number().optional().default(20),
    }))
    .query(async ({ input, ctx }: { input: any; ctx: any }) => {
      console.log("[stories.getFeed] Fetching stories feed");
      const response = await payloadFetch(
        `/stories/feed?limit=${input.limit}`,
        {
          headers: {
            Authorization: `Bearer ${ctx.token}`,
          },
        }
      );
      return response;
    }),

  getByUser: publicProcedure
    .input(z.object({
      userId: z.string(),
      limit: z.number().optional().default(10),
    }))
    .query(async ({ input }: { input: any }) => {
      console.log("[stories.getByUser] Fetching stories for user:", input.userId);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const response = await payloadFetch(
        `/stories?where[author][equals]=${input.userId}&where[createdAt][greater_than]=${oneDayAgo}&limit=${input.limit}&sort=-createdAt`
      );
      return response;
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }: { input: any }) => {
      console.log("[stories.getById] Fetching story:", input.id);
      const response = await payloadFetch(`/stories/${input.id}`);
      return response;
    }),

  create: protectedProcedure
    .input(z.object({
      media: z.object({
        type: z.enum(["image", "video"]),
        url: z.string(),
      }),
      caption: z.string().optional(),
      location: z.string().optional(),
      stickers: z.array(z.object({
        type: z.string(),
        data: z.any(),
        position: z.object({ x: z.number(), y: z.number() }),
      })).optional(),
    }))
    .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
      console.log("[stories.create] Creating story");
      const response = await payloadFetch("/stories", {
        method: "POST",
        body: JSON.stringify(input),
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      console.log("[stories.create] Story created successfully");
      return response;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
      console.log("[stories.delete] Deleting story:", input.id);
      const response = await payloadFetch(`/stories/${input.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      return response;
    }),

  view: protectedProcedure
    .input(z.object({ storyId: z.string() }))
    .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
      console.log("[stories.view] Marking story as viewed:", input.storyId);
      const response = await payloadFetch("/story-views", {
        method: "POST",
        body: JSON.stringify({ story: input.storyId }),
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      return response;
    }),

  react: protectedProcedure
    .input(z.object({ 
      storyId: z.string(),
      reaction: z.string(),
    }))
    .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
      console.log("[stories.react] Reacting to story:", input.storyId);
      const response = await payloadFetch("/story-reactions", {
        method: "POST",
        body: JSON.stringify({ story: input.storyId, reaction: input.reaction }),
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      return response;
    }),

  getViewers: protectedProcedure
    .input(z.object({
      storyId: z.string(),
      limit: z.number().optional().default(50),
    }))
    .query(async ({ input, ctx }: { input: any; ctx: any }) => {
      console.log("[stories.getViewers] Fetching viewers for story:", input.storyId);
      const response = await payloadFetch(
        `/story-views?where[story][equals]=${input.storyId}&limit=${input.limit}`,
        {
          headers: {
            Authorization: `Bearer ${ctx.token}`,
          },
        }
      );
      return response;
    }),
});
