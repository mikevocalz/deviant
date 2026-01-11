import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../create-context";
import { payloadFetch } from "../payload-client";

export const eventsRouter = createTRPCRouter({
  getAll: publicProcedure
    .input(z.object({
      limit: z.number().optional().default(20),
      page: z.number().optional().default(1),
    }))
    .query(async ({ input }: { input: any }) => {
      console.log("[events.getAll] Fetching events, page:", input.page);
      const response = await payloadFetch(
        `/events?limit=${input.limit}&page=${input.page}&sort=startDate`
      );
      return response;
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }: { input: any }) => {
      console.log("[events.getById] Fetching event:", input.id);
      const response = await payloadFetch(`/events/${input.id}`);
      return response;
    }),

  getUpcoming: publicProcedure
    .input(z.object({
      limit: z.number().optional().default(10),
    }))
    .query(async ({ input }: { input: any }) => {
      console.log("[events.getUpcoming] Fetching upcoming events");
      const now = new Date().toISOString();
      const response = await payloadFetch(
        `/events?where[startDate][greater_than]=${now}&limit=${input.limit}&sort=startDate`
      );
      return response;
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      startDate: z.string(),
      endDate: z.string().optional(),
      location: z.string().optional(),
      coverImage: z.string().optional(),
      isOnline: z.boolean().optional(),
      maxAttendees: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
      console.log("[events.create] Creating event:", input.title);
      const response = await payloadFetch("/events", {
        method: "POST",
        body: JSON.stringify(input),
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      console.log("[events.create] Event created successfully");
      return response;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      location: z.string().optional(),
      coverImage: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
      console.log("[events.update] Updating event:", input.id);
      const { id, ...data } = input;
      const response = await payloadFetch(`/events/${id}`, {
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
    .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
      console.log("[events.delete] Deleting event:", input.id);
      const response = await payloadFetch(`/events/${input.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      return response;
    }),

  rsvp: protectedProcedure
    .input(z.object({ 
      eventId: z.string(),
      status: z.enum(["going", "interested", "not_going"]),
    }))
    .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
      console.log("[events.rsvp] RSVP to event:", input.eventId, "status:", input.status);
      const response = await payloadFetch("/event-rsvps", {
        method: "POST",
        body: JSON.stringify({ event: input.eventId, status: input.status }),
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      return response;
    }),

  getAttendees: publicProcedure
    .input(z.object({
      eventId: z.string(),
      status: z.enum(["going", "interested"]).optional(),
      limit: z.number().optional().default(20),
      page: z.number().optional().default(1),
    }))
    .query(async ({ input }: { input: any }) => {
      console.log("[events.getAttendees] Fetching attendees for event:", input.eventId);
      let url = `/event-rsvps?where[event][equals]=${input.eventId}&limit=${input.limit}&page=${input.page}`;
      if (input.status) {
        url += `&where[status][equals]=${input.status}`;
      }
      const response = await payloadFetch(url);
      return response;
    }),
});
