/**
 * Payload CMS Posts Collection
 *
 * Deploy this to your Payload CMS instance.
 * Supports: media (images/videos), captions, location, NSFW tagging
 *
 * @see https://payloadcms.com/docs/configuration/collections
 */

import type { CollectionConfig } from "payload";

export const Posts: CollectionConfig = {
  slug: "posts",
  admin: {
    useAsTitle: "caption",
    defaultColumns: ["author", "caption", "media", "createdAt"],
    group: "Content",
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
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

    // Media array - supports multiple images OR one video
    {
      name: "media",
      type: "array",
      required: false,
      minRows: 0,
      maxRows: 10,
      admin: {
        description: "Up to 4 images or 1 video per post",
      },
      fields: [
        {
          name: "type",
          type: "select",
          required: true,
          defaultValue: "image",
          options: [
            { label: "Image", value: "image" },
            { label: "Video", value: "video" },
          ],
        },
        {
          name: "url",
          type: "text",
          required: true,
          admin: {
            description: "CDN URL for the media file (Bunny.net)",
          },
        },
        {
          name: "width",
          type: "number",
          required: false,
          admin: {
            description: "Optional: media width in pixels",
          },
        },
        {
          name: "height",
          type: "number",
          required: false,
          admin: {
            description: "Optional: media height in pixels",
          },
        },
        {
          name: "duration",
          type: "number",
          required: false,
          admin: {
            description: "Optional: video duration in seconds",
            condition: (data, siblingData) => siblingData?.type === "video",
          },
        },
        {
          name: "thumbnail",
          type: "text",
          required: false,
          admin: {
            description: "Optional: thumbnail URL for videos",
            condition: (data, siblingData) => siblingData?.type === "video",
          },
        },
      ],
    },

    // Caption/Description
    {
      name: "caption",
      type: "textarea",
      required: false,
      maxLength: 2200,
      admin: {
        description: "Post caption (max 2200 characters)",
      },
    },

    // Legacy content field (alias for caption)
    {
      name: "content",
      type: "textarea",
      required: false,
      maxLength: 2200,
      admin: {
        description: "Alias for caption - for backwards compatibility",
        hidden: true,
      },
      hooks: {
        beforeValidate: [
          ({ data, siblingData }) => {
            // Sync content to caption if caption is empty
            if (!siblingData?.caption && data) {
              return data;
            }
            return siblingData?.caption || data;
          },
        ],
      },
    },

    // Location
    {
      name: "location",
      type: "text",
      required: false,
      admin: {
        description: 'Location name (e.g., "New York, NY")',
      },
    },

    // Location coordinates (optional)
    {
      name: "coordinates",
      type: "group",
      admin: {
        description: "Geographic coordinates",
        condition: (data) => Boolean(data?.location),
      },
      fields: [
        {
          name: "latitude",
          type: "number",
          required: false,
        },
        {
          name: "longitude",
          type: "number",
          required: false,
        },
      ],
    },

    // NSFW flag
    {
      name: "isNSFW",
      type: "checkbox",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description: "Mark as adult/NSFW content",
      },
    },

    // Engagement metrics
    {
      name: "likes",
      type: "number",
      defaultValue: 0,
      admin: {
        position: "sidebar",
        readOnly: true,
      },
    },

    {
      name: "commentsCount",
      type: "number",
      defaultValue: 0,
      admin: {
        position: "sidebar",
        readOnly: true,
      },
    },

    {
      name: "sharesCount",
      type: "number",
      defaultValue: 0,
      admin: {
        position: "sidebar",
        readOnly: true,
      },
    },

    // Visibility/Status
    {
      name: "status",
      type: "select",
      defaultValue: "published",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" },
        { label: "Archived", value: "archived" },
        { label: "Removed", value: "removed" },
      ],
      admin: {
        position: "sidebar",
      },
    },
  ],
  timestamps: true,
};

export default Posts;
