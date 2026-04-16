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
import { ErrorBoundary } from "@/components/error-boundary";
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
  Video,
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
import { eventKeys } from "@/lib/hooks/use-events";
import {
  LocationAutocompleteInstagram,
  type LocationData,
} from "@/components/ui/location-autocomplete-instagram";
import {
  isRemoteMediaUri,
  persistLocalMediaSelection,
} from "@/lib/media/persist-local-selection";
import { ticketTypesApi } from "@/lib/api/ticket-types";

const TIER_LEVELS = ["free", "ga", "vip", "table"] as const;
type TierLevel = (typeof TIER_LEVELS)[number];

interface LocalTicketTier {
  id?: string; // undefined = new (not yet saved)
  name: string;
  priceDollars: string; // user types dollars, we convert to cents
  quantity: string;
  maxPerOrder: string;
  tier: TierLevel;
  description: string;
  isActive: boolean;
}

function EditEventScreenContent() {
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
  const [ticketTiers, setTicketTiers] = useState<LocalTicketTier[]>([]);
  const [originalTierIds, setOriginalTierIds] = useState<Set<string>>(new Set());

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [originalData, setOriginalData] = useState<any>(null);

  useEffect(() => {
    requestPermissions();
  }, [requestPermissions]);

  const persistEventDraftAssets = useCallback(
    async (
      assets: Array<{
        uri: string;
        fileName?: string;
        mimeType?: string;
      }>,
    ) =>
      Promise.all(
        assets.map((asset) =>
          persistLocalMediaSelection(asset.uri, {
            scope: "event-drafts/images",
            fileName: asset.fileName,
            mimeType: asset.mimeType,
          }),
        ),
      ),
    [],
  );

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

        // Load ticket tiers
        const dbTiers = await ticketTypesApi.getByEvent(id);
        const activeTiers = dbTiers.filter((t: any) => t.active !== false && t.is_active !== false);
        setOriginalTierIds(new Set(activeTiers.map((t: any) => t.id)));
        setTicketTiers(
          activeTiers.map((t: any) => ({
            id: t.id,
            name: t.name || "",
            priceDollars: t.price_cents != null ? String(t.price_cents / 100) : "0",
            quantity: t.quantity_total != null ? String(t.quantity_total) : "100",
            maxPerOrder: t.max_per_user != null ? String(t.max_per_user) : "4",
            tier: (t.tier || "ga") as TierLevel,
            description: t.description || "",
            isActive: true,
          })),
        );

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
      try {
        const persistedUris = await persistEventDraftAssets(result);
        setEventImages((prev) => [...prev, ...persistedUris].slice(0, 4));
        setHasChanges(true);
      } catch (error) {
        console.error("[EditEvent] Failed to persist selected images:", error);
        showToast(
          "error",
          "Media Error",
          "Failed to add the selected images. Please try again.",
        );
      }
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
      const normalizedImages = await Promise.all(
        eventImages.map((uri) =>
          isRemoteMediaUri(uri)
            ? Promise.resolve(uri)
            : persistLocalMediaSelection(uri, { scope: "event-drafts/images" }),
        ),
      );
      setEventImages(normalizedImages);

      const localImages = normalizedImages.filter((uri) => !isRemoteMediaUri(uri));
      const remoteImages = normalizedImages.filter((uri) => isRemoteMediaUri(uri));

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
        youtubeVideoUrl: youtubeVideoUrl.trim() || null,
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

      // ── Optimistic update: patch cache + navigate back immediately ──
      const detailKey = ["events", "detail", id];
      const previousDetail = queryClient.getQueryData(detailKey);

      // Build optimistic patch matching EventDetail shape
      const optimisticPatch: Record<string, unknown> = {
        title: updateData.title,
        description: updateData.description,
        location: updateData.location,
        fullDate: updateData.startDate,
        endDate: updateData.endDate || null,
        price: updateData.price,
        maxAttendees: updateData.maxAttendees,
        category: updateData.category || null,
        visibility: updateData.visibility,
        dressCode: updateData.dressCode || null,
        doorPolicy: updateData.doorPolicy || null,
        lineup: updateData.lineup
          ? String(updateData.lineup)
              .split(",")
              .map((s: string) => s.trim())
          : null,
        perks: updateData.perks
          ? String(updateData.perks)
              .split(",")
              .map((s: string) => s.trim())
          : null,
        youtubeVideoUrl: updateData.youtubeVideoUrl || null,
        ticketingEnabled: updateData.ticketingEnabled,
      };
      if (updateData.locationLat != null) {
        optimisticPatch.locationLat = updateData.locationLat;
        optimisticPatch.locationLng = updateData.locationLng;
        optimisticPatch.locationName = updateData.locationName;
      }
      if (allImages.length > 0) {
        optimisticPatch.image = allImages[0];
        optimisticPatch.images = allImages.slice(1).map((url) => ({
          type: "image",
          url,
        }));
      }

      // Merge into cached detail
      queryClient.setQueryData(detailKey, (old: any) =>
        old ? { ...old, ...optimisticPatch } : old,
      );

      // Also patch any list caches that contain this event
      queryClient.setQueriesData<any[]>({ queryKey: ["events"] }, (old) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((e) =>
          String(e.id) === String(id) ? { ...e, ...optimisticPatch } : e,
        );
      });

      // Navigate back immediately — user sees updated data
      showToast("success", "Saved", "Event updated successfully");
      setIsSaving(false);
      router.back();

      // ── Background: persist ticket tiers ──
      const tierPromises = ticketTiers.map(async (tier) => {
        const priceCents = Math.round(parseFloat(tier.priceDollars || "0") * 100);
        const qty = parseInt(tier.quantity || "100");
        const maxPerUser = parseInt(tier.maxPerOrder || "4");

        if (!tier.id) {
          // New tier — create it
          await ticketTypesApi.create({
            eventId: id,
            name: tier.name || "General Admission",
            description: tier.description || undefined,
            priceCents,
            quantityTotal: qty,
            maxPerUser,
          });
        } else {
          // Existing tier — update it
          await ticketTypesApi.update(tier.id, {
            name: tier.name,
            description: tier.description || null,
            price_cents: priceCents,
            quantity_total: qty,
            max_per_user: maxPerUser,
          });
        }
      });

      // Deactivate removed tiers
      const currentIds = new Set(ticketTiers.filter((t) => t.id).map((t) => t.id!));
      const removedIds = [...originalTierIds].filter((id) => !currentIds.has(id));
      const deactivatePromises = removedIds.map((tid) => ticketTypesApi.deactivate(tid));

      Promise.all([...tierPromises, ...deactivatePromises]).catch((err) =>
        console.error("[EditEvent] Tier sync error:", err),
      );

      // ── Background: persist to server ──
      eventsApi.updateEvent(id, updateData).then(
        () => {
          // Refetch canonical data from server
          queryClient.invalidateQueries({ queryKey: eventKeys.detail(id) });
          queryClient.invalidateQueries({ queryKey: eventKeys.all });
        },
        (err) => {
          console.error("[EditEvent] Background save error:", err);
          // Roll back optimistic update
          if (previousDetail) {
            queryClient.setQueryData(detailKey, previousDetail);
          }
          queryClient.invalidateQueries({ queryKey: ["events"] });
          showToast(
            "error",
            "Save Failed",
            err?.message || "Changes could not be saved. Please try again.",
          );
        },
      );
      return; // skip the finally block's setIsSaving
    } catch (error: any) {
      console.error("[EditEvent] Save error:", error);
      showToast("error", "Error", error?.message || "Failed to save changes");
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
          <LocationAutocompleteInstagram
            value={location}
            placeholder="Search location..."
            onLocationSelect={(data: LocationData) => {
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

        {/* Ticket Tiers */}
        {ticketingEnabled && (
          <View className="mb-4">
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text className="text-sm font-medium text-foreground">
                Ticket Tiers
              </Text>
              <Pressable
                onPress={() => {
                  setTicketTiers((prev) => [
                    ...prev,
                    {
                      name: "General Admission",
                      priceDollars: "0",
                      quantity: "100",
                      maxPerOrder: "4",
                      tier: "ga",
                      description: "",
                      isActive: true,
                    },
                  ]);
                  setHasChanges(true);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: "rgba(138,64,207,0.15)",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: "rgba(138,64,207,0.3)",
                }}
              >
                <Plus size={14} color="#8A40CF" />
                <Text style={{ color: "#8A40CF", fontSize: 13, fontWeight: "600" }}>
                  Add Tier
                </Text>
              </Pressable>
            </View>

            {ticketTiers.length === 0 && (
              <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: "center", paddingVertical: 16 }}>
                No ticket tiers yet. Tap "Add Tier" to create one.
              </Text>
            )}

            {ticketTiers.map((tier, idx) => (
              <View
                key={idx}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor:
                    tier.tier === "vip" ? "rgba(138,64,207,0.3)"
                    : tier.tier === "table" ? "rgba(255,91,252,0.3)"
                    : tier.tier === "free" ? "rgba(63,220,255,0.3)"
                    : "rgba(52,162,223,0.3)",
                }}
              >
                {/* Tier level selector */}
                <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
                  {TIER_LEVELS.map((lvl) => (
                    <Pressable
                      key={lvl}
                      onPress={() => {
                        const updated = [...ticketTiers];
                        updated[idx] = { ...updated[idx], tier: lvl };
                        if (lvl === "free") updated[idx].priceDollars = "0";
                        setTicketTiers(updated);
                        setHasChanges(true);
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 6,
                        borderRadius: 8,
                        alignItems: "center",
                        backgroundColor: tier.tier === lvl
                          ? lvl === "vip" ? "#8A40CF"
                            : lvl === "table" ? "#FF5BFC"
                            : lvl === "free" ? "#3FDCFF"
                            : "#34A2DF"
                          : "transparent",
                        borderWidth: 1,
                        borderColor: tier.tier === lvl ? "transparent" : colors.border,
                      }}
                    >
                      <Text style={{
                        color: tier.tier === lvl ? "#fff" : colors.mutedForeground,
                        fontSize: 11,
                        fontWeight: "600",
                        textTransform: "uppercase",
                      }}>
                        {lvl}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Name */}
                <TextInput
                  value={tier.name}
                  onChangeText={(v) => {
                    const updated = [...ticketTiers];
                    updated[idx] = { ...updated[idx], name: v };
                    setTicketTiers(updated);
                    setHasChanges(true);
                  }}
                  placeholder="Tier name"
                  placeholderTextColor={colors.mutedForeground}
                  style={{
                    color: colors.foreground,
                    fontSize: 15,
                    fontWeight: "600",
                    marginBottom: 10,
                    paddingVertical: 4,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                />

                {/* Price + Quantity row */}
                <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11, marginBottom: 4 }}>
                      Price ($)
                    </Text>
                    <TextInput
                      value={tier.priceDollars}
                      onChangeText={(v) => {
                        const updated = [...ticketTiers];
                        updated[idx] = { ...updated[idx], priceDollars: v };
                        setTicketTiers(updated);
                        setHasChanges(true);
                      }}
                      placeholder="0"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="decimal-pad"
                      editable={tier.tier !== "free"}
                      style={{
                        color: tier.tier === "free" ? colors.mutedForeground : colors.foreground,
                        fontSize: 15,
                        fontWeight: "600",
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        backgroundColor: "rgba(255,255,255,0.05)",
                        borderRadius: 8,
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11, marginBottom: 4 }}>
                      Quantity
                    </Text>
                    <TextInput
                      value={tier.quantity}
                      onChangeText={(v) => {
                        const updated = [...ticketTiers];
                        updated[idx] = { ...updated[idx], quantity: v };
                        setTicketTiers(updated);
                        setHasChanges(true);
                      }}
                      placeholder="100"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="number-pad"
                      style={{
                        color: colors.foreground,
                        fontSize: 15,
                        fontWeight: "600",
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        backgroundColor: "rgba(255,255,255,0.05)",
                        borderRadius: 8,
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11, marginBottom: 4 }}>
                      Max/Order
                    </Text>
                    <TextInput
                      value={tier.maxPerOrder}
                      onChangeText={(v) => {
                        const updated = [...ticketTiers];
                        updated[idx] = { ...updated[idx], maxPerOrder: v };
                        setTicketTiers(updated);
                        setHasChanges(true);
                      }}
                      placeholder="4"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="number-pad"
                      style={{
                        color: colors.foreground,
                        fontSize: 15,
                        fontWeight: "600",
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        backgroundColor: "rgba(255,255,255,0.05)",
                        borderRadius: 8,
                      }}
                    />
                  </View>
                </View>

                {/* Description */}
                <TextInput
                  value={tier.description}
                  onChangeText={(v) => {
                    const updated = [...ticketTiers];
                    updated[idx] = { ...updated[idx], description: v };
                    setTicketTiers(updated);
                    setHasChanges(true);
                  }}
                  placeholder="Perks description (optional)"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  style={{
                    color: colors.foreground,
                    fontSize: 13,
                    paddingVertical: 6,
                    marginBottom: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    minHeight: 36,
                  }}
                />

                {/* Remove */}
                <Pressable
                  onPress={() => {
                    setTicketTiers((prev) => prev.filter((_, i) => i !== idx));
                    setHasChanges(true);
                  }}
                  style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <X size={14} color="#ef4444" />
                  <Text style={{ color: "#ef4444", fontSize: 12 }}>Remove tier</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

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
            <Video size={18} color={colors.mutedForeground} />
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

export default function EditEventScreen() {
  const router = useRouter();
  return (
    <ErrorBoundary screenName="EditEventDetail" onGoBack={() => router.back()}>
      <EditEventScreenContent />
    </ErrorBoundary>
  );
}
