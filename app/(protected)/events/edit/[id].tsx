import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { useUIStore } from "@/lib/stores/ui-store";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Loader2, Calendar, Clock } from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import { useState, useEffect } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { getAuthToken } from "@/lib/auth-client";

export default function EditEventScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = id ? String(id) : "";

  const [event, setEvent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [eventDate, setEventDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [ticketPrice, setTicketPrice] = useState("");
  const [maxAttendees, setMaxAttendees] = useState("");
  const showToast = useUIStore((s) => s.showToast);

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    if (!eventId) {
      setIsLoading(false);
      return;
    }

    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) throw new Error("API URL not configured");

      const token = await getAuthToken();
      const response = await fetch(`${apiUrl}/api/events/${eventId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error(`Failed to load event: ${response.status}`);
      }

      const data = await response.json();
      const eventData = data.doc || data;
      setEvent(eventData);

      setTitle(eventData.title || "");
      setDescription(eventData.description || "");
      setLocation(eventData.location || "");
      setEventDate(
        eventData.eventDate ? new Date(eventData.eventDate) : new Date(),
      );
      setTicketPrice(
        eventData.ticketPrice ? String(eventData.ticketPrice) : "",
      );
      setMaxAttendees(
        eventData.maxAttendees ? String(eventData.maxAttendees) : "",
      );
    } catch (error) {
      console.error("[EditEvent] Load error:", error);
      showToast("error", "Error", "Failed to load event");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!eventId || !title.trim()) {
      showToast("error", "Error", "Event title is required");
      return;
    }

    setIsSaving(true);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) throw new Error("API URL not configured");

      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(`${apiUrl}/api/events/${eventId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          location: location || undefined,
          eventDate: eventDate.toISOString(),
          ticketPrice: ticketPrice ? parseFloat(ticketPrice) : undefined,
          maxAttendees: maxAttendees ? parseInt(maxAttendees, 10) : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Update failed: ${response.status}`);
      }

      showToast("success", "Success", "Event updated successfully!");
      router.back();
    } catch (error) {
      console.error("[EditEvent] Save error:", error);
      showToast(
        "error",
        "Error",
        error instanceof Error ? error.message : "Failed to update event",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Event",
      "Are you sure you want to delete this event? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const apiUrl = process.env.EXPO_PUBLIC_API_URL;
              if (!apiUrl) throw new Error("API URL not configured");

              const token = await getAuthToken();
              if (!token) throw new Error("Not authenticated");

              const response = await fetch(`${apiUrl}/api/events/${eventId}`, {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });

              if (!response.ok) {
                throw new Error(`Delete failed: ${response.status}`);
              }

              showToast("success", "Success", "Event deleted successfully!");
              router.replace("/(protected)/(tabs)/events");
            } catch (error) {
              console.error("[EditEvent] Delete error:", error);
              showToast(
                "error",
                "Error",
                error instanceof Error
                  ? error.message
                  : "Failed to delete event",
              );
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <Loader2
            size={32}
            color={colors.foreground}
            className="animate-spin"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-muted-foreground">Event not found</Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-4 rounded-lg bg-primary px-4 py-2"
          >
            <Text className="font-semibold text-primary-foreground">
              Go Back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <View className="flex-row items-center justify-between border-b border-border bg-background px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-4">
          <ArrowLeft size={24} color={colors.foreground} />
        </Pressable>
        <Text className="flex-1 text-lg font-semibold text-foreground">
          Edit Event
        </Text>
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          className="rounded-lg bg-primary px-4 py-2"
        >
          {isSaving ? (
            <Loader2
              size={16}
              color={colors.primaryForeground}
              className="animate-spin"
            />
          ) : (
            <Text className="font-semibold text-primary-foreground">Save</Text>
          )}
        </Pressable>
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Title */}
        <View className="mb-4">
          <Text className="mb-2 text-sm font-medium text-foreground">
            Event Title *
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Enter event title"
            placeholderTextColor={colors.mutedForeground}
            className="rounded-lg border border-border bg-background px-4 py-3 text-foreground"
          />
        </View>

        {/* Description */}
        <View className="mb-4">
          <Text className="mb-2 text-sm font-medium text-foreground">
            Description
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your event..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            className="rounded-lg border border-border bg-background px-4 py-3 text-foreground"
          />
        </View>

        {/* Location */}
        <View className="mb-4">
          <Text className="mb-2 text-sm font-medium text-foreground">
            Location
          </Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Enter event location"
            placeholderTextColor={colors.mutedForeground}
            className="rounded-lg border border-border bg-background px-4 py-3 text-foreground"
          />
        </View>

        {/* Date */}
        <View className="mb-4">
          <Text className="mb-2 text-sm font-medium text-foreground">
            Date & Time
          </Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setShowDatePicker(true)}
              className="flex-1 flex-row items-center gap-2 rounded-lg border border-border bg-background px-4 py-3"
            >
              <Calendar size={16} color={colors.foreground} />
              <Text className="text-foreground">
                {eventDate.toLocaleDateString()}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowTimePicker(true)}
              className="flex-1 flex-row items-center gap-2 rounded-lg border border-border bg-background px-4 py-3"
            >
              <Clock size={16} color={colors.foreground} />
              <Text className="text-foreground">
                {eventDate.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </Pressable>
          </View>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={eventDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(event, selectedDate) => {
              setShowDatePicker(Platform.OS === "ios");
              if (selectedDate) {
                setEventDate(selectedDate);
              }
            }}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={eventDate}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(event, selectedDate) => {
              setShowTimePicker(Platform.OS === "ios");
              if (selectedDate) {
                setEventDate(selectedDate);
              }
            }}
          />
        )}

        {/* Ticket Price */}
        <View className="mb-4">
          <Text className="mb-2 text-sm font-medium text-foreground">
            Ticket Price ($)
          </Text>
          <TextInput
            value={ticketPrice}
            onChangeText={setTicketPrice}
            placeholder="0.00 (leave empty for free)"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
            className="rounded-lg border border-border bg-background px-4 py-3 text-foreground"
          />
        </View>

        {/* Max Attendees */}
        <View className="mb-6">
          <Text className="mb-2 text-sm font-medium text-foreground">
            Max Attendees
          </Text>
          <TextInput
            value={maxAttendees}
            onChangeText={setMaxAttendees}
            placeholder="Unlimited (leave empty)"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
            className="rounded-lg border border-border bg-background px-4 py-3 text-foreground"
          />
        </View>

        {/* Delete Button */}
        <Pressable
          onPress={handleDelete}
          className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3"
        >
          <Text className="text-center font-semibold text-destructive">
            Delete Event
          </Text>
        </Pressable>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
