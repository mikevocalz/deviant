import { View, Text, Pressable, Modal, Dimensions, StyleSheet, StatusBar } from "react-native"
import { X, Wallet, Apple } from "lucide-react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useColorScheme } from "@/lib/hooks"
import { Ticket } from "@/lib/stores/ticket-store"
import { SvgXml } from "react-native-svg"
import { Image } from "expo-image"
import Logo from "@/components/logo"

interface TicketModalProps {
  visible: boolean
  onClose: () => void
  ticket: Ticket | null
  eventTitle?: string
  eventDate?: string
  eventLocation?: string
}

const { width } = Dimensions.get("window")

export function TicketModal({ visible, onClose, ticket, eventTitle, eventDate, eventLocation }: TicketModalProps) {
  const insets = useSafeAreaInsets()
  const { colors } = useColorScheme()

  if (!ticket) return null

  const renderQRCode = () => {
    if (ticket.qrSvg) {
      return (
        <SvgXml
          xml={ticket.qrSvg}
          width={200}
          height={200}
        />
      )
    }
    
    if (ticket.qrPngUrl) {
      return (
        <Image
          source={{ uri: ticket.qrPngUrl }}
          style={{ width: 200, height: 200 }}
          contentFit="contain"
        />
      )
    }

    return (
      <View style={styles.placeholderQR}>
        <Text style={{ fontSize: 64 }}>🎟️</Text>
        <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 8 }}>QR Code</Text>
      </View>
    )
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.5)" barStyle="light-content" />
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom + 24 }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Ticket</Text>
            <Pressable onPress={onClose} hitSlop={16}>
              <View style={[styles.closeButton, { backgroundColor: colors.muted }]}>
                <X size={20} color={colors.foreground} />
              </View>
            </Pressable>
          </View>

          <View style={styles.ticketContent}>
            <View style={[styles.ticketCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.ticketDashedLine}>
                {[...Array(20)].map((_, i) => (
                  <View key={i} style={[styles.dash, { backgroundColor: colors.border }]} />
                ))}
              </View>

              {eventTitle && (
                <Text style={[styles.eventTitle, { color: colors.foreground }]}>{eventTitle}</Text>
              )}
              
              {eventDate && (
                <Text style={[styles.eventDate, { color: colors.mutedForeground }]}>{eventDate}</Text>
              )}
              
              {eventLocation && (
                <Text style={[styles.eventLocation, { color: colors.mutedForeground }]}>{eventLocation}</Text>
              )}

              <View style={[styles.qrContainer, { backgroundColor: "#fff" }]}>
                {renderQRCode()}
                <View style={styles.logoOverlay}>
                  <View style={styles.logoBackground}>
                    <Logo width={72} height={72} />
                  </View>
                </View>
              </View>

              <Text style={[styles.scanText, { color: colors.mutedForeground }]}>
                Scan this QR code at the venue for entry
              </Text>

              <View style={styles.ticketDashedLine}>
                {[...Array(20)].map((_, i) => (
                  <View key={i} style={[styles.dash, { backgroundColor: colors.border }]} />
                ))}
              </View>

              <View style={styles.ticketMeta}>
                <View style={styles.metaItem}>
                  <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Ticket ID</Text>
                  <Text style={[styles.metaValue, { color: colors.foreground }]}>{ticket.id.slice(0, 8).toUpperCase()}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Status</Text>
                  <View style={[styles.statusBadge, { backgroundColor: ticket.status === "valid" ? "#22c55e20" : "#ef444420" }]}>
                    <Text style={{ color: ticket.status === "valid" ? "#22c55e" : "#ef4444", fontSize: 12, fontWeight: "600" }}>
                      {ticket.status === "valid" ? "Valid" : ticket.status === "checked_in" ? "Used" : "Revoked"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {(ticket.applePassUrl || ticket.googlePassUrl) && (
              <View style={styles.walletButtons}>
                {ticket.applePassUrl && (
                  <Pressable style={[styles.walletButton, { backgroundColor: "#000" }]}>
                    <Apple size={20} color="#fff" />
                    <Text style={styles.walletButtonText}>Add to Apple Wallet</Text>
                  </Pressable>
                )}
                {ticket.googlePassUrl && (
                  <Pressable style={[styles.walletButton, { backgroundColor: "#4285F4" }]}>
                    <Wallet size={20} color="#fff" />
                    <Text style={styles.walletButtonText}>Add to Google Wallet</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  ticketContent: {
    padding: 20,
  },
  ticketCard: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
  },
  ticketDashedLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 16,
  },
  dash: {
    width: 8,
    height: 2,
    borderRadius: 1,
  },
  eventTitle: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 2,
  },
  eventLocation: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  qrContainer: {
    alignSelf: "center",
    padding: 16,
    borderRadius: 12,
    marginVertical: 16,
    position: "relative",
  },
  logoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  logoBackground: {
    backgroundColor: "#000",
    padding: 6,
    borderRadius: 8,
  },
  placeholderQR: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  scanText: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 8,
  },
  ticketMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaItem: {
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 10,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  walletButtons: {
    marginTop: 16,
    gap: 12,
  },
  walletButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  walletButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
})
