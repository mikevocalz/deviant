import { createTRPCRouter } from "./create-context";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { postsRouter } from "./routes/posts";
import { commentsRouter } from "./routes/comments";
import { messagesRouter } from "./routes/messages";
import { eventsRouter } from "./routes/events";
import { storiesRouter } from "./routes/stories";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  users: usersRouter,
  posts: postsRouter,
  comments: commentsRouter,
  messages: messagesRouter,
  events: eventsRouter,
  stories: storiesRouter,
});

export type AppRouter = typeof appRouter;
