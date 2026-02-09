import { View, Text, Pressable, Modal } from "react-native";
import {
  Edit,
  Trash2,
  Flag,
  X,
  Link,
  Share2,
  BookmarkPlus,
  ImagePlus,
} from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import { Motion } from "@legendapp/motion";

interface PostActionSheetProps {
  visible: boolean;
  onClose: () => void;
  isOwner: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onReport?: () => void;
  onShareToStory?: () => void;
}

export function PostActionSheet({
  visible,
  onClose,
  isOwner,
  onEdit,
  onDelete,
  onReport,
  onShareToStory,
}: PostActionSheetProps) {
  const { colors } = useColorScheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Motion.View
            initial={{ translateY: 400 }}
            animate={{ translateY: 0 }}
            exit={{ translateY: 400 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: 40,
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "600",
                  color: colors.foreground,
                }}
              >
                Post Options
              </Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <X size={24} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Actions */}
            <View style={{ paddingTop: 8 }}>
              {isOwner && (
                <>
                  <Pressable
                    onPress={() => {
                      onEdit();
                      onClose();
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 20,
                      paddingVertical: 16,
                    }}
                  >
                    <Edit size={22} color={colors.foreground} />
                    <Text
                      style={{
                        fontSize: 16,
                        color: colors.foreground,
                        marginLeft: 16,
                      }}
                    >
                      Edit Post
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      onDelete();
                      onClose();
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 20,
                      paddingVertical: 16,
                    }}
                  >
                    <Trash2 size={22} color="#ef4444" />
                    <Text
                      style={{
                        fontSize: 16,
                        color: "#ef4444",
                        marginLeft: 16,
                      }}
                    >
                      Delete Post
                    </Text>
                  </Pressable>
                </>
              )}

              {/* Common options for all users */}
              <Pressable
                onPress={() => {
                  // TODO: Implement copy link
                  onClose();
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                }}
              >
                <Link size={22} color={colors.foreground} />
                <Text
                  style={{
                    fontSize: 16,
                    color: colors.foreground,
                    marginLeft: 16,
                  }}
                >
                  Copy Link
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  // TODO: Implement share
                  onClose();
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                }}
              >
                <Share2 size={22} color={colors.foreground} />
                <Text
                  style={{
                    fontSize: 16,
                    color: colors.foreground,
                    marginLeft: 16,
                  }}
                >
                  Share
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  if (onShareToStory) onShareToStory();
                  onClose();
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                }}
              >
                <ImagePlus size={22} color={colors.foreground} />
                <Text
                  style={{
                    fontSize: 16,
                    color: colors.foreground,
                    marginLeft: 16,
                  }}
                >
                  Share to Story
                </Text>
              </Pressable>

              {!isOwner && (
                <Pressable
                  onPress={() => {
                    if (onReport) onReport();
                    onClose();
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 20,
                    paddingVertical: 16,
                  }}
                >
                  <Flag size={22} color="#ef4444" />
                  <Text
                    style={{
                      fontSize: 16,
                      color: "#ef4444",
                      marginLeft: 16,
                    }}
                  >
                    Report Post
                  </Text>
                </Pressable>
              )}
            </View>
          </Motion.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
