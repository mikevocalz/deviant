/**
 * Better Auth API Route Handler
 * 
 * Handles all auth requests at /api/auth/*
 */

import { auth } from "@/lib/auth";

const handler = auth.handler;

export { handler as GET, handler as POST };
