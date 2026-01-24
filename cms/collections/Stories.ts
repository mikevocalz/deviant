/**
 * Payload CMS Stories Collection
 *
 * Stories are ephemeral content that expire after 24 hours
 * Supports: images, videos, and text-based stories
 *
 * @see https://payloadcms.com/docs/configuration/collections
 */

import type { CollectionConfig } from "payload";

export const Stories: CollectionConfig = {
  slug: "stories",
  admin: {
    useAsTitle: "caption",
    defaultColumns: ["author", "caption", "items", "createdAt"],
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
      required: false,
      hasMany: false,
      admin: {
        position: "sidebar",
      },
    },

    // Caption (optional)
    {
      name: "caption",
      type: "text",
      required: false,
      maxLength: 500,
      admin: {
        description: "Optional caption for the story",
      },
    },

    // Story items array - supports multiple slides
    {
      name: "items",
      type: "array",
      required: true,
      minRows: 1,
      maxRows: 10,
      admin: {
        description: "Story slides (images, videos, or text)",
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
            { label: "Text", value: "text" },
          ],
        },
        {
          name: "url",
          type: "text",
          required: false,
          admin: {
            description: "CDN URL for the media file (Bunny.net)",
            condition: (data, siblingData) =>
              siblingData?.type === "image" || siblingData?.type === "video",
          },
        },
        {
          name: "text",
          type: "textarea",
          required: false,
          maxLength: 500,
          admin: {
            description: "Text content for text-based stories",
            condition: (data, siblingData) => siblingData?.type === "text",
          },
        },
        {
          name: "textColor",
          type: "text",
          required: false,
          defaultValue: "#FFFFFF",
          admin: {
            description: "Text color (hex)",
            condition: (data, siblingData) => siblingData?.type === "text",
          },
        },
        {
          name: "backgroundColor",
          type: "text",
          required: false,
          defaultValue: "#000000",
          admin: {
            description: "Background color (hex)",
            condition: (data, siblingData) => siblingData?.type === "text",
          },
        },
        {
          name: "duration",
          type: "number",
          required: false,
          defaultValue: 5000,
          admin: {
            description: "Duration in milliseconds (default 5000ms)",
          },
        },
      ],
    },

    // Viewed status
    {
      name: "viewed",
      type: "checkbox",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description: "Has the story been viewed?",
      },
    },

    // Views count
    {
      name: "viewsCount",
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

export default Stories;
