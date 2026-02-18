import { create } from "zustand";
import { persist } from "zustand/middleware";
import { mmkvStorage } from "@/lib/mmkv-zustand";

export interface City {
  id: number;
  name: string;
  state: string | null;
  country: string;
  lat: number;
  lng: number;
  timezone: string | null;
  slug: string;
}

type LocationMode = "city" | "device" | "hidden";

interface EventsLocationState {
  // Active city for event filtering
  activeCity: City | null;
  locationMode: LocationMode;
  // Device location (when opted in)
  deviceLat: number | null;
  deviceLng: number | null;
  // Recent cities for quick access
  recentCities: City[];
  // Weather cache
  weatherData: WeatherDay[] | null;
  weatherCityId: number | null;
  weatherFetchedAt: number | null;
  // Actions
  setActiveCity: (city: City) => void;
  setLocationMode: (mode: LocationMode) => void;
  setDeviceLocation: (lat: number, lng: number) => void;
  addRecentCity: (city: City) => void;
  setWeatherData: (data: WeatherDay[], cityId: number) => void;
  clearWeather: () => void;
}

export interface WeatherDay {
  date: string; // ISO date
  dayName: string; // "Mon", "Tue", etc.
  high: number; // Fahrenheit
  low: number;
  icon: string; // weather icon key
  shortForecast: string;
}

export const useEventsLocationStore = create<EventsLocationState>()(
  persist(
    (set, get) => ({
      activeCity: null,
      locationMode: "city",
      deviceLat: null,
      deviceLng: null,
      recentCities: [],
      weatherData: null,
      weatherCityId: null,
      weatherFetchedAt: null,

      setActiveCity: (city) => {
        set({ activeCity: city });
        // Also add to recents
        get().addRecentCity(city);
      },

      setLocationMode: (mode) => set({ locationMode: mode }),

      setDeviceLocation: (lat, lng) => set({ deviceLat: lat, deviceLng: lng }),

      addRecentCity: (city) =>
        set((s) => {
          const filtered = s.recentCities.filter((c) => c.id !== city.id);
          return { recentCities: [city, ...filtered].slice(0, 5) };
        }),

      setWeatherData: (data, cityId) =>
        set({
          weatherData: data,
          weatherCityId: cityId,
          weatherFetchedAt: Date.now(),
        }),

      clearWeather: () =>
        set({ weatherData: null, weatherCityId: null, weatherFetchedAt: null }),
    }),
    {
      name: "events-location",
      storage: mmkvStorage,
      partialize: (state) => ({
        activeCity: state.activeCity,
        locationMode: state.locationMode,
        deviceLat: state.deviceLat,
        deviceLng: state.deviceLng,
        recentCities: state.recentCities,
        weatherData: state.weatherData,
        weatherCityId: state.weatherCityId,
        weatherFetchedAt: state.weatherFetchedAt,
      }),
    },
  ),
);
