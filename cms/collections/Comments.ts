/**
 * Payload CMS Comments Collection
 *
 * Comments on posts with support for nested replies
 *
 * @see https://payloadcms.com/docs/configuration/collections
 */

import type { CollectionConfig } from "payload";

export const Comments: CollectionConfig = {
  slug: "comments",
  admin: {
    useAsTitle: "content",
    defaultColumns: ["author", "post", "content", "createdAt"],
    group: "Engagement",
  },
  access: {
    read: () => true,
    // Allow creation via API key (server-side) or logged-in user
    create: ({ req }) => {
      // API key requests have req.user as the API key holder or are authenticated
      // Allow if there's a user OR if the request has authorization header (API key)
      const hasAuth = req.headers?.get?.("authorization") || req.user;
      return Boolean(hasAuth);
    },
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  hooks: {
    beforeChange: [
      ({ data, req }) => {
        // Auto-set author to current user on create
        if (req.user && !data.author) {
          data.author = req.user.id;
        }
        return data;
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        // Update post's comment count on create
        if (operation === "create" && doc.post) {
          try {
            const postId = typeof doc.post === "string" ? doc.post : doc.post.id;
            const post = await req.payload.findByID({
              collection: "posts",
              id: postId,
            });
            
            if (post) {
              await req.payload.update({
                collection: "posts",
                id: postId,
                data: {
                  commentsCount: ((post.commentsCount as number) || 0) + 1,
                },
              });
            }
          } catch (error) {
            console.error("[Comments] Error updating post comment count:", error);
          }
        }
        return doc;
      },
    ],
  },
  fields: [
    // Author relationship
    {
      name: "author",
      type: "relationship",
      relationTo: "users",
      required: true,
      hasMany: false,
      admin: {
        position: "sidebar",
      },
    },

    // Post relationship
    {
      name: "post",
      type: "relationship",
      relationTo: "posts",
      required: true,
      hasMany: false,
      index: true,
      admin: {
        position: "sidebar",
      },
    },

    // Comment content
    {
      name: "content",
      type: "textarea",
      required: true,
      maxLength: 1000,
      admin: {
        description: "Comment text (max 1000 characters)",
      },
    },

    // Parent comment (for replies)
    {
      name: "parent",
      type: "relationship",
      relationTo: "comments",
      required: false,
      hasMany: false,
      admin: {
        position: "sidebar",
        description: "Parent comment (if this is a reply)",
      },
    },

    // Likes count
    {
      name: "likes",
      type: "number",
      defaultValue: 0,
      admin: {
        position: "sidebar",
        readOnly: true,
      },
    },
  ],
  timestamps: true,
};

export default Comments;
