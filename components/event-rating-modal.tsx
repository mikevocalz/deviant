/**
 * Event Rating Modal Component
 *
 * Popup modal for rating an event with 5 stars and optional comment
 */

import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StarRating } from "react-native-star-rating-widget";
import { X } from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import { useUIStore } from "@/lib/stores/ui-store";
import { Motion } from "@legendapp/motion";

interface EventRatingModalProps {
  visible: boolean;
  onClose: () => void;
  eventId: string;
  onSubmit: (rating: number, comment?: string) => Promise<void>;
}

export function EventRatingModal({
  visible,
  onClose,
  eventId,
  onSubmit,
}: EventRatingModalProps) {
  const { colors } = useColorScheme();
  const showToast = useUIStore((s) => s.showToast);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      showToast("error", "Rating Required", "Please select a rating");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(rating, comment.trim() || undefined);
      showToast("success", "Thank You", "Your rating has been submitted");
      setRating(0);
      setComment("");
      onClose();
    } catch (error: any) {
      const errorMessage = error?.error || error?.message || "Failed to submit rating";
      showToast("error", "Error", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setRating(0);
      setComment("");
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ width: "100%", maxWidth: 400 }}
        >
          <Motion.View
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            style={{
              backgroundColor: colors.card,
              borderRadius: 24,
              margin: 20,
              maxHeight: "80%",
            }}
          >
            <SafeAreaView edges={["top"]}>
              {/* Header */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 20,
                  paddingTop: 16,
                  paddingBottom: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "600",
                    color: colors.foreground,
                  }}
                >
                  Rate This Event
                </Text>
                <Pressable onPress={handleClose} hitSlop={12} disabled={isSubmitting}>
                  <X size={24} color={colors.mutedForeground} />
                </Pressable>
              </View>

              <ScrollView
                style={{ maxHeight: 400 }}
                contentContainerStyle={{ padding: 20 }}
                keyboardShouldPersistTaps="handled"
              >
                {/* Rating Section */}
                <View style={{ alignItems: "center", marginBottom: 24 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "500",
                      color: colors.foreground,
                      marginBottom: 16,
                    }}
                  >
                    How was your experience?
                  </Text>
                  <StarRating
                    rating={rating}
                    onChange={setRating}
                    starSize={40}
                    color="#FFD700"
                    emptyColor="#E5E5E5"
                    enableHalfStar={false}
                    enableSwiping={true}
                  />
                </View>

                {/* Comment Section */}
                <View style={{ marginBottom: 24 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "500",
                      color: colors.foreground,
                      marginBottom: 8,
                    }}
                  >
                    Add a comment (optional)
                  </Text>
                  <TextInput
                    value={comment}
                    onChangeText={setComment}
                    placeholder="Share your thoughts about this event..."
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    numberOfLines={4}
                    maxLength={1000}
                    style={{
                      backgroundColor: colors.background,
                      borderRadius: 12,
                      padding: 12,
                      color: colors.foreground,
                      fontSize: 14,
                      minHeight: 100,
                      textAlignVertical: "top",
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                    editable={!isSubmitting}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.mutedForeground,
                      marginTop: 4,
                      textAlign: "right",
                    }}
                  >
                    {comment.length}/1000
                  </Text>
                </View>

                {/* Submit Button */}
                <Pressable
                  onPress={handleSubmit}
                  disabled={isSubmitting || rating === 0}
                  style={{
                    backgroundColor:
                      rating === 0 || isSubmitting
                        ? colors.muted
                        : colors.primary,
                    paddingVertical: 14,
                    borderRadius: 12,
                    alignItems: "center",
                    opacity: rating === 0 || isSubmitting ? 0.5 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: rating === 0 || isSubmitting ? colors.mutedForeground : "#fff",
                    }}
                  >
                    {isSubmitting ? "Submitting..." : "Submit Rating"}
                  </Text>
                </Pressable>
              </ScrollView>
            </SafeAreaView>
          </Motion.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
