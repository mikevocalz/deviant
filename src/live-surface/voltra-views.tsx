/**
 * Voltra JSX components for iOS Live Activity, Dynamic Island, and Home Screen Widgets.
 * These get serialized to JSON and rendered as native SwiftUI by the Voltra extension.
 *
 * Design: DVNT brand — dark theme, purple (#8A40CF) accent, cyan (#3FDCFF) weather.
 * Lock screen uses 3-tile carousel with page dots.
 * Dynamic Island expanded renders a rich event card with live Timer countdown.
 */

import { Voltra } from "voltra";
import type {
  LiveSurfaceTile1,
  LiveSurfaceTile3,
  LiveSurfaceTile3Item,
  LiveSurfaceWeather,
} from "./types";

// ── Brand Colors ──
const PURPLE = "#8A40CF";
const PURPLE_DIM = "rgba(138,64,207,0.25)";
const CYAN = "#3FDCFF";
const DARK_BG = "#101012";
const WHITE = "#FFFFFF";
const WHITE60 = "rgba(255,255,255,0.6)";
const WHITE40 = "rgba(255,255,255,0.4)";

// ── Carousel tile: unified shape for lock screen cycling ──
export interface CarouselTile {
  title: string;
  startAt: string | null;
  venueName?: string;
  city?: string;
  category?: string;
  heroAssetName: string;
  deepLink: string;
  isUpcoming: boolean;
  attendeeCount?: number;
}

/** Build up to 3 carousel tiles from the payload (tile1 + first 2 upcoming). */
export function buildCarouselTiles(
  tile1: LiveSurfaceTile1,
  upcoming?: LiveSurfaceTile3Item[],
): CarouselTile[] {
  const tiles: CarouselTile[] = [
    {
      title: tile1.title,
      startAt: tile1.startAt,
      venueName: tile1.venueName,
      city: tile1.city,
      category: tile1.category,
      heroAssetName: "event-hero-0",
      deepLink: tile1.deepLink,
      isUpcoming: tile1.isUpcoming,
      attendeeCount: tile1.attendeeCount,
    },
  ];
  (upcoming ?? []).slice(0, 2).forEach((item, i) => {
    tiles.push({
      title: item.title,
      startAt: item.startAt,
      venueName: item.venueName,
      city: item.city,
      heroAssetName: `event-hero-${i + 1}`,
      deepLink: item.deepLink,
      isUpcoming: true,
    });
  });
  return tiles;
}

// ── Helpers ──

function weatherSFSymbol(icon?: string): string {
  switch (icon) {
    case "sun":
      return "sun.max.fill";
    case "cloud":
      return "cloud.fill";
    case "rain":
      return "cloud.rain.fill";
    case "snow":
      return "snowflake";
    case "storm":
      return "cloud.bolt.fill";
    case "fog":
      return "cloud.fog.fill";
    case "wind":
      return "wind";
    default:
      return "cloud.fill";
  }
}

function dateParts(
  startAt?: string | null,
): { day: string; month: string } | null {
  if (!startAt) return null;
  const d = new Date(startAt);
  if (isNaN(d.getTime())) return null;
  return {
    day: String(d.getDate()),
    month: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
  };
}

function formatTime(startAt?: string | null): string | null {
  if (!startAt) return null;
  const d = new Date(startAt);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function eventStartMs(startAt?: string | null): number | undefined {
  if (!startAt) return undefined;
  const ms = new Date(startAt).getTime();
  return isNaN(ms) || ms <= Date.now() ? undefined : ms;
}

// ── Shared sub-components ──

function DateBadge({
  startAt,
  size = "normal",
}: {
  startAt?: string | null;
  size?: "small" | "normal";
}) {
  const parts = dateParts(startAt);
  if (!parts) return null;
  const daySize = size === "small" ? 14 : 18;
  const monthSize = size === "small" ? 7 : 9;
  const boxSize = size === "small" ? 28 : 36;
  return (
    <Voltra.VStack
      spacing={0}
      style={{
        width: boxSize,
        height: boxSize,
        backgroundColor: "rgba(0,0,0,0.7)",
        borderRadius: 8,
      }}
    >
      <Voltra.Text
        style={{ color: WHITE, fontSize: daySize, fontWeight: "700" }}
      >
        {parts.day}
      </Voltra.Text>
      <Voltra.Text
        style={{
          color: "rgba(255,255,255,0.65)",
          fontSize: monthSize,
          fontWeight: "600",
        }}
      >
        {parts.month}
      </Voltra.Text>
    </Voltra.VStack>
  );
}

function LiveTimer({
  startAt,
  fontSize = 12,
  color = PURPLE,
}: {
  startAt?: string | null;
  fontSize?: number;
  color?: string;
}) {
  const endMs = eventStartMs(startAt);
  if (!endMs) return null;
  return (
    <Voltra.HStack
      spacing={3}
      style={{
        backgroundColor: PURPLE_DIM,
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <Voltra.Symbol name="clock.fill" tintColor={color} scale="small" />
      <Voltra.Timer
        endAtMs={endMs}
        direction="down"
        style={{ color, fontSize, fontWeight: "600" }}
      />
    </Voltra.HStack>
  );
}

function WeatherBadge({ weather }: { weather?: LiveSurfaceWeather }) {
  if (!weather?.icon) return null;
  return (
    <Voltra.HStack spacing={3}>
      <Voltra.Symbol
        name={weatherSFSymbol(weather.icon)}
        tintColor={CYAN}
        scale="small"
      />
      {weather.tempF != null && (
        <Voltra.Text
          style={{ color: WHITE60, fontSize: 11, fontWeight: "500" }}
        >
          {weather.tempF}°
        </Voltra.Text>
      )}
    </Voltra.HStack>
  );
}

function PageDots({ total, current }: { total: number; current: number }) {
  if (total <= 1) return null;
  return (
    <Voltra.HStack spacing={4}>
      {Array.from({ length: total }).map((_, i) => (
        <Voltra.View
          key={String(i)}
          style={{
            width: i === current ? 14 : 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: i === current ? PURPLE : WHITE40,
          }}
        />
      ))}
    </Voltra.HStack>
  );
}

function CategoryPill({ category }: { category?: string }) {
  if (!category) return null;
  return (
    <Voltra.Text
      style={{
        color: WHITE,
        fontSize: 9,
        fontWeight: "700",
        backgroundColor: PURPLE,
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
      }}
    >
      {category.toUpperCase()}
    </Voltra.Text>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LOCK SCREEN LIVE ACTIVITY — 3-tile carousel with page dots
// ══════════════════════════════════════════════════════════════════════════════

/** Renders one carousel slide for the lock screen Live Activity. */
export function lockScreenView(
  tile: CarouselTile,
  weather: LiveSurfaceWeather | undefined,
  currentIndex: number,
  totalTiles: number,
) {
  const time = formatTime(tile.startAt);

  return (
    <Voltra.ZStack
      alignment="bottomLeading"
      style={{ borderRadius: 20, overflow: "hidden" }}
    >
      {/* Full-bleed hero image */}
      <Voltra.Image
        source={{ assetName: tile.heroAssetName }}
        resizeMode="cover"
        style={{ width: "100%", height: 160, borderRadius: 20 }}
        fallback={
          <Voltra.LinearGradient
            colors={[PURPLE, DARK_BG]}
            style={{ width: "100%", height: 160, borderRadius: 20 }}
          />
        }
      />

      {/* Dark gradient scrim — bottom 2/3 */}
      <Voltra.LinearGradient
        colors={["transparent", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.92)"]}
        style={{ width: "100%", height: 160, borderRadius: 20 }}
      />

      {/* Top row: DVNT brand + date badge + weather */}
      <Voltra.VStack
        style={{ width: "100%", height: 160, padding: 12 }}
        spacing={0}
      >
        <Voltra.HStack spacing={5}>
          <Voltra.Symbol name="sparkles" tintColor={PURPLE} scale="small" />
          <Voltra.Text
            style={{
              color: PURPLE,
              fontSize: 11,
              fontWeight: "700",
              fontFamily: "Oasis",
            }}
          >
            DVNT
          </Voltra.Text>
          <Voltra.Spacer />
          <WeatherBadge weather={weather} />
          <DateBadge startAt={tile.startAt} size="small" />
        </Voltra.HStack>
        <Voltra.Spacer />
      </Voltra.VStack>

      {/* Bottom overlay: all event details */}
      <Voltra.VStack
        alignment="leading"
        spacing={5}
        style={{ padding: 12, width: "100%" }}
      >
        {/* Category pill */}
        {tile.category && <CategoryPill category={tile.category} />}

        {/* Event title */}
        <Voltra.Text
          numberOfLines={2}
          style={{ color: WHITE, fontSize: 17, fontWeight: "800" }}
        >
          {tile.title}
        </Voltra.Text>

        {/* Time + venue row */}
        <Voltra.HStack spacing={10}>
          {time && (
            <Voltra.HStack spacing={3}>
              <Voltra.Symbol name="clock" tintColor={WHITE40} scale="small" />
              <Voltra.Text style={{ color: WHITE60, fontSize: 11 }}>
                {time}
              </Voltra.Text>
            </Voltra.HStack>
          )}
          {tile.venueName && (
            <Voltra.HStack spacing={3}>
              <Voltra.Symbol name="mappin" tintColor={WHITE40} scale="small" />
              <Voltra.Text
                numberOfLines={1}
                style={{ color: WHITE60, fontSize: 11 }}
              >
                {tile.venueName}
                {tile.city ? ` · ${tile.city}` : ""}
              </Voltra.Text>
            </Voltra.HStack>
          )}
        </Voltra.HStack>

        {/* Bottom row: countdown + attendees + page dots */}
        <Voltra.HStack spacing={8}>
          {tile.isUpcoming && <LiveTimer startAt={tile.startAt} />}
          {tile.attendeeCount != null && tile.attendeeCount > 0 && (
            <Voltra.HStack spacing={3}>
              <Voltra.Symbol
                name="person.2.fill"
                tintColor={WHITE40}
                scale="small"
              />
              <Voltra.Text style={{ color: WHITE60, fontSize: 11 }}>
                {tile.attendeeCount}
              </Voltra.Text>
            </Voltra.HStack>
          )}
          <Voltra.Spacer />
          <PageDots total={totalTiles} current={currentIndex} />
        </Voltra.HStack>
      </Voltra.VStack>
    </Voltra.ZStack>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DYNAMIC ISLAND — rich event card on expand, live timer on compact
// ══════════════════════════════════════════════════════════════════════════════

export function dynamicIslandVariants(
  tile: CarouselTile,
  weather?: LiveSurfaceWeather,
) {
  const endMs = eventStartMs(tile.startAt);

  return {
    // ── Minimal: brand icon ──
    minimal: <Voltra.Symbol name="sparkles" tintColor={PURPLE} />,

    // ── Compact: hero thumb + live countdown ──
    compact: {
      leading: (
        <Voltra.Image
          source={{ assetName: tile.heroAssetName }}
          resizeMode="cover"
          style={{ width: 28, height: 28, borderRadius: 8 }}
          fallback={<Voltra.Symbol name="sparkles" tintColor={PURPLE} />}
        />
      ),
      trailing: endMs ? (
        <Voltra.Timer
          endAtMs={endMs}
          direction="down"
          style={{ color: PURPLE, fontSize: 14, fontWeight: "700" }}
        />
      ) : (
        <Voltra.Text
          style={{
            color: WHITE,
            fontSize: 14,
            fontWeight: "600",
            fontFamily: "Oasis",
          }}
        >
          DVNT
        </Voltra.Text>
      ),
    },

    // ── Expanded: rich event card ──
    expanded: {
      leading: (
        <Voltra.ZStack alignment="bottomTrailing">
          <Voltra.Image
            source={{ assetName: tile.heroAssetName }}
            resizeMode="cover"
            style={{ width: 56, height: 56, borderRadius: 12 }}
            fallback={
              <Voltra.LinearGradient
                colors={[PURPLE, DARK_BG]}
                style={{ width: 56, height: 56, borderRadius: 12 }}
              />
            }
          />
          <Voltra.VStack style={{ padding: 2 }}>
            <DateBadge startAt={tile.startAt} size="small" />
          </Voltra.VStack>
        </Voltra.ZStack>
      ),

      center: (
        <Voltra.VStack alignment="leading" spacing={2}>
          <Voltra.Text
            numberOfLines={2}
            style={{ color: WHITE, fontSize: 16, fontWeight: "700" }}
          >
            {tile.title}
          </Voltra.Text>
          {tile.venueName && (
            <Voltra.HStack spacing={3}>
              <Voltra.Symbol name="mappin" tintColor={WHITE40} scale="small" />
              <Voltra.Text
                numberOfLines={1}
                style={{ color: WHITE60, fontSize: 12 }}
              >
                {tile.venueName}
                {tile.city ? ` · ${tile.city}` : ""}
              </Voltra.Text>
            </Voltra.HStack>
          )}
        </Voltra.VStack>
      ),

      trailing: endMs ? (
        <Voltra.VStack spacing={1}>
          <Voltra.Timer
            endAtMs={endMs}
            direction="down"
            style={{ color: PURPLE, fontSize: 15, fontWeight: "700" }}
          />
          <Voltra.Text
            style={{ color: WHITE40, fontSize: 9, fontWeight: "500" }}
          >
            until start
          </Voltra.Text>
        </Voltra.VStack>
      ) : null,

      bottom: (
        <Voltra.HStack spacing={6}>
          {tile.category && <CategoryPill category={tile.category} />}
          {tile.attendeeCount != null && tile.attendeeCount > 0 && (
            <Voltra.HStack spacing={3}>
              <Voltra.Symbol
                name="person.2.fill"
                tintColor={WHITE40}
                scale="small"
              />
              <Voltra.Text
                style={{ color: WHITE60, fontSize: 11, fontWeight: "500" }}
              >
                {tile.attendeeCount}
              </Voltra.Text>
            </Voltra.HStack>
          )}
          <Voltra.Spacer />
          <WeatherBadge weather={weather} />
        </Voltra.HStack>
      ),
    },

    keylineTint: PURPLE,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// HOME SCREEN WIDGETS
// ══════════════════════════════════════════════════════════════════════════════

export function smallWidget(
  tile1: LiveSurfaceTile1,
  weather?: LiveSurfaceWeather,
) {
  return (
    <Voltra.ZStack alignment="bottomLeading">
      <Voltra.Image
        source={{ assetName: "event-hero-0" }}
        resizeMode="cover"
        style={{ width: "100%", height: "100%", borderRadius: 0 }}
        fallback={
          <Voltra.LinearGradient
            colors={[PURPLE, DARK_BG]}
            style={{ width: "100%", height: "100%", borderRadius: 0 }}
          />
        }
      />
      <Voltra.LinearGradient
        colors={["transparent", "rgba(0,0,0,0.85)"]}
        style={{ width: "100%", height: "100%", borderRadius: 0 }}
      />

      {/* Date badge top-right */}
      <Voltra.VStack style={{ width: "100%", height: "100%", padding: 10 }}>
        <Voltra.HStack>
          <Voltra.Spacer />
          <DateBadge startAt={tile1.startAt} size="small" />
        </Voltra.HStack>
        <Voltra.Spacer />
      </Voltra.VStack>

      {/* Bottom content */}
      <Voltra.VStack
        alignment="leading"
        spacing={3}
        style={{ padding: 10, width: "100%" }}
      >
        <Voltra.Text
          numberOfLines={2}
          style={{ color: WHITE, fontSize: 14, fontWeight: "700" }}
        >
          {tile1.title}
        </Voltra.Text>
        {tile1.isUpcoming && (
          <LiveTimer startAt={tile1.startAt} fontSize={10} />
        )}
        {tile1.venueName && (
          <Voltra.HStack spacing={3}>
            <Voltra.Symbol
              name="mappin"
              tintColor="rgba(255,255,255,0.5)"
              scale="small"
            />
            <Voltra.Text
              numberOfLines={1}
              style={{ color: WHITE60, fontSize: 10 }}
            >
              {tile1.venueName}
            </Voltra.Text>
          </Voltra.HStack>
        )}
      </Voltra.VStack>
    </Voltra.ZStack>
  );
}

export function mediumWidget(
  tile1: LiveSurfaceTile1,
  weather?: LiveSurfaceWeather,
) {
  const time = formatTime(tile1.startAt);
  return (
    <Voltra.HStack
      spacing={0}
      style={{
        backgroundColor: DARK_BG,
        borderRadius: 0,
        width: "100%",
        height: "100%",
      }}
    >
      {/* Left: hero image */}
      <Voltra.ZStack alignment="bottomLeading">
        <Voltra.Image
          source={{ assetName: "event-hero-0" }}
          resizeMode="cover"
          style={{ width: 155, height: "100%", borderRadius: 0 }}
          fallback={
            <Voltra.LinearGradient
              colors={[PURPLE, DARK_BG]}
              style={{ width: 155, height: "100%", borderRadius: 0 }}
            />
          }
        />
        {tile1.category && (
          <Voltra.VStack style={{ padding: 8 }}>
            <CategoryPill category={tile1.category} />
          </Voltra.VStack>
        )}
      </Voltra.ZStack>

      {/* Right: event details */}
      <Voltra.VStack
        alignment="leading"
        spacing={4}
        style={{ flex: 1, padding: 12 }}
      >
        <Voltra.HStack spacing={4}>
          <Voltra.Symbol name="sparkles" tintColor={PURPLE} scale="small" />
          <Voltra.Spacer />
          <WeatherBadge weather={weather} />
        </Voltra.HStack>

        <Voltra.HStack spacing={6}>
          <DateBadge startAt={tile1.startAt} />
          <Voltra.VStack alignment="leading" spacing={1}>
            <Voltra.Text
              numberOfLines={2}
              style={{ color: WHITE, fontSize: 14, fontWeight: "700" }}
            >
              {tile1.title}
            </Voltra.Text>
            {time && (
              <Voltra.Text style={{ color: WHITE60, fontSize: 11 }}>
                {time}
              </Voltra.Text>
            )}
          </Voltra.VStack>
        </Voltra.HStack>

        <Voltra.Spacer />

        <Voltra.HStack spacing={6}>
          {tile1.isUpcoming && (
            <LiveTimer startAt={tile1.startAt} fontSize={10} />
          )}
          <Voltra.Spacer />
          {tile1.venueName && (
            <Voltra.HStack spacing={3}>
              <Voltra.Symbol name="mappin" tintColor={WHITE40} scale="small" />
              <Voltra.Text
                numberOfLines={1}
                style={{ color: WHITE60, fontSize: 10 }}
              >
                {tile1.venueName}
              </Voltra.Text>
            </Voltra.HStack>
          )}
        </Voltra.HStack>
      </Voltra.VStack>
    </Voltra.HStack>
  );
}

export function largeWidget(
  tile1: LiveSurfaceTile1,
  weather?: LiveSurfaceWeather,
  upcoming?: LiveSurfaceTile3["items"],
) {
  return (
    <Voltra.VStack
      spacing={0}
      style={{
        backgroundColor: DARK_BG,
        borderRadius: 0,
        width: "100%",
        height: "100%",
      }}
    >
      {/* Top: featured event card */}
      <Voltra.ZStack
        alignment="bottomLeading"
        style={{ height: 160, width: "100%" }}
      >
        <Voltra.Image
          source={{ assetName: "event-hero-0" }}
          resizeMode="cover"
          style={{ width: "100%", height: "100%", borderRadius: 0 }}
          fallback={
            <Voltra.LinearGradient
              colors={[PURPLE, DARK_BG]}
              style={{ width: "100%", height: "100%", borderRadius: 0 }}
            />
          }
        />
        <Voltra.LinearGradient
          colors={["transparent", "rgba(0,0,0,0.85)"]}
          style={{ width: "100%", height: "100%", borderRadius: 0 }}
        />
        <Voltra.VStack
          alignment="leading"
          spacing={4}
          style={{ padding: 12, width: "100%" }}
        >
          <Voltra.HStack spacing={4}>
            <Voltra.Text
              numberOfLines={1}
              style={{ color: WHITE, fontSize: 17, fontWeight: "700", flex: 1 }}
            >
              {tile1.title}
            </Voltra.Text>
            <DateBadge startAt={tile1.startAt} size="small" />
          </Voltra.HStack>
          <Voltra.HStack spacing={8}>
            {tile1.isUpcoming && (
              <LiveTimer startAt={tile1.startAt} fontSize={10} />
            )}
            {tile1.venueName && (
              <Voltra.HStack spacing={3}>
                <Voltra.Symbol
                  name="mappin"
                  tintColor="rgba(255,255,255,0.5)"
                  scale="small"
                />
                <Voltra.Text
                  numberOfLines={1}
                  style={{ color: WHITE60, fontSize: 11 }}
                >
                  {tile1.venueName}
                </Voltra.Text>
              </Voltra.HStack>
            )}
            <Voltra.Spacer />
            <WeatherBadge weather={weather} />
          </Voltra.HStack>
        </Voltra.VStack>
      </Voltra.ZStack>

      {/* Bottom: upcoming events list */}
      <Voltra.VStack
        alignment="leading"
        spacing={0}
        style={{ padding: 12, flex: 1 }}
      >
        <Voltra.Text
          style={{
            color: WHITE40,
            fontSize: 10,
            fontWeight: "700",
            marginBottom: 6,
          }}
        >
          COMING UP
        </Voltra.Text>
        {(upcoming ?? []).slice(0, 3).map((item, i) => {
          const p = dateParts(item.startAt);
          return (
            <Voltra.HStack
              key={item.eventId || String(i)}
              spacing={8}
              style={{ paddingVertical: 5 }}
            >
              {p && (
                <Voltra.VStack
                  spacing={0}
                  style={{
                    width: 28,
                    height: 28,
                    backgroundColor: PURPLE_DIM,
                    borderRadius: 6,
                  }}
                >
                  <Voltra.Text
                    style={{ color: PURPLE, fontSize: 13, fontWeight: "700" }}
                  >
                    {p.day}
                  </Voltra.Text>
                  <Voltra.Text
                    style={{
                      color: "rgba(138,64,207,0.6)",
                      fontSize: 7,
                      fontWeight: "600",
                    }}
                  >
                    {p.month}
                  </Voltra.Text>
                </Voltra.VStack>
              )}
              <Voltra.VStack
                alignment="leading"
                spacing={1}
                style={{ flex: 1 }}
              >
                <Voltra.Text
                  numberOfLines={1}
                  style={{ color: WHITE, fontSize: 13, fontWeight: "600" }}
                >
                  {item.title}
                </Voltra.Text>
                {item.venueName && (
                  <Voltra.Text
                    numberOfLines={1}
                    style={{ color: WHITE40, fontSize: 10 }}
                  >
                    {item.venueName}
                  </Voltra.Text>
                )}
              </Voltra.VStack>
              <Voltra.Symbol
                name="chevron.right"
                tintColor="rgba(255,255,255,0.2)"
                scale="small"
              />
            </Voltra.HStack>
          );
        })}
      </Voltra.VStack>
    </Voltra.VStack>
  );
}
