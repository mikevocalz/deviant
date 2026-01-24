/**
 * Payload CMS Users Collection
 *
 * User accounts with profile data for social features
 */

import type { CollectionConfig } from "payload";

export const Users: CollectionConfig = {
  slug: "users",
  auth: true,
  admin: {
    useAsTitle: "username",
    defaultColumns: ["username", "email", "name", "isVerified", "createdAt"],
    group: "Users",
  },
  access: {
    read: () => true,
    create: () => true,
    update: ({ req: { user }, id }) => {
      if (!user) return false;
      // Users can only update their own profile
      return user.id === id;
    },
    delete: ({ req: { user } }) => {
      // Only admins can delete users
      return user?.role === "admin";
    },
  },
  fields: [
    {
      name: "username",
      type: "text",
      required: true,
      unique: true,
      admin: {
        description: "Unique username (lowercase, no spaces)",
      },
      validate: (value) => {
        if (!value) return "Username is required";
        if (!/^[a-z0-9_]+$/.test(value)) {
          return "Username can only contain lowercase letters, numbers, and underscores";
        }
        if (value.length < 3) return "Username must be at least 3 characters";
        if (value.length > 30) return "Username must be 30 characters or less";
        return true;
      },
    },
    {
      name: "name",
      type: "text",
      required: false,
      admin: {
        description: "Display name",
      },
    },
    {
      name: "avatar",
      type: "text",
      required: false,
      admin: {
        description: "Profile picture URL (Bunny CDN)",
      },
    },
    {
      name: "bio",
      type: "textarea",
      maxLength: 500,
      required: false,
    },
    {
      name: "isVerified",
      type: "checkbox",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description: "Verified account badge",
      },
    },
    {
      name: "isPrivate",
      type: "checkbox",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description: "Private account (requires follow approval)",
      },
    },
    {
      name: "role",
      type: "select",
      defaultValue: "user",
      options: [
        { label: "User", value: "user" },
        { label: "Creator", value: "creator" },
        { label: "Moderator", value: "moderator" },
        { label: "Admin", value: "admin" },
      ],
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "followersCount",
      type: "number",
      defaultValue: 0,
      admin: {
        position: "sidebar",
        readOnly: true,
      },
    },
    {
      name: "followingCount",
      type: "number",
      defaultValue: 0,
      admin: {
        position: "sidebar",
        readOnly: true,
      },
    },
    {
      name: "postsCount",
      type: "number",
      defaultValue: 0,
      admin: {
        position: "sidebar",
        readOnly: true,
      },
    },
    {
      name: "pushToken",
      type: "text",
      required: false,
      admin: {
        position: "sidebar",
        description: "Expo push notification token",
      },
    },
    {
      name: "following",
      type: "array",
      required: false,
      admin: {
        position: "sidebar",
        description: "Array of user IDs that this user follows (managed via API)",
        hidden: true, // Hide from admin UI, managed via API
      },
      fields: [
        {
          name: "user",
          type: "text",
          required: false,
        },
      ],
      hooks: {
        beforeChange: [
          ({ data }) => {
            // Accept array of user IDs directly (strings)
            // Payload stores array fields as array of objects with the field name
            if (Array.isArray(data)) {
              // If it's already an array of strings, convert to array of objects
              if (data.length > 0 && typeof data[0] === "string") {
                return data.map((id) => ({ user: String(id) }));
              }
              // If it's array of objects, ensure user field is string
              return data.map((item: any) => {
                if (typeof item === "string") return { user: item };
                if (item?.user) return { user: String(item.user) };
                return { user: String(item) };
              });
            }
            return [];
          },
        ],
      },
    },
  ],
  timestamps: true,
};

export default Users;
