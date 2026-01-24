/**
 * Payload CMS Event Reviews Collection
 *
 * User ratings and reviews for events
 */

import type { CollectionConfig } from "payload";

export const EventReviews: CollectionConfig = {
  slug: "event-reviews",
  admin: {
    useAsTitle: "id",
    defaultColumns: ["event", "user", "rating", "comment", "createdAt"],
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
      name: "event",
      type: "relationship",
      relationTo: "events",
      required: true,
      index: true,
      admin: {
        description: "Event being reviewed",
      },
    },
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
      admin: {
        description: "User who wrote the review",
      },
    },
    {
      name: "rating",
      type: "number",
      required: true,
      min: 1,
      max: 5,
      admin: {
        description: "Rating from 1 to 5 stars",
      },
    },
    {
      name: "comment",
      type: "textarea",
      required: false,
      maxLength: 1000,
      admin: {
        description: "Review comment (optional)",
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, req }) => {
        // Auto-set user to current user on create if not provided
        if (req.user && !data.user) {
          data.user = req.user.id;
        }
        return data;
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        // Update event's average rating when review is created/updated/deleted
        if (operation === "create" || operation === "update" || operation === "delete") {
          try {
            const eventId = typeof doc.event === "string" ? doc.event : doc.event.id;
            
            // Get all reviews for this event
            const reviews = await req.payload.find({
              collection: "event-reviews",
              where: {
                event: { equals: eventId },
              },
              limit: 1000,
            });

            // Calculate average rating
            if (reviews.docs && reviews.docs.length > 0) {
              const totalRating = reviews.docs.reduce((sum, review) => sum + (review.rating || 0), 0);
              const averageRating = totalRating / reviews.docs.length;
              const totalReviews = reviews.docs.length;

              // Update event with average rating and review count
              await req.payload.update({
                collection: "events",
                id: eventId,
                data: {
                  averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
                  totalReviews: totalReviews,
                },
              });
            } else {
              // No reviews, reset to 0
              await req.payload.update({
                collection: "events",
                id: eventId,
                data: {
                  averageRating: 0,
                  totalReviews: 0,
                },
              });
            }
          } catch (error) {
            console.error("[EventReviews] Error updating event rating:", error);
          }
        }
      },
    ],
  },
  timestamps: true,
};

export default EventReviews;
