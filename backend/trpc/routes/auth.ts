import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../create-context";
import { payloadFetch } from "../payload-client";

export const authRouter = createTRPCRouter({
  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }))
    .mutation(async ({ input }: { input: any }) => {
      console.log("[auth.login] Attempting login for:", input.email);
      const response = await payloadFetch("/users/login", {
        method: "POST",
        body: JSON.stringify(input),
      });
      console.log("[auth.login] Login successful");
      return response;
    }),

  signup: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(6),
      username: z.string().min(3),
      displayName: z.string().optional(),
    }))
    .mutation(async ({ input }: { input: any }) => {
      console.log("[auth.signup] Creating user:", input.username);
      const response = await payloadFetch("/users", {
        method: "POST",
        body: JSON.stringify(input),
      });
      console.log("[auth.signup] User created successfully");
      return response;
    }),

  me: protectedProcedure
    .query(async ({ ctx }: { ctx: any }) => {
      console.log("[auth.me] Fetching current user");
      const response = await payloadFetch("/users/me", {
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      return response;
    }),

  logout: protectedProcedure
    .mutation(async ({ ctx }: { ctx: any }) => {
      console.log("[auth.logout] Logging out user");
      const response = await payloadFetch("/users/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      return response;
    }),

  refreshToken: protectedProcedure
    .mutation(async ({ ctx }: { ctx: any }) => {
      console.log("[auth.refreshToken] Refreshing token");
      const response = await payloadFetch("/users/refresh-token", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ctx.token}`,
        },
      });
      return response;
    }),
});
