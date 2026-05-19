/**
 * Real QR code wrapper around react-native-qrcode-svg.
 *
 * Previously this file implemented a "fake QR" that drew the finder
 * patterns + hash-based random noise — it looked like a QR but was
 * impossible to decode because the data area was not a real Reed-
 * Solomon-encoded payload. That meant DVNT ticket QRs failed to scan
 * with any QR reader (including our own VisionCamera scanner). Fixed
 * by delegating to the actual encoder.
 *
 * API preserved so existing callers (TicketQRCode, ticket-modal,
 * guest-ticket screen) keep working with their original props.
 */

import React from "react";
import type { SvgProps } from "react-native-svg";
import RealQRCode from "react-native-qrcode-svg";
import DvntGlyph from "./dvnt-glyph";

// react-native-qrcode-svg's `logoSVG` typing only accepts an FC<SvgProps>
// while our DvntGlyph accepts the same SvgProps but TS narrows the inferred
// type. Cast to satisfy the prop without changing runtime behavior.
const DvntGlyphForLogo = DvntGlyph as unknown as React.FC<SvgProps>;

interface QRCodeProps {
  value: string;
  size?: number;
  backgroundColor?: string;
  /** Legacy prop name — maps to react-native-qrcode-svg's `color`. */
  foregroundColor?: string;
  logo?: boolean;
  logoSize?: number;
  logoBackgroundColor?: string;
}

export default function QRCode({
  value,
  size = 200,
  backgroundColor = "#FFFFFF",
  foregroundColor = "#000000",
  logo,
  logoSize = 50,
  logoBackgroundColor = "#FFFFFF",
}: QRCodeProps) {
  return (
    <RealQRCode
      value={value || " "}
      size={size}
      color={foregroundColor}
      backgroundColor={backgroundColor}
      // High error correction lets us embed the DVNT logo without
      // breaking decodability (tolerates up to ~30% obscuration).
      ecl="H"
      {...(logo
        ? {
            logoSVG: DvntGlyphForLogo,
            logoSize,
            logoBackgroundColor,
            logoMargin: 4,
          }
        : {})}
    />
  );
}
