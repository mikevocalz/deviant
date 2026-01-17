/**
 * Better Auth API Route
 *
 * Handles all auth requests: /api/auth/*
 * - Sign in (email/password, social)
 * - Sign up
 * - Sign out
 * - Session management
 */

import { auth } from "@/lib/auth";

const handler = auth.handler;

export { handler as GET, handler as POST };
