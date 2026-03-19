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
  Switch,
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
  DollarSign,
  Users,
  Tag,
  Eye,
  Youtube,
  Shirt,
  DoorOpen,
  Music,
  Gift,
  ChevronDown,
} from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useColorScheme, useMediaPicker } from "@/lib/hooks";
import { useUIStore } from "@/lib/stores/ui-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useMediaUpload } from "@/lib/hooks/use-media-upload";
import { eventsApi } from "@/lib/api/events";
import { getCurrentUserAuthId } from "@/lib/api/auth-helper";
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
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  // V2 fields
  const [price, setPrice] = useState("");
  const [maxAttendees, setMaxAttendees] = useState("");
  const [category, setCategory] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [dressCode, setDressCode] = useState("");
  const [doorPolicy, setDoorPolicy] = useState("");
  const [lineup, setLineup] = useState("");
  const [perks, setPerks] = useState("");
  const [youtubeVideoUrl, setYoutubeVideoUrl] = useState("");
  const [ticketingEnabled, setTicketingEnabled] = useState(false);

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

        // Check ownership via server-side auth (host_id === auth_id)
        const canEdit = await eventsApi.canEditEvent(
          id,
          (await getCurrentUserAuthId()) || "",
        );
        setIsOwner(canEdit);

        if (!canEdit) {
          showToast("error", "Error", "You can only edit your own events");
          router.back();
          return;
        }

        // Populate form
        const ev = event as any;
        setTitle(ev.title || "");
        setDescription(ev.description || "");
        setLocation(ev.location || "");

        if (ev.locationLat && ev.locationLng) {
          setLocationData({
            name: ev.locationName || ev.location || "",
            latitude: ev.locationLat,
            longitude: ev.locationLng,
            placeId: "",
          });
        }

        // Parse images
        const images: string[] = [];
        const coverUrl = ev.image || ev.coverImage;
        if (coverUrl) {
          const url = typeof coverUrl === "object" ? coverUrl.url : coverUrl;
          if (url) images.push(url);
        }
        if (Array.isArray(ev.images)) {
          ev.images.forEach((img: any) => {
            const url = typeof img === "object" ? img.url : img;
            if (url && !images.includes(url)) images.push(url);
          });
        }
        setEventImages(images);

        // Parse dates
        const isoDate = ev.fullDate || ev.startDate || ev.date;
        if (isoDate) setEventDate(new Date(isoDate));
        if (ev.endDate) setEndDate(new Date(ev.endDate));

        // V2 fields
        setPrice(ev.price != null ? String(ev.price) : "");
        setMaxAttendees(ev.maxAttendees != null ? String(ev.maxAttendees) : "");
        setCategory(ev.category || "");
        setVisibility(ev.visibility || "public");
        setDressCode(ev.dressCode || "");
        setDoorPolicy(ev.doorPolicy || "");
        setLineup(ev.lineup || "");
        setPerks(
          Array.isArray(ev.perks) ? ev.perks.join(", ") : ev.perks || "",
        );
        setYoutubeVideoUrl(ev.youtubeVideoUrl || "");
        setTicketingEnabled(!!ev.ticketingEnabled);

        setOriginalData(ev);
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
    const od = originalData;
    const isoDate = od.fullDate || od.startDate || od.date;

    const changed =
      title !== (od.title || "") ||
      description !== (od.description || "") ||
      location !== (od.location || "") ||
      eventDate.toISOString() !==
        new Date(isoDate || Date.now()).toISOString() ||
      price !== (od.price != null ? String(od.price) : "") ||
      maxAttendees !==
        (od.maxAttendees != null ? String(od.maxAttendees) : "") ||
      category !== (od.category || "") ||
      visibility !== (od.visibility || "public") ||
      dressCode !== (od.dressCode || "") ||
      doorPolicy !== (od.doorPolicy || "") ||
      lineup !== (od.lineup || "") ||
      youtubeVideoUrl !== (od.youtubeVideoUrl || "") ||
      ticketingEnabled !== !!od.ticketingEnabled;

    setHasChanges(changed);
  }, [
    title,
    description,
    location,
    eventDate,
    endDate,
    price,
    maxAttendees,
    category,
    visibility,
    dressCode,
    doorPolicy,
    lineup,
    perks,
    youtubeVideoUrl,
    ticketingEnabled,
    originalData,
  ]);

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

  const handleEndDateChange = (_event: unknown, selectedDate?: Date) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      const base =
        endDate || new Date(eventDate.getTime() + 3 * 60 * 60 * 1000);
      base.setFullYear(selectedDate.getFullYear());
      base.setMonth(selectedDate.getMonth());
      base.setDate(selectedDate.getDate());
      setEndDate(new Date(base));
    }
  };

  const handleEndTimeChange = (_event: unknown, selectedTime?: Date) => {
    setShowEndTimePicker(false);
    if (selectedTime) {
      const base =
        endDate || new Date(eventDate.getTime() + 3 * 60 * 60 * 1000);
      base.setHours(selectedTime.getHours());
      base.setMinutes(selectedTime.getMinutes());
      setEndDate(new Date(base));
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
        endDate: endDate ? endDate.toISOString() : undefined,
        price: price ? parseFloat(price) : 0,
        maxAttendees: maxAttendees ? parseInt(maxAttendees) : undefined,
        category: category || undefined,
        visibility,
        dressCode: dressCode || undefined,
        doorPolicy: doorPolicy || undefined,
        lineup: lineup || undefined,
        perks: perks || undefined,
        youtubeVideoUrl: youtubeVideoUrl || undefined,
        ticketingEnabled,
      };

      if (locationData) {
        updateData.locationLat = locationData.latitude;
        updateData.locationLng = locationData.longitude;
        updateData.locationName = locationData.name;
      }

      if (allImages.length > 0) {
        updateData.coverImage = allImages[0];
        updateData.images = allImages.slice(1).map((url) => ({ url }));
      }

      await eventsApi.updateEvent(id, updateData);

      // Invalidate all event caches so lists + detail refresh
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["event-detail", id] });

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
    endDate,
    eventImages,
    price,
    maxAttendees,
    category,
    visibility,
    dressCode,
    doorPolicy,
    lineup,
    perks,
    youtubeVideoUrl,
    ticketingEnabled,
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

        {/* End Date & Time */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-foreground mb-2">
            End Date & Time
          </Text>
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setShowEndDatePicker(true)}
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
              <Text
                style={{
                  color: endDate ? colors.foreground : colors.mutedForeground,
                }}
              >
                {endDate ? formatDate(endDate) : "Set end date"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowEndTimePicker(true)}
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
              <Text
                style={{
                  color: endDate ? colors.foreground : colors.mutedForeground,
                }}
              >
                {endDate ? formatTime(endDate) : "--:--"}
              </Text>
            </Pressable>
          </View>
          {endDate && (
            <Pressable onPress={() => setEndDate(null)} className="mt-1">
              <Text className="text-xs text-destructive">Clear end date</Text>
            </Pressable>
          )}
        </View>

        {showEndDatePicker && (
          <DateTimePicker
            value={
              endDate || new Date(eventDate.getTime() + 3 * 60 * 60 * 1000)
            }
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleEndDateChange}
            minimumDate={eventDate}
          />
        )}
        {showEndTimePicker && (
          <DateTimePicker
            value={
              endDate || new Date(eventDate.getTime() + 3 * 60 * 60 * 1000)
            }
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleEndTimeChange}
          />
        )}

        {/* Price */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-foreground mb-2">
            Price
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.card,
              borderRadius: 12,
              paddingHorizontal: 16,
            }}
          >
            <DollarSign size={18} color={colors.mutedForeground} />
            <TextInput
              value={price}
              onChangeText={setPrice}
              placeholder="0 (free)"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              style={{
                flex: 1,
                padding: 16,
                color: colors.foreground,
                fontSize: 16,
              }}
            />
          </View>
        </View>

        {/* Capacity */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-foreground mb-2">
            Capacity
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.card,
              borderRadius: 12,
              paddingHorizontal: 16,
            }}
          >
            <Users size={18} color={colors.mutedForeground} />
            <TextInput
              value={maxAttendees}
              onChangeText={setMaxAttendees}
              placeholder="Max attendees"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              style={{
                flex: 1,
                padding: 16,
                color: colors.foreground,
                fontSize: 16,
              }}
            />
          </View>
        </View>

        {/* Category */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-foreground mb-2">
            Category
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.card,
              borderRadius: 12,
              paddingHorizontal: 16,
            }}
          >
            <Tag size={18} color={colors.mutedForeground} />
            <TextInput
              value={category}
              onChangeText={setCategory}
              placeholder="e.g. Music, Nightlife, Tech..."
              placeholderTextColor={colors.mutedForeground}
              maxLength={50}
              style={{
                flex: 1,
                padding: 16,
                color: colors.foreground,
                fontSize: 16,
              }}
            />
          </View>
        </View>

        {/* Visibility */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-foreground mb-2">
            Visibility
          </Text>
          <View className="flex-row gap-3">
            {(["public", "private", "unlisted"] as const).map((v) => (
              <Pressable
                key={v}
                onPress={() => setVisibility(v)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor:
                    visibility === v ? colors.primary : colors.card,
                }}
              >
                <Text
                  style={{
                    color: visibility === v ? "#fff" : colors.foreground,
                    fontSize: 13,
                    fontWeight: visibility === v ? "600" : "400",
                    textTransform: "capitalize",
                  }}
                >
                  {v}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Ticketing Toggle */}
        <View
          className="mb-4"
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colors.card,
            borderRadius: 12,
            padding: 16,
          }}
        >
          <Text style={{ color: colors.foreground, fontSize: 16 }}>
            Ticketing Enabled
          </Text>
          <Switch
            value={ticketingEnabled}
            onValueChange={setTicketingEnabled}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>

        {/* YouTube Video URL */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-foreground mb-2">
            YouTube Video URL
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.card,
              borderRadius: 12,
              paddingHorizontal: 16,
            }}
          >
            <Youtube size={18} color={colors.mutedForeground} />
            <TextInput
              value={youtubeVideoUrl}
              onChangeText={setYoutubeVideoUrl}
              placeholder="https://youtube.com/watch?v=..."
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                flex: 1,
                padding: 16,
                color: colors.foreground,
                fontSize: 16,
              }}
            />
          </View>
        </View>

        {/* Dress Code */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-foreground mb-2">
            Dress Code
          </Text>
          <TextInput
            value={dressCode}
            onChangeText={setDressCode}
            placeholder="e.g. Smart casual — No sneakers"
            placeholderTextColor={colors.mutedForeground}
            maxLength={200}
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 16,
              color: colors.foreground,
              fontSize: 16,
            }}
          />
        </View>

        {/* Door Policy */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-foreground mb-2">
            Door Policy
          </Text>
          <TextInput
            value={doorPolicy}
            onChangeText={setDoorPolicy}
            placeholder="e.g. 21+ with valid ID"
            placeholderTextColor={colors.mutedForeground}
            maxLength={200}
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 16,
              color: colors.foreground,
              fontSize: 16,
            }}
          />
        </View>

        {/* Lineup */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-foreground mb-2">
            Lineup / Performers
          </Text>
          <TextInput
            value={lineup}
            onChangeText={setLineup}
            placeholder="DJ sets, performers, speakers..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={1000}
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 16,
              color: colors.foreground,
              fontSize: 16,
              minHeight: 80,
              textAlignVertical: "top",
            }}
          />
        </View>

        {/* Perks */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-foreground mb-2">
            What's Included
          </Text>
          <TextInput
            value={perks}
            onChangeText={setPerks}
            placeholder="Complimentary drinks, VIP access..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={1000}
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 16,
              color: colors.foreground,
              fontSize: 16,
              minHeight: 80,
              textAlignVertical: "top",
            }}
          />
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
