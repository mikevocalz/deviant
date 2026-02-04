/**
 * Edit Event Screen
 *
 * Allows organizers to edit event details including:
 * - Title, description, date/time, location
 * - Cover image and gallery images
 *
 * Route: /(protected)/events/[id]/edit
 */

import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Check,
  Calendar,
  Clock,
  Image as ImageIcon,
  MapPin,
  X,
  Plus,
} from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useColorScheme, useMediaPicker } from "@/lib/hooks";
import { useUIStore } from "@/lib/stores/ui-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useMediaUpload } from "@/lib/hooks/use-media-upload";
import { eventsApi } from "@/lib/api/events";
import { useQueryClient } from "@tanstack/react-query";
import {
  LocationAutocomplete,
  type LocationData,
} from "@/components/ui/location-autocomplete";

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useColorScheme();
  const queryClient = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);
  const currentUser = useAuthStore((state) => state.user);
  const { pickFromLibrary, requestPermissions } = useMediaPicker();
  const { uploadMultiple, isUploading } = useMediaUpload({ folder: "events" });

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [eventImages, setEventImages] = useState<string[]>([]);
  const [eventDate, setEventDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [originalData, setOriginalData] = useState<any>(null);

  useEffect(() => {
    requestPermissions();
  }, [requestPermissions]);

  // Fetch event data
  useEffect(() => {
    async function fetchEvent() {
      if (!id) return;

      try {
        const event = await eventsApi.getEventById(id);
        if (!event) {
          showToast("error", "Error", "Event not found");
          router.back();
          return;
        }

        // Check ownership
        const hostId =
          typeof event.host === "object" ? (event.host as any).id : event.host;
        const isEventOwner = !!(
          currentUser?.id && String(hostId) === String(currentUser.id)
        );
        setIsOwner(isEventOwner);

        if (!isEventOwner) {
          showToast("error", "Error", "You can only edit your own events");
          router.back();
          return;
        }

        // Populate form
        setTitle((event as any).title || "");
        setDescription((event as any).description || "");
        setLocation((event as any).location || "");

        if ((event as any).latitude && (event as any).longitude) {
          setLocationData({
            name: (event as any).location || "",
            latitude: (event as any).latitude,
            longitude: (event as any).longitude,
            placeId: "",
          });
        }

        // Parse images
        const images: string[] = [];
        if ((event as any).coverImage) {
          const coverUrl =
            typeof (event as any).coverImage === "object"
              ? (event as any).coverImage.url
              : (event as any).coverImage;
          if (coverUrl) images.push(coverUrl);
        }
        if ((event as any).images && Array.isArray((event as any).images)) {
          (event as any).images.forEach((img: any) => {
            const url = typeof img === "object" ? img.url : img;
            if (url && !images.includes(url)) images.push(url);
          });
        }
        setEventImages(images);

        // Parse date
        if ((event as any).startDate) {
          setEventDate(new Date((event as any).startDate));
        }

        setOriginalData(event);
        setIsLoading(false);
      } catch (error: any) {
        console.error("[EditEvent] Fetch error:", error);
        showToast("error", "Error", error?.message || "Failed to load event");
        router.back();
      }
    }

    fetchEvent();
  }, [id, currentUser?.id, showToast, router]);

  // Track changes
  useEffect(() => {
    if (!originalData) return;

    const changed =
      title !== ((originalData as any).title || "") ||
      description !== ((originalData as any).description || "") ||
      location !== ((originalData as any).location || "") ||
      eventDate.toISOString() !==
        new Date((originalData as any).startDate || Date.now()).toISOString();

    setHasChanges(changed);
  }, [title, description, location, eventDate, originalData]);

  const handlePickImages = async () => {
    const remaining = 4 - eventImages.length;
    if (remaining <= 0) return;

    const result = await pickFromLibrary({
      maxSelection: remaining,
      allowsMultipleSelection: remaining > 1,
    });
    if (result && result.length > 0) {
      setEventImages((prev) =>
        [...prev, ...result.map((r) => r.uri)].slice(0, 4),
      );
      setHasChanges(true);
    }
  };

  const removeImage = (index: number) => {
    setEventImages((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleDateChange = (_event: unknown, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(eventDate);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      setEventDate(newDate);
    }
  };

  const handleTimeChange = (_event: unknown, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(eventDate);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setEventDate(newDate);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleSave = useCallback(async () => {
    if (!id || isSaving) return;

    if (!title.trim()) {
      showToast("error", "Error", "Title is required");
      return;
    }

    setIsSaving(true);
    try {
      // Upload new images if any are local URIs
      const uploadedImages: string[] = [];
      const localImages = eventImages.filter(
        (uri) => uri.startsWith("file://") || uri.startsWith("content://"),
      );
      const remoteImages = eventImages.filter(
        (uri) => uri.startsWith("http://") || uri.startsWith("https://"),
      );

      if (localImages.length > 0) {
        // Convert string URIs to MediaFile format
        const mediaFiles = localImages.map((uri) => ({
          uri,
          type: "image" as const,
        }));
        const uploadResults = await uploadMultiple(mediaFiles);
        const successfulUploads = uploadResults
          .filter((r) => r.success && r.url)
          .map((r) => r.url!);

        if (successfulUploads.length !== localImages.length) {
          showToast("warning", "Warning", "Some images failed to upload");
        }
        uploadedImages.push(...successfulUploads);
      }

      const allImages = [...remoteImages, ...uploadedImages];

      // Prepare update data
      const updateData: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        location: locationData?.name || location,
        startDate: eventDate.toISOString(),
      };

      if (locationData) {
        updateData.latitude = locationData.latitude;
        updateData.longitude = locationData.longitude;
      }

      if (allImages.length > 0) {
        updateData.coverImage = allImages[0];
        updateData.images = allImages.slice(1).map((url) => ({ url }));
      }

      // PATCH /api/events/:id
      await eventsApi.updateEvent(id, updateData);

      // Invalidate caches
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["event", id] });

      showToast("success", "Saved", "Event updated successfully");
      router.back();
    } catch (error: any) {
      console.error("[EditEvent] Save error:", error);
      showToast("error", "Error", error?.message || "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  }, [
    id,
    title,
    description,
    location,
    locationData,
    eventDate,
    eventImages,
    isSaving,
    uploadMultiple,
    queryClient,
    showToast,
    router,
  ]);

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color={colors.foreground} />
        </Pressable>
        <Text className="text-lg font-semibold text-foreground">
          Edit Event
        </Text>
        <Pressable
          onPress={handleSave}
          disabled={!hasChanges || isSaving || isUploading}
          hitSlop={12}
          style={{ opacity: hasChanges && !isSaving && !isUploading ? 1 : 0.5 }}
        >
          {isSaving || isUploading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Check
              size={24}
              color={hasChanges ? colors.primary : colors.mutedForeground}
            />
          )}
        </Pressable>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Images */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-foreground mb-2">
            Event Images
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-3">
              {eventImages.map((uri, index) => (
                <View key={`img-${index}`} className="relative">
                  <Image
                    source={{ uri }}
                    style={{ width: 100, height: 100, borderRadius: 12 }}
                    contentFit="cover"
                  />
                  <Pressable
                    onPress={() => removeImage(index)}
                    className="absolute -top-2 -right-2 bg-destructive rounded-full p-1"
                  >
                    <X size={14} color="#fff" />
                  </Pressable>
                  {index === 0 && (
                    <View className="absolute bottom-1 left-1 bg-black/60 px-2 py-0.5 rounded">
                      <Text className="text-white text-xs">Cover</Text>
                    </View>
                  )}
                </View>
              ))}
              {eventImages.length < 4 && (
                <Pressable
                  onPress={handlePickImages}
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderStyle: "dashed",
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Plus size={24} color={colors.mutedForeground} />
                  <Text className="text-xs text-muted-foreground mt-1">
                    Add
                  </Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </View>

        {/* Title */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-foreground mb-2">
            Title *
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Event title"
            placeholderTextColor={colors.mutedForeground}
            maxLength={100}
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 16,
              color: colors.foreground,
              fontSize: 16,
            }}
          />
        </View>

        {/* Description */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-foreground mb-2">
            Description
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your event..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={2000}
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 16,
              color: colors.foreground,
              fontSize: 16,
              minHeight: 120,
              textAlignVertical: "top",
            }}
          />
        </View>

        {/* Location */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-foreground mb-2">
            Location
          </Text>
          <LocationAutocomplete
            value={location}
            placeholder="Search location..."
            onLocationSelect={(data) => {
              setLocation(data.name);
              setLocationData(data);
            }}
            onClear={() => {
              setLocation("");
              setLocationData(null);
            }}
          />
        </View>

        {/* Date & Time */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-foreground mb-2">
            Date & Time
          </Text>
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
                gap: 8,
              }}
            >
              <Calendar size={20} color={colors.mutedForeground} />
              <Text style={{ color: colors.foreground }}>
                {formatDate(eventDate)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowTimePicker(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
                gap: 8,
              }}
            >
              <Clock size={20} color={colors.mutedForeground} />
              <Text style={{ color: colors.foreground }}>
                {formatTime(eventDate)}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Date/Time Pickers */}
        {showDatePicker && (
          <DateTimePicker
            value={eventDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}
        {showTimePicker && (
          <DateTimePicker
            value={eventDate}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleTimeChange}
          />
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
