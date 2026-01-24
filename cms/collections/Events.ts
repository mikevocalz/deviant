/**
 * Payload CMS Events Collection
 *
 * Event listings with date, location, pricing, and attendance
 */

import type { CollectionConfig } from "payload";

export const Events: CollectionConfig = {
  slug: "events",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "date", "location", "category", "createdAt"],
    group: "Content",
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      maxLength: 200,
      admin: {
        description: "Event title (max 200 characters)",
      },
    },
    {
      name: "description",
      type: "textarea",
      required: false,
      maxLength: 2000,
      admin: {
        description: "Event description (max 2000 characters)",
      },
    },
    {
      name: "date",
      type: "date",
      required: false,
      admin: {
        description: "Event date and time (ISO string)",
      },
    },
    {
      name: "time",
      type: "text",
      required: false,
      admin: {
        description: "Event time (e.g., '7:00 PM')",
      },
    },
    {
      name: "location",
      type: "text",
      required: false,
      admin: {
        description: 'Event location (e.g., "New York, NY")',
      },
    },
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
    {
      name: "price",
      type: "number",
      required: false,
      defaultValue: 0,
      admin: {
        description: "Ticket price (0 for free events)",
      },
    },
    {
      name: "image",
      type: "text",
      required: false,
      admin: {
        description: "Main event image URL (Bunny CDN) - displayed as primary image",
      },
    },
    {
      name: "images",
      type: "array",
      required: false,
      minRows: 0,
      maxRows: 10,
      admin: {
        description: "Additional event images (gallery)",
      },
      fields: [
        {
          name: "type",
          type: "select",
          required: true,
          defaultValue: "image",
          options: [
            { label: "Image", value: "image" },
          ],
        },
        {
          name: "url",
          type: "text",
          required: true,
          admin: {
            description: "CDN URL for the image (Bunny.net)",
          },
        },
      ],
    },
    {
      name: "category",
      type: "select",
      required: false,
      defaultValue: "Event",
      options: [
        { label: "Music", value: "music" },
        { label: "Tech", value: "tech" },
        { label: "Networking", value: "networking" },
        { label: "Food", value: "food" },
        { label: "Art", value: "art" },
        { label: "Sports", value: "sports" },
        { label: "Nightlife", value: "nightlife" },
        { label: "Wellness", value: "wellness" },
        { label: "Education", value: "education" },
        { label: "Charity", value: "charity" },
        { label: "Event", value: "Event" },
      ],
      admin: {
        description: "Event category",
      },
    },
    {
      name: "maxAttendees",
      type: "number",
      required: false,
      admin: {
        description: "Maximum number of attendees (optional)",
      },
    },
    {
      name: "attendees",
      type: "array",
      required: false,
      admin: {
        description: "List of attendees",
      },
      fields: [
        {
          name: "id",
          type: "text",
          required: false,
        },
        {
          name: "name",
          type: "text",
          required: false,
        },
        {
          name: "image",
          type: "text",
          required: false,
        },
        {
          name: "initials",
          type: "text",
          required: false,
        },
      ],
    },
    {
      name: "totalAttendees",
      type: "number",
      defaultValue: 0,
      admin: {
        position: "sidebar",
        readOnly: true,
        description: "Total number of attendees",
      },
    },
    {
      name: "likes",
      type: "number",
      defaultValue: 0,
      admin: {
        position: "sidebar",
        readOnly: true,
        description: "Number of likes",
      },
    },
    {
      name: "host",
      type: "relationship",
      relationTo: "users",
      required: false,
      admin: {
        position: "sidebar",
        description: "Event organizer/host (can scan/check-in tickets)",
      },
    },
    {
      name: "coOrganizer",
      type: "relationship",
      relationTo: "users",
      required: false,
      admin: {
        position: "sidebar",
        description: "Co-organizer (can also scan/check-in tickets)",
      },
    },
    {
      name: "averageRating",
      type: "number",
      defaultValue: 0,
      admin: {
        position: "sidebar",
        readOnly: true,
        description: "Average rating (1-5 stars)",
      },
    },
    {
      name: "totalReviews",
      type: "number",
      defaultValue: 0,
      admin: {
        position: "sidebar",
        readOnly: true,
        description: "Total number of reviews",
      },
    },
  ],
  timestamps: true,
};

export default Events;
