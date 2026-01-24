/**
 * Search Hook
 * 
 * Provides React Query hooks for searching posts and users
 */

import { useQuery } from "@tanstack/react-query";
import { posts, users } from "@/lib/api-client";

export function useSearchPosts(query: string) {
  const isHashtag = query.startsWith("#");
  const searchTerm = isHashtag ? query.slice(1) : query;

  return useQuery({
    queryKey: ["search", "posts", query],
    queryFn: async () => {
      if (!query || query.length < 1) return { docs: [], totalDocs: 0 };

      try {
        // If it's a hashtag, search in caption for the hashtag
        if (isHashtag) {
          const result = await posts.find({
            where: {
              caption: {
                contains: `#${searchTerm}`,
              },
            },
            limit: 50,
            sort: "-createdAt",
            depth: 2,
          });
          return result;
        } else {
          // Regular search - search in caption
          const result = await posts.find({
            where: {
              caption: {
                contains: searchTerm,
              },
            },
            limit: 50,
            sort: "-createdAt",
            depth: 2,
          });
          return result;
        }
      } catch (error) {
        console.error("[useSearchPosts] Error:", error);
        return { docs: [], totalDocs: 0 };
      }
    },
    enabled: !!query && query.length >= 1,
  });
}

export function useSearchUsers(query: string) {
  return useQuery({
    queryKey: ["search", "users", query],
    queryFn: async () => {
      if (!query || query.length < 1) return { docs: [], totalDocs: 0 };

      try {
        const result = await users.find({
          where: {
            or: [
              { username: { contains: query.toLowerCase() } },
              { name: { contains: query } },
            ],
          },
          limit: 20,
        });
        return result;
      } catch (error) {
        console.error("[useSearchUsers] Error:", error);
        return { docs: [], totalDocs: 0 };
      }
    },
    enabled: !!query && query.length >= 1,
  });
}
