/**
 * Klipy API client — Stickers, GIFs, Memes
 * Docs: https://docs.klipy.com
 *
 * Auth: api_key query parameter on every request.
 * Base URL: https://api.klipy.com/v1
 */

const KLIPY_BASE = "https://api.klipy.com/v1";
const KLIPY_API_KEY =
  process.env.EXPO_PUBLIC_KLIPY_API_KEY ?? "";

// ── Types ──────────────────────────────────────────────

export type KlipyTab = "stickers" | "gifs" | "memes";

export interface KlipyMediaFormat {
  url: string;
  width: number;
  height: number;
  size?: number;
}

export interface KlipyItem {
  id: string;
  title: string;
  content_description?: string;
  media_formats: {
    gif?: KlipyMediaFormat;
    tinygif?: KlipyMediaFormat;
    nanogif?: KlipyMediaFormat;
    mediumgif?: KlipyMediaFormat;
    mp4?: KlipyMediaFormat;
    tinymp4?: KlipyMediaFormat;
    nanomp4?: KlipyMediaFormat;
    webm?: KlipyMediaFormat;
    tinywebm?: KlipyMediaFormat;
    nanowebm?: KlipyMediaFormat;
    webp_transparent?: KlipyMediaFormat;
    tinywebp_transparent?: KlipyMediaFormat;
    nanowebp_transparent?: KlipyMediaFormat;
    gif_transparent?: KlipyMediaFormat;
    tinygif_transparent?: KlipyMediaFormat;
    nanogif_transparent?: KlipyMediaFormat;
    png?: KlipyMediaFormat;
    tinypng?: KlipyMediaFormat;
    nanopng?: KlipyMediaFormat;
  };
  created: number;
  url: string;
  tags?: string[];
  hasaudio?: boolean;
}

export interface KlipySearchResponse {
  results: KlipyItem[];
  next?: string;
}

export interface KlipyAutocompleteResponse {
  results: string[];
}

// ── Helpers ────────────────────────────────────────────

function buildUrl(path: string, params: Record<string, string>): string {
  const url = new URL(`${KLIPY_BASE}${path}`);
  url.searchParams.set("api_key", KLIPY_API_KEY);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  return url.toString();
}

async function klipyFetch<T>(
  path: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  const url = buildUrl(path, params);
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal,
  });

  if (!res.ok) {
    throw new Error(`Klipy API error: ${res.status}`);
  }

  // Klipy may return 204 with no body for empty results
  if (res.status === 204) {
    return { results: [] } as T;
  }

  const text = await res.text();
  if (!text) return { results: [] } as T;

  return JSON.parse(text) as T;
}

// ── Tab → API path mapping ────────────────────────────

const TAB_SEARCH_PATH: Record<KlipyTab, string> = {
  stickers: "/stickers/search",
  gifs: "/gifs/search",
  memes: "/memes/search",
};

const TAB_TRENDING_PATH: Record<KlipyTab, string> = {
  stickers: "/stickers/trending",
  gifs: "/gifs/trending",
  memes: "/memes/trending",
};

// ── Public API ─────────────────────────────────────────

export async function klipySearch(
  tab: KlipyTab,
  query: string,
  options?: { limit?: number; next?: string; signal?: AbortSignal },
): Promise<KlipySearchResponse> {
  const path = query.trim()
    ? TAB_SEARCH_PATH[tab]
    : TAB_TRENDING_PATH[tab];

  return klipyFetch<KlipySearchResponse>(
    path,
    {
      q: query.trim(),
      limit: String(options?.limit ?? 30),
      ...(options?.next ? { pos: options.next } : {}),
    },
    options?.signal,
  );
}

export async function klipyAutocomplete(
  query: string,
  signal?: AbortSignal,
): Promise<string[]> {
  if (!query.trim()) return [];

  const data = await klipyFetch<KlipyAutocompleteResponse>(
    "/autocomplete",
    { q: query.trim(), limit: "8" },
    signal,
  );

  return data.results ?? [];
}

// ── URI extraction ─────────────────────────────────────

/**
 * Extract the best image URI from a Klipy item for canvas insertion.
 * Prioritizes transparent formats for stickers, full-size for GIFs/memes.
 */
export function getItemImageUri(item: KlipyItem, tab: KlipyTab): string {
  const m = item.media_formats;

  if (tab === "stickers") {
    return (
      m.webp_transparent?.url ??
      m.tinywebp_transparent?.url ??
      m.gif_transparent?.url ??
      m.tinygif_transparent?.url ??
      m.png?.url ??
      m.tinypng?.url ??
      m.gif?.url ??
      m.tinygif?.url ??
      ""
    );
  }

  if (tab === "gifs") {
    return (
      m.gif?.url ??
      m.mediumgif?.url ??
      m.tinygif?.url ??
      ""
    );
  }

  // memes
  return (
    m.gif?.url ??
    m.png?.url ??
    m.tinygif?.url ??
    m.tinypng?.url ??
    ""
  );
}

/**
 * Extract a small preview URI for grid thumbnails.
 */
export function getItemPreviewUri(item: KlipyItem, tab: KlipyTab): string {
  const m = item.media_formats;

  if (tab === "stickers") {
    return (
      m.nanowebp_transparent?.url ??
      m.tinywebp_transparent?.url ??
      m.nanogif_transparent?.url ??
      m.nanopng?.url ??
      m.nanogif?.url ??
      getItemImageUri(item, tab)
    );
  }

  return (
    m.nanogif?.url ??
    m.tinygif?.url ??
    m.nanopng?.url ??
    getItemImageUri(item, tab)
  );
}
