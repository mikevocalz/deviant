/**
 * TicketAccessDetails — Collapsible access info section
 * Entry window, dress code, perks, door policy, table number
 */

import React, { memo, useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import {
  Clock,
  Shirt,
  ShieldCheck,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Hash,
} from "lucide-react-native";
import { Motion } from "@legendapp/motion";
import type { Ticket, TicketTierLevel } from "@/lib/stores/ticket-store";

interface TicketAccessDetailsProps {
  ticket: Ticket;
}

const TIER_ACCENT: Record<TicketTierLevel, string> = {
  free: "#a3a3a3",
  ga: "#60a5fa",
  vip: "#fbbf24",
  table: "#c084fc",
};

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function DetailRow({ icon, label, value }: DetailRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>{icon}</View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

export const TicketAccessDetails = memo(function TicketAccessDetails({
  ticket,
}: TicketAccessDetailsProps) {
  const [expanded, setExpanded] = useState(false);
  const tier = ticket.tier || "ga";
  const accent = TIER_ACCENT[tier];

  const hasDetails =
    ticket.entryWindow ||
    ticket.dressCode ||
    ticket.doorPolicy ||
    ticket.tableNumber ||
    (ticket.perks && ticket.perks.length > 0);

  if (!hasDetails) return null;

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  // Primary details always shown
  const primaryDetails: DetailRowProps[] = [];

  if (ticket.entryWindow) {
    primaryDetails.push({
      icon: <Clock size={16} color={accent} />,
      label: "Entry Window",
      value: ticket.entryWindow,
    });
  }

  if (ticket.tableNumber) {
    primaryDetails.push({
      icon: <Hash size={16} color={accent} />,
      label: "Table",
      value: `Table ${ticket.tableNumber}`,
    });
  }

  // Secondary details (collapsible)
  const secondaryDetails: DetailRowProps[] = [];

  if (ticket.dressCode) {
    secondaryDetails.push({
      icon: <Shirt size={16} color="rgba(255,255,255,0.4)" />,
      label: "Dress Code",
      value: ticket.dressCode,
    });
  }

  if (ticket.doorPolicy) {
    secondaryDetails.push({
      icon: <ShieldCheck size={16} color="rgba(255,255,255,0.4)" />,
      label: "Door Policy",
      value: ticket.doorPolicy,
    });
  }

  const hasSecondary = secondaryDetails.length > 0 || (ticket.perks && ticket.perks.length > 0);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>ACCESS DETAILS</Text>

      <View style={styles.card}>
        {/* Primary details */}
        {primaryDetails.map((detail, i) => (
          <DetailRow key={i} {...detail} />
        ))}

        {/* Perks (always visible if present) */}
        {ticket.perks && ticket.perks.length > 0 && (
          <View style={styles.row}>
            <View style={styles.iconWrap}>
              <Sparkles size={16} color={accent} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Included</Text>
              <View style={styles.perksWrap}>
                {ticket.perks.map((perk, i) => (
                  <View key={i} style={[styles.perkChip, { borderColor: `${accent}30` }]}>
                    <Text style={[styles.perkText, { color: accent }]}>
                      {perk}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Collapsible secondary details */}
        {hasSecondary && (
          <>
            {expanded &&
              secondaryDetails.map((detail, i) => (
                <Motion.View
                  key={i}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", damping: 20, stiffness: 300 }}
                >
                  <DetailRow {...detail} />
                </Motion.View>
              ))}

            <Pressable onPress={handleToggle} style={styles.toggleRow}>
              <Text style={styles.toggleText}>
                {expanded ? "Show less" : "More details"}
              </Text>
              {expanded ? (
                <ChevronUp size={14} color="rgba(255,255,255,0.4)" />
              ) : (
                <ChevronDown size={14} color="rgba(255,255,255,0.4)" />
              )}
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 10,
  },
  sectionTitle: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 16,
    gap: 14,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  rowValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  perksWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  perkChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  perkText: {
    fontSize: 12,
    fontWeight: "600",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 4,
  },
  toggleText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontWeight: "600",
  },
});
