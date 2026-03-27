/**
 * NOAA Weather.gov API Client
 *
 * Two-step fetch:
 *   1. GET /points/{lat},{lng} → returns forecast URL
 *   2. GET forecast URL → periods array (7-day forecast)
 *
 * Free, no API key required. User-Agent header recommended.
 */

export interface WeatherPeriod {
  number: number;
  name: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  detailedForecast: string;
  probabilityOfPrecipitation?: { value: number | null };
  icon: string;
}

const USER_AGENT = "(DVNT App, contact@dvnt.app)";
const TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, timeoutMs = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/geo+json",
      },
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function getWeatherForecast(
  lat: number,
  lng: number,
): Promise<WeatherPeriod[]> {
  // Step 1: Get forecast URL from points endpoint
  const pointsUrl = `https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`;
  const pointsRes = await fetchWithTimeout(pointsUrl);

  if (!pointsRes.ok) {
    throw new Error(`NOAA points failed: ${pointsRes.status}`);
  }

  const pointsData = await pointsRes.json();
  const forecastUrl = pointsData?.properties?.forecast;

  if (!forecastUrl) {
    throw new Error("No forecast URL in NOAA response");
  }

  // Step 2: Get forecast periods
  const forecastRes = await fetchWithTimeout(forecastUrl);

  if (!forecastRes.ok) {
    throw new Error(`NOAA forecast failed: ${forecastRes.status}`);
  }

  const forecastData = await forecastRes.json();
  const periods: WeatherPeriod[] = forecastData?.properties?.periods || [];

  // Return daytime periods only (up to 7 days), fallback to first 7 if no daytime
  const daytimePeriods = periods.filter((p) => p.isDaytime);
  if (daytimePeriods.length >= 7) {
    return daytimePeriods.slice(0, 7);
  }

  // Fallback: return first 7 periods regardless
  return periods.slice(0, 7);
}

/**
 * Map NOAA shortForecast text to a Lucide icon name.
 * Returns a string key that the UI component maps to the actual icon.
 */
export function mapWeatherToIcon(shortForecast: string): string {
  const lower = shortForecast.toLowerCase();

  if (lower.includes("thunder") || lower.includes("tstm")) return "cloud-lightning";
  if (lower.includes("snow") || lower.includes("blizzard") || lower.includes("sleet")) return "cloud-snow";
  if (lower.includes("rain") || lower.includes("shower") || lower.includes("drizzle")) return "cloud-rain";
  if (lower.includes("fog") || lower.includes("haze") || lower.includes("mist")) return "cloud-fog";
  if (lower.includes("partly cloudy") || lower.includes("partly sunny") || lower.includes("mostly sunny")) return "cloud-sun";
  if (lower.includes("cloud") || lower.includes("overcast") || lower.includes("mostly cloudy")) return "cloud";
  if (lower.includes("sunny") || lower.includes("clear") || lower.includes("fair")) return "sun";
  if (lower.includes("wind")) return "wind";

  return "cloud-sun"; // default
}
