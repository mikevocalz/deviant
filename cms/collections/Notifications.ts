/**
 * Payload CMS Notifications Collection
 *
 * Stores notifications for users (mentions, likes, comments, follows)
 * Works with payload-realtime for live updates to the Expo app
 *
 * @see https://payloadcms.com/docs/configuration/collections
 */

import type { CollectionConfig } from "payload";

export const Notifications: CollectionConfig = {
  slug: "notifications",
  admin: {
    useAsTitle: "type",
    defaultColumns: ["recipient", "type", "sender", "isRead", "createdAt"],
    group: "Engagement",
  },
  access: {
    // Users can only read their own notifications
    read: ({ req: { user } }) => {
      if (!user) return false;
      return {
        recipient: {
          equals: user.id,
        },
      };
    },
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => {
      if (!user) return false;
      return {
        recipient: {
          equals: user.id,
        },
      };
    },
    delete: ({ req: { user } }) => {
      if (!user) return false;
      return {
        recipient: {
          equals: user.id,
        },
      };
    },
  },
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        // Send push notification for new notifications
        if (operation === "create" && doc.recipient) {
          try {
            // Get recipient's push token
            const recipient = await req.payload.findByID({
              collection: "users",
              id: typeof doc.recipient === "string" ? doc.recipient : doc.recipient.id,
              depth: 0,
            });

            if (recipient?.pushToken) {
              // Get sender info for notification text
              let senderName = "Someone";
              if (doc.sender) {
                const sender = await req.payload.findByID({
                  collection: "users",
                  id: typeof doc.sender === "string" ? doc.sender : doc.sender.id,
                  depth: 0,
                });
                senderName = sender?.username || sender?.name || "Someone";
              }

              // Build notification message based on type
              let title = "New Activity";
              let body = "";
              
              switch (doc.type) {
                case "mention":
                  title = "You were mentioned";
                  body = `${senderName} mentioned you in a post`;
                  break;
                case "like":
                  title = "New Like";
                  body = `${senderName} liked your post`;
                  break;
                case "comment":
                  title = "New Comment";
                  body = `${senderName} commented on your post`;
                  break;
                case "follow":
                  title = "New Follower";
                  body = `${senderName} started following you`;
                  break;
                default:
                  body = doc.content || "You have a new notification";
              }

              // Call the send-notification endpoint
              const notificationUrl = process.env.EXPO_PUBLIC_API_URL 
                ? `${process.env.EXPO_PUBLIC_API_URL}/api/send-notification`
                : null;

              if (notificationUrl && recipient.pushToken) {
                await fetch(notificationUrl, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${process.env.INTERNAL_API_KEY || ""}`,
                  },
                  body: JSON.stringify({
                    tokens: recipient.pushToken,
                    title,
                    body,
                    data: {
                      type: doc.type,
                      notificationId: doc.id,
                      postId: doc.post,
                      senderId: doc.sender,
                    },
                  }),
                });
              }
            }
          } catch (error) {
            console.error("[Notifications] Error sending push notification:", error);
          }
        }
        return doc;
      },
    ],
  },
  fields: [
    // Notification type
    {
      name: "type",
      type: "select",
      required: true,
      options: [
        { label: "Mention", value: "mention" },
        { label: "Like", value: "like" },
        { label: "Comment", value: "comment" },
        { label: "Follow", value: "follow" },
      ],
      admin: {
        position: "sidebar",
      },
    },

    // Recipient (who receives the notification)
    {
      name: "recipient",
      type: "relationship",
      relationTo: "users",
      required: true,
      hasMany: false,
      index: true,
      admin: {
        description: "User who will receive this notification",
      },
    },

    // Sender (who triggered the notification)
    {
      name: "sender",
      type: "relationship",
      relationTo: "users",
      required: false,
      hasMany: false,
      admin: {
        description: "User who triggered the notification (optional)",
      },
    },

    // Related post (for likes, comments, mentions)
    {
      name: "post",
      type: "relationship",
      relationTo: "posts",
      required: false,
      hasMany: false,
      admin: {
        description: "Related post (for likes, comments, mentions)",
      },
    },

    // Content preview
    {
      name: "content",
      type: "text",
      required: false,
      maxLength: 200,
      admin: {
        description: "Preview text (comment text, mention context, etc.)",
      },
    },

    // Read status
    {
      name: "isRead",
      type: "checkbox",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description: "Has the user seen this notification?",
      },
    },
  ],
  timestamps: true,
};

export default Notifications;
