const SNEAKY_LYNK_RESTORE_AT_MS = Date.parse("2026-05-23T00:00:00-04:00");

export function getLynkDisplayName(nowMs = Date.now()) {
  return nowMs >= SNEAKY_LYNK_RESTORE_AT_MS ? "Sneaky Lynk" : "Private Lynk";
}

export function getLynkRoomLowercaseName(nowMs = Date.now()) {
  return nowMs >= SNEAKY_LYNK_RESTORE_AT_MS
    ? "Sneaky Lynk room"
    : "Private Lynk";
}
