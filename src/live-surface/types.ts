/**
 * Live Surface Data Contract
 * Shared types for iOS Live Activity + Dynamic Island + Android ongoing notification.
 * Compact payload — both platforms render from the same structure.
 */

export type WeatherIcon =
  | "sun"
  | "cloud"
  | "rain"
  | "snow"
  | "storm"
  | "fog"
  | "wind";

export interface LiveSurfaceTile1 {
  eventId: string | null;
  title: string;
  startAt: string | null;
  venueName?: string;
  city?: string;
  heroThumbUrl?: string | null;
  isUpcoming: boolean;
  deepLink: string;
}

export interface LiveSurfaceTile2Item {
  id: string;
  thumbUrl: string | null;
  deepLink: string;
  a11yLabel?: string;
}

export interface LiveSurfaceTile2 {
  weekStartISO: string;
  items: LiveSurfaceTile2Item[];
  recapDeepLink: string;
}

export interface LiveSurfaceTile3Item {
  eventId: string;
  title: string;
  startAt: string;
  venueName?: string;
  city?: string;
  heroThumbUrl?: string | null;
  deepLink: string;
}

export interface LiveSurfaceTile3 {
  items: LiveSurfaceTile3Item[];
  seeAllDeepLink: string;
}

export interface LiveSurfaceWeather {
  icon: WeatherIcon;
  tempF?: number;
  label?: string;
  hiF?: number;
  loF?: number;
  precipPct?: number;
  feelsLikeF?: number;
}

export interface LiveSurfacePayload {
  generatedAt: string;
  tile1: LiveSurfaceTile1;
  tile2: LiveSurfaceTile2;
  tile3: LiveSurfaceTile3;
  weather?: LiveSurfaceWeather;
}

/** Minimum thumb dimensions for CDN URLs */
export const THUMB_MAX_WIDTH = 200;
export const THUMB_MAX_HEIGHT = 200;

/** Deep link base */
export const DEEP_LINK_BASE = "https://dvntlive.app";

/** Build a deep link URL */
export function buildDeepLink(path: string): string {
  return `${DEEP_LINK_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}
