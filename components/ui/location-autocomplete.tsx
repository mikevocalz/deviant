import { useRef } from "react"
import { View, StyleSheet } from "react-native"
import { GooglePlacesAutocomplete, GooglePlaceData, GooglePlaceDetail } from "react-native-google-places-autocomplete"
import { MapPin } from "lucide-react-native"
import { useColorScheme } from "@/lib/hooks"

interface LocationData {
  name: string
  latitude?: number
  longitude?: number
  placeId?: string
}

interface LocationAutocompleteProps {
  value?: string
  placeholder?: string
  onLocationSelect: (location: LocationData) => void
  onClear?: () => void
}

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || ""

export function LocationAutocomplete({
  value,
  placeholder = "Search location...",
  onLocationSelect,
  onClear,
}: LocationAutocompleteProps) {
  const { colors } = useColorScheme()
  const ref = useRef<any>(null)

  const handlePress = (data: GooglePlaceData, details: GooglePlaceDetail | null) => {
    const locationData: LocationData = {
      name: data.description,
      placeId: data.place_id,
      latitude: details?.geometry?.location?.lat,
      longitude: details?.geometry?.location?.lng,
    }
    onLocationSelect(locationData)
  }

  return (
    <View style={styles.container}>
      <GooglePlacesAutocomplete
        ref={ref}
        placeholder={placeholder}
        fetchDetails={true}
        onPress={handlePress}
        textInputProps={{
          placeholderTextColor: colors.mutedForeground,
          value: value,
          onChangeText: (text) => {
            if (!text && onClear) {
              onClear()
            }
          },
        }}
        query={{
          key: GOOGLE_PLACES_API_KEY,
          language: "en",
          types: "establishment|geocode",
        }}
        styles={{
          container: {
            flex: 0,
          },
          textInputContainer: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.card,
            borderRadius: 16,
            paddingHorizontal: 12,
          },
          textInput: {
            flex: 1,
            height: 48,
            color: colors.foreground,
            fontSize: 15,
            backgroundColor: "transparent",
            marginLeft: 8,
          },
          listView: {
            backgroundColor: colors.card,
            borderRadius: 12,
            marginTop: 8,
            borderWidth: 1,
            borderColor: colors.border,
          },
          row: {
            backgroundColor: colors.card,
            padding: 14,
            flexDirection: "row",
            alignItems: "center",
          },
          separator: {
            height: 1,
            backgroundColor: colors.border,
          },
          description: {
            color: colors.foreground,
            fontSize: 14,
          },
          poweredContainer: {
            display: "none",
          },
        }}
        renderLeftButton={() => (
          <MapPin size={18} color={colors.mutedForeground} />
        )}
        enablePoweredByContainer={false}
        debounce={300}
        minLength={2}
        nearbyPlacesAPI="GooglePlacesSearch"
        GooglePlacesDetailsQuery={{
          fields: "geometry,formatted_address,name",
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    zIndex: 10,
  },
})

export type { LocationData }
