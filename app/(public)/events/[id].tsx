/**
 * Public Event Detail
 *
 * Read-only view of an event that a non-authenticated visitor can
 * browse. Lets the visitor pick a ticket tier and complete a guest
 * purchase (email-only, no account required) via GuestCheckoutSheet.
 *
 * Intentionally minimal — no RSVP / likes / comments / checkout
 * sheets with 20 config knobs. Sign-in gate is one tap away for
 * anyone who wants the full experience.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Ticket as TicketIcon,
  Calendar,
  MapPin,
  Check,
  LogIn,
} from "lucide-react-native";
import { ErrorBoundary } from "@/components/error-boundary";
import { ScreenSkeleton } from "@/components/ui/screen-skeleton";
import { useEvent } from "@/lib/hooks/use-events";
import { useTicketTypes } from "@/lib/hooks/use-tickets";
import { usePublicGateStore } from "@/lib/stores/public-gate-store";
import { GuestCheckoutSheet } from "@/components/events/GuestCheckoutSheet";

interface TierLite {
  id: string;
  name: string;
  priceCents: number;
  description: string | null;
  remaining: number;
  isActive: boolean;
  isSoldOut: boolean;
}

function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function PublicEventDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const eventId = Array.isArray(id) ? (id[0] ?? "") : (id ?? "");
  const openGate = usePublicGateStore((s) => s.openGate);

  const { data: event, isLoading, isError } = useEvent(eventId);
  const { data: tierRows = [] } = useTicketTypes(eventId);

  const tiers: TierLite[] = useMemo(() => {
    return (tierRows as any[])
      .filter((t) => t.is_active !== false)
      .map((t) => {
        const total = Number(t.quantity_total || 0);
        const sold = Number(t.quantity_sold || 0);
        const remaining = Math.max(0, total - sold);
        return {
          id: String(t.id),
          name: t.name,
          priceCents: Number(t.price_cents || 0),
          description: t.description ?? null,
          remaining,
          isActive: t.is_active !== false,
          isSoldOut: total > 0 && remaining <= 0,
        };
      });
  }, [tierRows]);

  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [guestSheetOpen, setGuestSheetOpen] = useState(false);

  // Auto-select the first available tier once tiers load
  React.useEffect(() => {
    if (selectedTierId) return;
    const firstAvailable = tiers.find((t) => !t.isSoldOut);
    if (firstAvailable) setSelectedTierId(firstAvailable.id);
  }, [tiers, selectedTierId]);

  const selectedTier = useMemo(
    () => tiers.find((t) => t.id === selectedTierId) ?? null,
    [tiers, selectedTierId],
  );

  const handleBuyAsGuest = useCallback(() => {
    if (!selectedTier || selectedTier.isSoldOut) return;
    setGuestSheetOpen(true);
  }, [selectedTier]);

  const handleSignIn = useCallback(() => {
    openGate("events");
  }, [openGate]);

  if (isLoading || !event) {
    return <ScreenSkeleton variant="detail" rows={6} />;
  }

  if (isError || !event) {
    return (
      <SafeAreaView edges={["top"]} style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={24} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>Event</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Event unavailable</Text>
          <Text style={styles.emptySub}>
            We couldn't load this event. Please try again.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const ev: any = event;
  const coverUrl: string | null =
    ev.coverImageUrl || ev.flyerImageUrl || ev.image || null;
  const title: string = ev.title || "Untitled event";
  const startIso: string | null =
    ev.startDate || ev.start_date || ev.fullDate || null;
  const dateStr = formatDate(startIso);
  const locationLabel: string =
    ev.locationName ||
    ev.locationAddress ||
    ev.location ||
    ev.location_name ||
    "";
  const description: string = ev.description || "";

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={styles.cover}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.cover, { backgroundColor: "#111" }]} />
        )}

        <View style={styles.body}>
          <Text style={styles.title}>{title}</Text>

          {dateStr ? (
            <View style={styles.metaRow}>
              <Calendar size={15} color="rgba(255,255,255,0.55)" />
              <Text style={styles.metaText}>{dateStr}</Text>
            </View>
          ) : null}

          {locationLabel ? (
            <View style={styles.metaRow}>
              <MapPin size={15} color="rgba(255,255,255,0.55)" />
              <Text style={styles.metaText} numberOfLines={2}>
                {locationLabel}
              </Text>
            </View>
          ) : null}

          {description ? (
            <Text style={styles.description}>{description}</Text>
          ) : null}

          <Text style={styles.sectionHeading}>Tickets</Text>

          {tiers.length === 0 ? (
            <Text style={styles.noTiers}>
              Ticket sales haven't opened yet.
            </Text>
          ) : (
            tiers.map((tier) => {
              const isSelected = tier.id === selectedTierId;
              const isSoldOut = tier.isSoldOut;
              return (
                <Pressable
                  key={tier.id}
                  onPress={() => !isSoldOut && setSelectedTierId(tier.id)}
                  disabled={isSoldOut}
                  style={[
                    styles.tierCard,
                    {
                      borderColor: isSelected
                        ? "#fff"
                        : "rgba(255,255,255,0.12)",
                      backgroundColor: isSelected
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(255,255,255,0.02)",
                      opacity: isSoldOut ? 0.45 : 1,
                    },
                  ]}
                >
                  <View style={styles.tierTop}>
                    <Text style={styles.tierName}>{tier.name}</Text>
                    <Text style={styles.tierPrice}>
                      {formatPrice(tier.priceCents)}
                    </Text>
                  </View>
                  {tier.description ? (
                    <Text style={styles.tierDesc} numberOfLines={2}>
                      {tier.description}
                    </Text>
                  ) : null}
                  <View style={styles.tierFoot}>
                    {isSoldOut ? (
                      <Text style={styles.soldOut}>SOLD OUT</Text>
                    ) : tier.remaining > 0 && tier.remaining <= 10 ? (
                      <Text style={styles.urgency}>
                        Only {tier.remaining} left
                      </Text>
                    ) : (
                      <View style={{ height: 0 }} />
                    )}
                    {isSelected && !isSoldOut ? (
                      <View style={styles.selectedPill}>
                        <Check size={12} color="#000" strokeWidth={3} />
                        <Text style={styles.selectedPillText}>Selected</Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ── Sticky bottom actions ── */}
      <View style={styles.bottomBar}>
        <Pressable
          onPress={handleBuyAsGuest}
          disabled={!selectedTier || selectedTier.isSoldOut}
          style={({ pressed }) => [
            styles.primaryCta,
            {
              backgroundColor:
                !selectedTier || selectedTier.isSoldOut
                  ? "rgba(255,255,255,0.12)"
                  : "#fff",
              opacity: pressed && selectedTier && !selectedTier.isSoldOut ? 0.9 : 1,
            },
          ]}
        >
          {!selectedTier ? (
            <Text style={[styles.primaryCtaText, { color: "rgba(255,255,255,0.6)" }]}>
              Select a ticket
            </Text>
          ) : selectedTier.isSoldOut ? (
            <Text style={[styles.primaryCtaText, { color: "rgba(255,255,255,0.6)" }]}>
              Sold out
            </Text>
          ) : (
            <>
              <TicketIcon size={16} color="#000" />
              <Text style={[styles.primaryCtaText, { color: "#000" }]}>
                {selectedTier.priceCents === 0
                  ? "Get free ticket"
                  : `Buy · ${formatPrice(selectedTier.priceCents)}`}
              </Text>
            </>
          )}
        </Pressable>

        <Pressable onPress={handleSignIn} style={styles.signinRow}>
          <LogIn size={14} color="rgba(255,255,255,0.55)" />
          <Text style={styles.signinText}>
            Have an account? Sign in for full access
          </Text>
        </Pressable>
      </View>

      {selectedTier && (
        <GuestCheckoutSheet
          visible={guestSheetOpen}
          onClose={() => setGuestSheetOpen(false)}
          eventId={eventId}
          eventTitle={title}
          ticketTypeId={selectedTier.id}
          ticketTypeName={selectedTier.name}
          pricePerTicketCents={selectedTier.priceCents}
          quantity={1}
        />
      )}
    </SafeAreaView>
  );
}

export default function PublicEventDetailScreen() {
  const router = useRouter();
  return (
    <ErrorBoundary
      screenName="PublicEventDetail"
      onGoBack={() => router.back()}
    >
      <PublicEventDetailContent />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  cover: {
    width: "100%",
    aspectRatio: 1,
  },
  body: {
    padding: 20,
    gap: 10,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    flex: 1,
  },
  description: {
    marginTop: 10,
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    lineHeight: 20,
  },
  sectionHeading: {
    marginTop: 24,
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  noTiers: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    marginTop: 8,
  },
  tierCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginTop: 10,
    gap: 6,
  },
  tierTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  tierName: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  tierPrice: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    marginLeft: 12,
  },
  tierDesc: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    lineHeight: 18,
  },
  tierFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 18,
    marginTop: 6,
  },
  soldOut: {
    color: "#ef4444",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  urgency: {
    color: "#f59e0b",
    fontSize: 12,
    fontWeight: "700",
  },
  selectedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#fff",
  },
  selectedPillText: {
    color: "#000",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    backgroundColor: "rgba(0,0,0,0.96)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    gap: 10,
  },
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  primaryCtaText: {
    fontSize: 15,
    fontWeight: "800",
  },
  signinRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 4,
  },
  signinText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "500",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  emptySub: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    textAlign: "center",
  },
});
