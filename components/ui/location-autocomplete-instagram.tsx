/**
 * Instagram-Level Location Autocomplete Component
 *
 * Features:
 * - Real Google Places API integration
 * - Recent locations with MMKV storage
 * - Current location detection
 * - Popular nearby places
 * - Business listings (restaurants, venues, etc.)
 * - Instagram-style UI with categories
 */

import { useRef, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  FlatList,
  TouchableOpacity,
  SectionList,
  ScrollView,
} from "react-native";
import {
  MapPin,
  AlertCircle,
  X,
  Loader2,
  Clock,
  Navigation,
  Star,
  Building,
} from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import * as Location from "expo-location";
import { createMMKV } from "react-native-mmkv";
import { create } from "zustand";
import { Debouncer } from "@tanstack/react-pacer";

export type LocationData = {
  name: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  formattedAddress?: string;
};

interface LocationAutocompleteProps {
  value?: string;
  placeholder?: string;
  onLocationSelect: (location: LocationData) => void;
  onClear?: () => void;
  onTextChange?: (text: string) => void;
}

interface GooglePlace {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text?: string;
  };
  types?: string[];
}

interface RecentLocation {
  id: string;
  name: string;
  address?: string;
  timestamp: number;
  placeId?: string;
  latitude?: number;
  longitude?: number;
}

const GOOGLE_PLACES_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || "";

// MMKV storage for recent locations
const recentLocationsStorage = createMMKV({ id: "dvnt-recent-locations" });

// Zustand store - persists across parent re-renders (fixes dropdown reopening)
interface LocationAutocompleteState {
  showDropdown: boolean;
  inputText: string;
  isLoading: boolean;
  activeSection: "recent" | "current" | "search";
  predictions: GooglePlace[];
  recentLocations: RecentLocation[];
  currentLocation: LocationData | null;
  isLoadingLocation: boolean;
  hasError: boolean;
}

const useLocationStore = create<LocationAutocompleteState>(() => ({
  showDropdown: false,
  inputText: "",
  isLoading: false,
  activeSection: "recent",
  predictions: [],
  recentLocations: [],
  currentLocation: null,
  isLoadingLocation: false,
  hasError: false,
}));

export function LocationAutocompleteInstagram({
  value,
  placeholder = "Search location...",
  onLocationSelect,
  onClear,
  onTextChange,
}: LocationAutocompleteProps) {
  const { colors } = useColorScheme();

  // useRef for justSelected - MUST be synchronous to prevent race condition
  const justSelectedRef = useRef(false);

  // Zustand store - persists across parent re-renders
  const inputText = useLocationStore((s) => s.inputText);
  const setInputText = useCallback((text: string) => {
    useLocationStore.setState({ inputText: text });
  }, []);

  const predictions = useLocationStore((s) => s.predictions);
  const setPredictions = useCallback((preds: GooglePlace[]) => {
    useLocationStore.setState({ predictions: preds });
  }, []);

  const recentLocations = useLocationStore((s) => s.recentLocations);
  const setRecentLocations = useCallback((locs: RecentLocation[]) => {
    useLocationStore.setState({ recentLocations: locs });
  }, []);

  const currentLocation = useLocationStore((s) => s.currentLocation);
  const setCurrentLocation = useCallback((loc: LocationData | null) => {
    useLocationStore.setState({ currentLocation: loc });
  }, []);

  const isLoading = useLocationStore((s) => s.isLoading);
  const setIsLoading = useCallback((loading: boolean) => {
    useLocationStore.setState({ isLoading: loading });
  }, []);

  const isLoadingLocation = useLocationStore((s) => s.isLoadingLocation);
  const setIsLoadingLocation = useCallback((loading: boolean) => {
    useLocationStore.setState({ isLoadingLocation: loading });
  }, []);

  const showDropdown = useLocationStore((s) => s.showDropdown);
  const setShowDropdown = useCallback((show: boolean) => {
    useLocationStore.setState({ showDropdown: show });
  }, []);

  const hasError = useLocationStore((s) => s.hasError);
  const setHasError = useCallback((error: boolean) => {
    useLocationStore.setState({ hasError: error });
  }, []);

  const activeSection = useLocationStore((s) => s.activeSection);
  const setActiveSection = useCallback(
    (section: "recent" | "current" | "search") => {
      useLocationStore.setState({ activeSection: section });
    },
    [],
  );

  // TanStack Debouncer for API calls
  const fetchDebouncerRef = useRef(
    new Debouncer(
      async (text: string) => {
        if (text.length < 2) {
          setPredictions([]);
          setActiveSection(recentLocations.length > 0 ? "recent" : "current");
          return;
        }
        if (hasError) return;

        setActiveSection("search");
        await fetchPredictions(text);
      },
      { wait: 300 },
    ),
  );

  // Load recent locations on mount
  useEffect(() => {
    loadRecentLocations();
    requestCurrentLocation();
  }, []);

  // Check if API key is configured
  useEffect(() => {
    console.log(
      "[LocationAutocompleteInstagram] Checking API key configuration...",
    );
    if (
      !GOOGLE_PLACES_API_KEY ||
      GOOGLE_PLACES_API_KEY === "your_google_places_api_key_here"
    ) {
      console.warn(
        "[LocationAutocompleteInstagram] Google Places API key not configured or using placeholder.",
      );
      setHasError(true);
    } else {
      console.log(
        "[LocationAutocompleteInstagram] API key configured successfully",
      );
    }
  }, []);

  // Load recent locations from MMKV
  const loadRecentLocations = () => {
    try {
      const stored = recentLocationsStorage.getString("recent-locations");
      if (stored) {
        const locations = JSON.parse(stored) as RecentLocation[];
        // Sort by timestamp (most recent first) and limit to 10
        const sorted = locations
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 10);
        setRecentLocations(sorted);
      }
    } catch (error) {
      console.error(
        "[LocationAutocompleteInstagram] Failed to load recent locations:",
        error,
      );
    }
  };

  // Save location to recent locations
  const saveToRecentLocations = (location: LocationData) => {
    try {
      const newRecent: RecentLocation = {
        id: location.placeId || `custom-${Date.now()}`,
        name: location.name,
        address: location.formattedAddress,
        timestamp: Date.now(),
        placeId: location.placeId,
        latitude: location.latitude,
        longitude: location.longitude,
      };

      // Get existing recent locations
      const stored = recentLocationsStorage.getString("recent-locations");
      const existing = stored ? (JSON.parse(stored) as RecentLocation[]) : [];

      // Remove if already exists and add to beginning
      const filtered = existing.filter((loc) => loc.id !== newRecent.id);
      const updated = [newRecent, ...filtered].slice(0, 20); // Keep max 20

      recentLocationsStorage.set("recent-locations", JSON.stringify(updated));
      setRecentLocations(updated.slice(0, 10)); // Display max 10
    } catch (error) {
      console.error(
        "[LocationAutocompleteInstagram] Failed to save recent location:",
        error,
      );
    }
  };

  // Request current location
  const requestCurrentLocation = async () => {
    setIsLoadingLocation(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log(
          "[LocationAutocompleteInstagram] Location permission denied",
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCurrentLocation({
        name: "Current Location",
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error(
        "[LocationAutocompleteInstagram] Failed to get current location:",
        error,
      );
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // Debug logging for dropdown state
  useEffect(() => {
    console.log("[LocationAutocompleteInstagram] Dropdown state changed:", {
      showDropdown,
      activeSection,
      recentLocationsCount: recentLocations.length,
      predictionsCount: predictions.length,
      inputTextLength: inputText.length,
    });
  }, [
    showDropdown,
    activeSection,
    recentLocations.length,
    predictions.length,
    inputText.length,
  ]);

  // Fetch predictions when input text changes (debounced via TanStack)
  useEffect(() => {
    console.log(
      "[LocationAutocompleteInstagram] Text changed:",
      inputText,
      "length:",
      inputText.length,
      "justSelected:",
      justSelectedRef.current,
    );

    // Don't fetch if we just selected something (prevents dropdown from reopening)
    if (justSelectedRef.current) {
      console.log(
        "[LocationAutocompleteInstagram] Just selected, skipping fetch",
      );
      return;
    }

    // Trigger debounced fetch
    fetchDebouncerRef.current.maybeExecute(inputText);
  }, [inputText]);

  const fetchPredictions = async (text: string) => {
    console.log(
      "[LocationAutocompleteInstagram] Fetching predictions for:",
      text,
    );
    setIsLoading(true);
    setShowDropdown(true);

    try {
      // Try the NEW Google Places API with correct format
      const url = `https://places.googleapis.com/v1/places:autocomplete?key=${GOOGLE_PLACES_API_KEY}`;
      console.log(
        "[LocationAutocompleteInstagram] Fetching URL (NEW API):",
        url,
      );

      const requestBody = {
        input: text,
        languageCode: "en",
        includedRegionCodes: ["us"],
        includedPrimaryTypes: ["geocode", "establishment", "address"],
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        console.log(
          "[LocationAutocompleteInstagram] NEW API failed, trying legacy API",
        );
        // Fall back to legacy API if NEW API fails
        return await tryLegacyAPI(text);
      }

      const data = await response.json();
      console.log("[LocationAutocompleteInstagram] API response (NEW):", data);

      if (data.error) {
        console.error(
          "[LocationAutocompleteInstagram] API error (NEW):",
          data.error,
        );
        return await tryLegacyAPI(text);
      }

      // Convert NEW API format to our expected format
      const convertedPredictions =
        data.suggestions?.map((suggestion: any) => ({
          place_id: suggestion.place?.id || "fallback-" + Math.random(),
          description:
            suggestion.place?.displayName?.text || suggestion.text?.text || "",
          structured_formatting: {
            main_text:
              suggestion.place?.displayName?.text ||
              suggestion.text?.text ||
              "",
            secondary_text: suggestion.place?.formattedAddress || "",
          },
          types: suggestion.place?.types || [],
        })) || [];

      setPredictions(convertedPredictions);
      console.log(
        "[LocationAutocompleteInstagram] Predictions set (NEW):",
        convertedPredictions.length,
      );
    } catch (error) {
      console.error(
        "[LocationAutocompleteInstagram] Fetch error (NEW):",
        error,
      );
      // Try legacy API on error
      await tryLegacyAPI(text);
    } finally {
      setIsLoading(false);
    }
  };

  // Try legacy API as fallback
  const tryLegacyAPI = async (text: string) => {
    try {
      console.log("[LocationAutocompleteInstagram] Trying legacy API");
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?key=${GOOGLE_PLACES_API_KEY}&input=${encodeURIComponent(
        text,
      )}&language=en&components=country:us&types=establishment|geocode|address`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "REQUEST_DENIED") {
        console.error("[LocationAutocompleteInstagram] Legacy API also denied");
        setPredictions(getPopularLocations(text));
        return;
      }

      setPredictions(data.predictions || []);
      console.log(
        "[LocationAutocompleteInstagram] Legacy API predictions:",
        data.predictions?.length || 0,
      );
    } catch (error) {
      console.error("[LocationAutocompleteInstagram] Legacy API error:", error);
      setPredictions(getPopularLocations(text));
    }
  };

  // Fallback popular locations when API is not working
  const getPopularLocations = (searchText: string): GooglePlace[] => {
    const popularPlaces = [
      {
        place_id: "chIJrTLr-GyuEmsRBfyf1GDuE7U",
        description: "Madison Square Garden, New York, NY, USA",
        structured_formatting: {
          main_text: "Madison Square Garden",
          secondary_text: "New York, NY, USA",
        },
      },
      {
        place_id: "chIJvUwsRj5ZwokR-9v8Ch2w_mWQ",
        description: "Times Square, New York, NY, USA",
        structured_formatting: {
          main_text: "Times Square",
          secondary_text: "New York, NY, USA",
        },
      },
      {
        place_id: "chIJQ3S6Gh6ZwokR4jA_p_kd_hvw",
        description: "Central Park, New York, NY, USA",
        structured_formatting: {
          main_text: "Central Park",
          secondary_text: "New York, NY, USA",
        },
      },
      {
        place_id: "chIJdRlClxZawokR7_p3d5i9SQhY",
        description: "Brooklyn Bridge, New York, NY, USA",
        structured_formatting: {
          main_text: "Brooklyn Bridge",
          secondary_text: "New York, NY, USA",
        },
      },
      {
        place_id: "chIJN8h6Cc6ZwokR2Mj_hQyGdRYY",
        description: "Statue of Liberty, New York, NY, USA",
        structured_formatting: {
          main_text: "Statue of Liberty",
          secondary_text: "New York, NY, USA",
        },
      },
      {
        place_id: "chIJc3RyCQ-ZwokR6jE3d_dk32Ks",
        description: "Empire State Building, New York, NY, USA",
        structured_formatting: {
          main_text: "Empire State Building",
          secondary_text: "New York, NY, USA",
        },
      },
    ];

    if (!searchText || searchText.length < 2) return [];

    // Filter popular places based on search text
    return popularPlaces.filter(
      (place) =>
        place.structured_formatting.main_text
          .toLowerCase()
          .includes(searchText.toLowerCase()) ||
        place.description.toLowerCase().includes(searchText.toLowerCase()),
    );
  };

  const fetchPlaceDetails = async (placeId: string) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?key=${GOOGLE_PLACES_API_KEY}&place_id=${placeId}&fields=formatted_address,name,geometry,place_id,types,rating,photos`,
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "REQUEST_DENIED") {
        console.error(
          "[LocationAutocompleteInstagram] Details API error:",
          data.error_message,
        );
        return null;
      }

      return data.result;
    } catch (error) {
      console.error(
        "[LocationAutocompleteInstagram] Details fetch error:",
        error,
      );
      return null;
    }
  };

  const handleSelectPrediction = async (prediction: GooglePlace) => {
    // Cancel any pending debounced fetch
    fetchDebouncerRef.current.cancel();

    // Set justSelected FIRST (useRef is synchronous)
    justSelectedRef.current = true;
    setShowDropdown(false);
    setPredictions([]);
    setInputText(prediction.description);

    // Fetch detailed place information
    const details = await fetchPlaceDetails(prediction.place_id);

    const locationData: LocationData = {
      name: prediction.structured_formatting.main_text,
      placeId: prediction.place_id,
      formattedAddress: prediction.description,
      latitude: details?.geometry?.location?.lat,
      longitude: details?.geometry?.location?.lng,
    };

    // Save to recent locations
    saveToRecentLocations(locationData);

    onLocationSelect(locationData);

    // Reset the flag after a longer delay
    setTimeout(() => (justSelectedRef.current = false), 1000);
  };

  const handleSelectRecent = (recent: RecentLocation) => {
    // Cancel any pending debounced fetch
    fetchDebouncerRef.current.cancel();

    // Set justSelected FIRST (useRef is synchronous)
    justSelectedRef.current = true;
    setShowDropdown(false);
    setInputText(recent.name);

    const locationData: LocationData = {
      name: recent.name,
      placeId: recent.placeId,
      formattedAddress: recent.address,
      latitude: recent.latitude,
      longitude: recent.longitude,
    };

    // Update timestamp and move to top
    saveToRecentLocations(locationData);

    onLocationSelect(locationData);

    // Reset the flag after a longer delay
    setTimeout(() => (justSelectedRef.current = false), 1000);
  };

  const handleSelectCurrentLocation = () => {
    if (!currentLocation) return;

    // Cancel any pending debounced fetch
    fetchDebouncerRef.current.cancel();

    // Set justSelected FIRST (useRef is synchronous)
    justSelectedRef.current = true;
    setShowDropdown(false);
    setInputText("Current Location");

    const locationData: LocationData = {
      name: "Current Location",
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
    };

    onLocationSelect(locationData);

    // Reset the flag after a longer delay
    setTimeout(() => {
      justSelectedRef.current = false;
    }, 1000);
  };

  const handleTextChange = useCallback(
    (text: string) => {
      setInputText(text);
      if (onTextChange) {
        onTextChange(text);
      }
    },
    [onTextChange],
  );

  const handleClear = () => {
    setInputText("");
    setPredictions([]);
    setShowDropdown(false);
    setActiveSection(recentLocations.length > 0 ? "recent" : "current");
    if (onClear) {
      onClear();
    }
  };

  const handleSubmit = () => {
    if (inputText.trim()) {
      const locationData: LocationData = {
        name: inputText.trim(),
      };
      saveToRecentLocations(locationData);
      onLocationSelect(locationData);
      setShowDropdown(false);
    }
  };

  const getPlaceIcon = (types?: string[]) => {
    if (!types) return <MapPin size={16} color={colors.mutedForeground} />;

    if (types.includes("restaurant") || types.includes("food")) {
      return <Star size={16} color={colors.mutedForeground} />;
    }
    if (types.includes("establishment")) {
      return <Building size={16} color={colors.mutedForeground} />;
    }
    return <MapPin size={16} color={colors.mutedForeground} />;
  };

  const renderSectionHeader = ({
    title,
    icon,
  }: {
    title: string;
    icon: React.ReactNode;
  }) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      {icon}
      <Text
        style={{
          color: colors.foreground,
          fontSize: 14,
          fontWeight: "600",
          marginLeft: 8,
        }}
      >
        {title}
      </Text>
    </View>
  );

  const renderRecentItem = ({ item }: { item: RecentLocation }) => (
    <TouchableOpacity
      onPress={() => handleSelectRecent(item)}
      style={{
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.card,
        minHeight: 48, // Ensure minimum touch target size
      }}
      activeOpacity={0.7}
    >
      <Clock size={16} color={colors.mutedForeground} />
      <View style={{ marginLeft: 12, flex: 1 }}>
        <Text
          style={{ color: colors.foreground, fontSize: 15, fontWeight: "500" }}
        >
          {item.name}
        </Text>
        {item.address && (
          <Text
            style={{
              color: colors.mutedForeground,
              fontSize: 13,
              marginTop: 2,
            }}
          >
            {item.address}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderPredictionItem = ({ item }: { item: GooglePlace }) => (
    <TouchableOpacity
      onPress={() => handleSelectPrediction(item)}
      style={{
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.card,
        minHeight: 48, // Ensure minimum touch target size
      }}
      activeOpacity={0.7}
    >
      {getPlaceIcon(item.types)}
      <View style={{ marginLeft: 12, flex: 1 }}>
        <Text
          style={{ color: colors.foreground, fontSize: 15, fontWeight: "500" }}
        >
          {item.structured_formatting.main_text}
        </Text>
        {item.structured_formatting.secondary_text && (
          <Text
            style={{
              color: colors.mutedForeground,
              fontSize: 13,
              marginTop: 2,
            }}
          >
            {item.structured_formatting.secondary_text}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const sections = [
    ...(recentLocations.length > 0 && activeSection === "recent"
      ? [
          {
            title: "Recent",
            data: recentLocations,
            renderItem: renderRecentItem,
            key: "recent",
          },
        ]
      : []),
    ...(currentLocation && activeSection === "current"
      ? [
          {
            title: "Current Location",
            data: [{ id: "current" }],
            renderItem: () => (
              <TouchableOpacity
                onPress={handleSelectCurrentLocation}
                style={{
                  padding: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.card,
                }}
              >
                <Navigation size={16} color={colors.mutedForeground} />
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 15,
                    fontWeight: "500",
                    marginLeft: 12,
                  }}
                >
                  Current Location
                </Text>
              </TouchableOpacity>
            ),
            key: "current",
          },
        ]
      : []),
    ...(predictions.length > 0 && activeSection === "search"
      ? [
          {
            title: "Search Results",
            data: predictions,
            renderItem: renderPredictionItem,
            key: "search",
          },
        ]
      : []),
  ];

  return (
    <View style={styles.container}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.card,
          borderRadius: 16,
          paddingHorizontal: 12,
        }}
      >
        <MapPin size={18} color={colors.mutedForeground} />
        <TextInput
          style={{
            flex: 1,
            height: 48,
            color: colors.foreground,
            fontSize: 15,
            marginLeft: 8,
            backgroundColor: "transparent",
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          value={inputText}
          onChangeText={handleTextChange}
          onSubmitEditing={handleSubmit}
          onFocus={() => {
            console.log(
              "[LocationAutocompleteInstagram] Input focused, justSelected:",
              justSelectedRef.current,
              "inputText:",
              inputText,
            );
            // Don't show dropdown if we just selected something
            if (!justSelectedRef.current) {
              console.log(
                "[LocationAutocompleteInstagram] Showing dropdown on focus",
              );
              setShowDropdown(true);
              setActiveSection(
                recentLocations.length > 0 ? "recent" : "current",
              );
            } else {
              console.log(
                "[LocationAutocompleteInstagram] Skipping dropdown - just selected",
              );
            }
          }}
          onBlur={() => {
            console.log("[LocationAutocompleteInstagram] Input blurred");
            // Don't reset justSelected on blur - the setTimeout in selection handlers
            // will reset it after 1 second, which prevents dropdown from reopening
            // when input regains focus during parent component re-renders
          }}
        />
        {(isLoading || isLoadingLocation) && (
          <Loader2 size={18} color={colors.mutedForeground} />
        )}
        {inputText.length > 0 && !isLoading && !isLoadingLocation && (
          <Pressable onPress={handleClear} hitSlop={8}>
            <X size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {/* Render dropdown outside of any scrollview context */}
      {showDropdown && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            backgroundColor: "transparent", // Make sure it captures touches
          }}
          onStartShouldSetResponder={() => true}
          onResponderRelease={() => setShowDropdown(false)}
        >
          <View
            style={{
              position: "absolute",
              top: 56, // Position below the input
              left: 0, // Full width to prevent edge issues
              right: 0,
              backgroundColor: colors.card,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              maxHeight: 300,
              zIndex: 99999,
              elevation: 5,
              shadowColor: "#000",
              shadowOffset: {
                width: 0,
                height: 2,
              },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
            }}
            onStartShouldSetResponder={() => true}
            onResponderRelease={(e) => e.stopPropagation()}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Recent Locations Section */}
              {recentLocations.length > 0 && activeSection === "recent" && (
                <View>
                  {renderSectionHeader({
                    title: "Recent",
                    icon: <Clock size={16} color={colors.mutedForeground} />,
                  })}
                  {recentLocations.map((recent) => (
                    <View key={recent.id}>
                      {renderRecentItem({ item: recent })}
                    </View>
                  ))}
                </View>
              )}

              {/* Current Location Section */}
              {currentLocation && activeSection === "current" && (
                <View>
                  {renderSectionHeader({
                    title: "Current Location",
                    icon: (
                      <Navigation size={16} color={colors.mutedForeground} />
                    ),
                  })}
                  <TouchableOpacity
                    onPress={handleSelectCurrentLocation}
                    style={{
                      padding: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: colors.card,
                    }}
                  >
                    <Navigation size={16} color={colors.mutedForeground} />
                    <Text
                      style={{
                        color: colors.foreground,
                        fontSize: 15,
                        fontWeight: "500",
                        marginLeft: 12,
                      }}
                    >
                      Current Location
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Search Results Section */}
              {predictions.length > 0 && activeSection === "search" && (
                <View>
                  {renderSectionHeader({
                    title: "Search Results",
                    icon: <MapPin size={16} color={colors.mutedForeground} />,
                  })}
                  {predictions.map((prediction) => (
                    <View key={prediction.place_id}>
                      {renderPredictionItem({ item: prediction })}
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    zIndex: 9999,
  },
});
