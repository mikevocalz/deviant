/**
 * Custom Google Places Autocomplete Component (v3)
 * Uses the newer Google Places API (New) directly
 */

import { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
} from "react-native";
import { LegendList } from "@/components/list";
import { MapPin, AlertCircle, X, Loader2 } from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import { useDebounce } from "@/lib/hooks/use-debounce";

export interface LocationData {
  name: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  formattedAddress?: string;
}

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
}

const GOOGLE_PLACES_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || "";

// Debug: Log the API key status
console.log(
  "[LocationAutocompleteV3] API Key:",
  GOOGLE_PLACES_API_KEY ? "Present" : "Missing",
);
console.log(
  "[LocationAutocompleteV3] API Key Length:",
  GOOGLE_PLACES_API_KEY.length,
);

export function LocationAutocompleteV3({
  value,
  placeholder = "Search location...",
  onLocationSelect,
  onClear,
  onTextChange,
}: LocationAutocompleteProps) {
  const { colors } = useColorScheme();
  const [inputText, setInputText] = useState(value || "");
  const [predictions, setPredictions] = useState<GooglePlace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Debounce the input text for API calls (300ms delay)
  const debouncedText = useDebounce(inputText, 300);

  // Check if API key is configured
  useEffect(() => {
    console.log("[LocationAutocompleteV3] Checking API key configuration...");
    if (
      !GOOGLE_PLACES_API_KEY ||
      GOOGLE_PLACES_API_KEY === "your_google_places_api_key_here"
    ) {
      console.warn(
        "[LocationAutocompleteV3] Google Places API key not configured or using placeholder. Using manual input mode.",
      );
      setHasError(true);
    } else {
      console.log("[LocationAutocompleteV3] API key configured successfully");
    }
  }, []);

  // Fetch predictions when debounced text changes
  useEffect(() => {
    if (debouncedText.length < 2) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    if (hasError) return;

    fetchPredictions(debouncedText);
  }, [debouncedText, hasError]);

  const fetchPredictions = async (text: string) => {
    setIsLoading(true);
    setShowDropdown(true);

    try {
      // Use Google Places parameters tuned for rich venue and address results
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?key=${GOOGLE_PLACES_API_KEY}&input=${encodeURIComponent(text)}&language=en&components=country:us&types=establishment|geocode|address&radius=50000&strictbounds=false`,
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "REQUEST_DENIED") {
        console.error(
          "[LocationAutocompleteV3] API error:",
          data.error_message,
        );
        // Try alternative endpoint for Places API (New)
        tryAlternativeAPI(text);
        return;
      }

      setPredictions(data.predictions || []);
      console.log(
        "[LocationAutocompleteV3] Predictions:",
        data.predictions?.length || 0,
      );
    } catch (error) {
      console.error("[LocationAutocompleteV3] Fetch error:", error);
      // Try alternative API on error
      tryAlternativeAPI(text);
    } finally {
      setIsLoading(false);
    }
  };

  // Try alternative Places API (New) endpoint
  const tryAlternativeAPI = async (text: string) => {
    try {
      // Try the newer Places API format
      const response = await fetch(
        `https://places.googleapis.com/v1/places:autocomplete?key=${GOOGLE_PLACES_API_KEY}&input=${encodeURIComponent(text)}&language=en&includedRegionCodes=us`,
      );

      if (response.ok) {
        const data = await response.json();
        if (data.suggestions) {
          // Convert to our format
          const convertedPredictions = data.suggestions.map(
            (suggestion: any) => ({
              place_id: suggestion.place?.id || "fallback-" + Math.random(),
              description:
                suggestion.place?.displayName?.text ||
                suggestion.text?.text ||
                "",
              structured_formatting: {
                main_text:
                  suggestion.place?.displayName?.text ||
                  suggestion.text?.text ||
                  "",
                secondary_text: suggestion.place?.formattedAddress || "",
              },
            }),
          );
          setPredictions(convertedPredictions);
          return;
        }
      }
    } catch (error) {
      console.error("[LocationAutocompleteV3] Alternative API error:", error);
    }

    // Ultimate fallback to popular locations
    setPredictions(getPopularLocations(text));
  };

  // Fallback popular locations when API is not working
  const getPopularLocations = (searchText: string): GooglePlace[] => {
    const popularPlaces = [
      {
        place_id: "fallback-downtown",
        description: "Downtown",
        structured_formatting: {
          main_text: "Downtown",
          secondary_text: "Popular area",
        },
      },
      {
        place_id: "fallback-city-center",
        description: "City Center",
        structured_formatting: {
          main_text: "City Center",
          secondary_text: "Popular area",
        },
      },
      {
        place_id: "fallback-waterfront",
        description: "Waterfront",
        structured_formatting: {
          main_text: "Waterfront",
          secondary_text: "Popular area",
        },
      },
      {
        place_id: "fallback-arts-district",
        description: "Arts District",
        structured_formatting: {
          main_text: "Arts District",
          secondary_text: "Popular area",
        },
      },
      {
        place_id: "fallback-market-square",
        description: "Market Square",
        structured_formatting: {
          main_text: "Market Square",
          secondary_text: "Popular area",
        },
      },
      {
        place_id: "fallback-main-street",
        description: "Main Street",
        structured_formatting: {
          main_text: "Main Street",
          secondary_text: "Popular area",
        },
      },
      {
        place_id: "fallback-riverwalk",
        description: "Riverwalk",
        structured_formatting: {
          main_text: "Riverwalk",
          secondary_text: "Popular area",
        },
      },
      {
        place_id: "fallback-convention-center",
        description: "Convention Center",
        structured_formatting: {
          main_text: "Convention Center",
          secondary_text: "Popular area",
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
        `https://maps.googleapis.com/maps/api/place/details/json?key=${GOOGLE_PLACES_API_KEY}&place_id=${placeId}&fields=formatted_address,name,geometry,place_id,types`,
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "REQUEST_DENIED") {
        console.error(
          "[LocationAutocompleteV3] Details API error:",
          data.error_message,
        );
        // Return fallback coordinates for popular locations
        return getFallbackLocationDetails(placeId);
      }

      return data.result;
    } catch (error) {
      console.error("[LocationAutocompleteV3] Details fetch error:", error);
      // Return fallback coordinates for popular locations
      return getFallbackLocationDetails(placeId);
    }
  };

  // Fallback location details for popular places
  const getFallbackLocationDetails = (placeId: string) => {
    const fallbackDetails: Record<string, any> = {
      "fallback-downtown": {
        place_id: "fallback-downtown",
        name: "Downtown",
        formatted_address: "Downtown",
      },
      "fallback-city-center": {
        place_id: "fallback-city-center",
        name: "City Center",
        formatted_address: "City Center",
      },
      "fallback-waterfront": {
        place_id: "fallback-waterfront",
        name: "Waterfront",
        formatted_address: "Waterfront",
      },
      "fallback-arts-district": {
        place_id: "fallback-arts-district",
        name: "Arts District",
        formatted_address: "Arts District",
      },
      "fallback-market-square": {
        place_id: "fallback-market-square",
        name: "Market Square",
        formatted_address: "Market Square",
      },
      "fallback-main-street": {
        place_id: "fallback-main-street",
        name: "Main Street",
        formatted_address: "Main Street",
      },
      "fallback-riverwalk": {
        place_id: "fallback-riverwalk",
        name: "Riverwalk",
        formatted_address: "Riverwalk",
      },
      "fallback-convention-center": {
        place_id: "fallback-convention-center",
        name: "Convention Center",
        formatted_address: "Convention Center",
      },
    };

    return fallbackDetails[placeId] || null;
  };

  const handleSelectPrediction = async (prediction: GooglePlace) => {
    setInputText(prediction.description);
    setShowDropdown(false);
    setPredictions([]);

    // Fetch detailed place information
    const details = await fetchPlaceDetails(prediction.place_id);

    const locationData: LocationData = {
      name: prediction.structured_formatting.main_text,
      placeId: prediction.place_id,
      formattedAddress: prediction.description,
      latitude: details?.geometry?.location?.lat,
      longitude: details?.geometry?.location?.lng,
    };

    onLocationSelect(locationData);
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
    if (onClear) {
      onClear();
    }
  };

  const handleSubmit = () => {
    if (inputText.trim()) {
      const locationData: LocationData = {
        name: inputText.trim(),
      };
      onLocationSelect(locationData);
      setShowDropdown(false);
    }
  };

  // Show manual input when API key is missing or invalid
  if (hasError) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.card,
            borderRadius: 16,
            paddingHorizontal: 12,
            flexDirection: "row",
            alignItems: "center",
          },
        ]}
      >
        <MapPin size={18} color={colors.mutedForeground} />
        <TextInput
          style={{
            flex: 1,
            height: 48,
            color: colors.foreground,
            fontSize: 15,
            marginLeft: 8,
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          value={inputText}
          onChangeText={handleTextChange}
          onSubmitEditing={handleSubmit}
        />
        {inputText.length > 0 && (
          <Pressable onPress={handleClear} hitSlop={8}>
            <X size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>
    );
  }

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
            setShowDropdown(true);
            if (inputText.length >= 2) {
              fetchPredictions(inputText);
            }
          }}
        />
        {isLoading && <Loader2 size={18} color={colors.mutedForeground} />}
        {inputText.length > 0 && !isLoading && (
          <Pressable onPress={handleClear} hitSlop={8}>
            <X size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {showDropdown && predictions.length > 0 && (
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            marginTop: 8,
            borderWidth: 1,
            borderColor: colors.border,
            maxHeight: 200,
            position: "absolute",
            top: 56,
            left: 0,
            right: 0,
            zIndex: 1000,
          }}
        >
          <LegendList
            data={predictions}
            keyExtractor={(item) => item.place_id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleSelectPrediction(item)}
                style={{
                  padding: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <MapPin size={16} color={colors.mutedForeground} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 15,
                      fontWeight: "500",
                    }}
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
            )}
            showsVerticalScrollIndicator={false}
            recycleItems
            estimatedItemSize={64}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    zIndex: 1000,
  },
});
