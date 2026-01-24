/**
 * Payload CMS Tickets Collection
 *
 * Event tickets with QR codes for check-in
 */

import type { CollectionConfig } from "payload";

export const Tickets: CollectionConfig = {
  slug: "tickets",
  admin: {
    useAsTitle: "id",
    defaultColumns: ["id", "event", "user", "status", "checkedInAt", "createdAt"],
    group: "Content",
  },
  access: {
    read: ({ req: { user } }) => {
      // Users can read their own tickets
      // Organizers can read tickets for their events
      return Boolean(user);
    },
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: "id",
      type: "text",
      required: true,
      unique: true,
      admin: {
        description: "Unique ticket ID (e.g., tkt_2025011300001)",
      },
    },
    {
      name: "event",
      type: "relationship",
      relationTo: "events",
      required: true,
      admin: {
        description: "Event this ticket is for",
      },
    },
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: true,
      admin: {
        description: "User who owns this ticket",
      },
    },
    {
      name: "paid",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description: "Whether the ticket has been paid for",
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "valid",
      options: [
        { label: "Valid", value: "valid" },
        { label: "Checked In", value: "checked_in" },
        { label: "Revoked", value: "revoked" },
      ],
      admin: {
        description: "Ticket status",
      },
    },
    {
      name: "checkedInAt",
      type: "date",
      required: false,
      admin: {
        description: "When the ticket was checked in",
      },
    },
    {
      name: "qrToken",
      type: "text",
      required: true,
      unique: true,
      admin: {
        description: "QR code token (base64 encoded ticket data)",
        readOnly: true,
      },
    },
    {
      name: "checkedInBy",
      type: "relationship",
      relationTo: "users",
      required: false,
      admin: {
        description: "User who checked in this ticket (organizer)",
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        // Auto-generate qrToken if not provided
        if (operation === "create" && !data.qrToken && data.id && data.event) {
          const eventId = typeof data.event === "string" ? data.event : data.event.id;
          const tokenData = {
            tid: data.id,
            eid: eventId,
          };
          // Base64 encode the token
          data.qrToken = Buffer.from(JSON.stringify(tokenData)).toString("base64");
        }

        // Auto-set user to current user on create if not provided
        if (operation === "create" && req.user && !data.user) {
          data.user = req.user.id;
        }

        // Set checkedInAt when status changes to checked_in
        if (data.status === "checked_in" && !data.checkedInAt) {
          data.checkedInAt = new Date().toISOString();
        }

        return data;
      },
    ],
  },
  timestamps: true,
};

export default Tickets;
