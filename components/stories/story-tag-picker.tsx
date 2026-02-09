import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  Platform,
  ActivityIndicator,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { LegendList } from "@/components/list";
import { Image } from "expo-image";
import { X, Search, UserPlus, Check } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { storyTagsApi } from "@/lib/api/stories";
import * as Haptics from "expo-haptics";

export interface TaggedUser {
  id: number;
  username: string;
  avatar: string;
}

interface StoryTagPickerProps {
  visible: boolean;
  onClose: () => void;
  selectedUsers: TaggedUser[];
  onUsersChanged: (users: TaggedUser[]) => void;
}

export function StoryTagPicker({
  visible,
  onClose,
  selectedUsers,
  onUsersChanged,
}: StoryTagPickerProps) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TaggedUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.length < 1) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const users = await storyTagsApi.searchUsers(text, 15);
        setResults(users);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const isSelected = useCallback(
    (userId: number) => selectedUsers.some((u) => u.id === userId),
    [selectedUsers],
  );

  const toggleUser = useCallback(
    (user: TaggedUser) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (isSelected(user.id)) {
        onUsersChanged(selectedUsers.filter((u) => u.id !== user.id));
      } else {
        onUsersChanged([...selectedUsers, user]);
      }
    },
    [selectedUsers, onUsersChanged, isSelected],
  );

  const handleDone = useCallback(() => {
    setQuery("");
    setResults([]);
    onClose();
  }, [onClose]);

  const renderUser = useCallback(
    ({ item }: { item: TaggedUser }) => {
      const selected = isSelected(item.id);
      return (
        <Pressable
          onPress={() => toggleUser(item)}
          style={[s.userRow, selected && s.userRowSelected]}
        >
          <Image
            source={{
              uri:
                item.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(item.username)}&background=1a1a1a&color=fff`,
            }}
            style={s.avatar}
          />
          <Text style={s.username}>@{item.username}</Text>
          {selected ? (
            <View style={s.checkBadge}>
              <Check size={14} color="#000" strokeWidth={3} />
            </View>
          ) : (
            <UserPlus size={18} color="rgba(255,255,255,0.4)" />
          )}
        </Pressable>
      );
    },
    [isSelected, toggleUser],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleDone}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[s.container, { paddingTop: insets.top || 16 }]}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Tag People</Text>
          <Pressable onPress={handleDone} style={s.doneButton}>
            <Text style={s.doneText}>Done</Text>
          </Pressable>
        </View>

        {/* Search */}
        <View style={s.searchContainer}>
          <Search size={18} color="rgba(255,255,255,0.4)" />
          <TextInput
            style={s.searchInput}
            placeholder="Search users..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={query}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => {
                setQuery("");
                setResults([]);
              }}
            >
              <X size={18} color="rgba(255,255,255,0.4)" />
            </Pressable>
          )}
        </View>

        {/* Selected tags */}
        {selectedUsers.length > 0 && (
          <View style={s.selectedSection}>
            <Text style={s.selectedLabel}>Tagged ({selectedUsers.length})</Text>
            <View style={s.chipRow}>
              {selectedUsers.map((user) => (
                <Pressable
                  key={user.id}
                  onPress={() => toggleUser(user)}
                  style={s.chip}
                >
                  <Text style={s.chipText}>@{user.username}</Text>
                  <X size={12} color="#fff" />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Results */}
        {isSearching ? (
          <View style={s.centered}>
            <ActivityIndicator color="rgb(62, 164, 229)" />
          </View>
        ) : results.length > 0 ? (
          <LegendList
            data={results}
            renderItem={renderUser}
            keyExtractor={(item) => String(item.id)}
            style={s.list}
            keyboardShouldPersistTaps="handled"
            estimatedItemSize={64}
            recycleItems
          />
        ) : query.length > 0 ? (
          <View style={s.centered}>
            <Text style={s.emptyText}>No users found</Text>
          </View>
        ) : (
          <View style={s.centered}>
            <UserPlus size={40} color="rgba(255,255,255,0.2)" />
            <Text style={s.emptyText}>Search for people to tag</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgb(62, 164, 229)",
    borderRadius: 20,
  },
  doneText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    padding: 0,
  },
  selectedSection: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  selectedLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(62, 164, 229, 0.2)",
    borderColor: "rgba(62, 164, 229, 0.3)",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    color: "rgb(62, 164, 229)",
    fontSize: 13,
    fontWeight: "600",
  },
  list: {
    flex: 1,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  userRowSelected: {
    backgroundColor: "rgba(62, 164, 229, 0.08)",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1a1a1a",
  },
  username: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgb(62, 164, 229)",
    alignItems: "center",
    justifyContent: "center",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 14,
  },
});
