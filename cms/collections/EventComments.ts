/**
 * Payload CMS Event Comments Collection
 *
 * Comments on events (separate from post comments)
 *
 * @see https://payloadcms.com/docs/configuration/collections
 */

import type { CollectionConfig } from "payload";

export const EventComments: CollectionConfig = {
  slug: "event-comments",
  admin: {
    useAsTitle: "content",
    defaultColumns: ["author", "event", "content", "createdAt"],
    group: "Engagement",
  },
  access: {
    read: () => true,
    create: ({ req }) => {
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

    // Event relationship
    {
      name: "event",
      type: "relationship",
      relationTo: "events",
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
      relationTo: "event-comments",
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

export default EventComments;
