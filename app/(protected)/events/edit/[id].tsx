import {
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useUIStore } from "@/lib/stores/ui-store";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  LocationAutocompleteInstagram,
  type LocationData,
} from "@/components/ui/location-autocomplete-instagram";
import { ErrorBoundary } from "@/components/error-boundary";
import { DvntMap } from "@/src/components/map";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Loader2, Calendar, Clock } from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import { useState, useEffect } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { deleteEvent as deleteEventPrivileged } from "@/lib/api/privileged";

function EditEventScreenContent() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = id ? String(id) : "";

  const [event, setEvent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationData, setLocationData] = useState<LocationData | null>(null);
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
      const { eventsApi } = await import("@/lib/api/events");
      const eventData = await eventsApi.getEventById(eventId);
      if (!eventData) throw new Error("Event not found");

      setEvent(eventData);
      setTitle(eventData.title || "");
      setDescription(eventData.description || "");
      setLocationData(eventData.location ? { name: eventData.location } : null);
      setEventDate(
        eventData.fullDate ? new Date(eventData.fullDate) : new Date(),
      );
      setTicketPrice(eventData.price ? String(eventData.price) : "");
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
      const { eventsApi } = await import("@/lib/api/events");
      await eventsApi.updateEvent(eventId, {
        title,
        description,
        location: locationData?.name || undefined,
        startDate: eventDate.toISOString(),
        price: ticketPrice ? parseFloat(ticketPrice) : undefined,
        maxAttendees: maxAttendees ? parseInt(maxAttendees, 10) : undefined,
      });

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
              await deleteEventPrivileged(parseInt(eventId));
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
        <Pressable
          onPress={() => router.back()}
          hitSlop={16}
          style={{ padding: 8, margin: -8, marginRight: 8 }}
        >
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

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        bottomOffset={40}
        keyboardDismissMode="on-drag"
      >
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
          <View style={{ zIndex: 1000, position: "relative" }}>
            <LocationAutocompleteInstagram
              value={locationData?.name || ""}
              placeholder="Enter event location"
              onLocationSelect={(data: LocationData) => {
                console.log("[EditEvent] Location selected:", data);
                setLocationData(data);
              }}
              onClear={() => {
                console.log("[EditEvent] Location cleared");
                setLocationData(null);
              }}
              onTextChange={(text) => {
                console.log("[EditEvent] Location text changed:", text);
                // Update location name for form validation
                if (!text) {
                  setLocationData(null);
                }
              }}
            />
          </View>

          {/* Map Preview - matches create flow UX */}
          {locationData?.latitude && locationData?.longitude && (
            <View
              className="mt-3 rounded-2xl overflow-hidden"
              style={{ height: 180 }}
            >
              <DvntMap
                center={[locationData.longitude, locationData.latitude]}
                zoom={15}
                markers={[
                  {
                    id: "event-location",
                    coordinate: [locationData.longitude, locationData.latitude],
                  },
                ]}
                showControls={false}
              />
            </View>
          )}
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
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

export default function EditEventScreen() {
  const router = useRouter();
  return (
    <ErrorBoundary screenName="EditEvent" onGoBack={() => router.back()}>
      <EditEventScreenContent />
    </ErrorBoundary>
  );
}
