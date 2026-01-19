// Server-side stub for expo-notifications
const noop = () => {};
const noopAsync = async () => null;
const noopSubscription = { remove: noop };

module.exports = {
  setNotificationHandler: noop,
  getPermissionsAsync: async () => ({ status: "undetermined" }),
  requestPermissionsAsync: async () => ({ status: "undetermined" }),
  getExpoPushTokenAsync: noopAsync,
  setNotificationChannelAsync: noopAsync,
  scheduleNotificationAsync: async () => "",
  cancelAllScheduledNotificationsAsync: noopAsync,
  getBadgeCountAsync: async () => 0,
  setBadgeCountAsync: noopAsync,
  addNotificationReceivedListener: () => noopSubscription,
  addNotificationResponseReceivedListener: () => noopSubscription,
  AndroidImportance: {
    MAX: 5,
    HIGH: 4,
    DEFAULT: 3,
    LOW: 2,
    MIN: 1,
  },
  SchedulableTriggerInputTypes: {
    TIME_INTERVAL: "timeInterval",
    DATE: "date",
    DAILY: "daily",
    WEEKLY: "weekly",
    MONTHLY: "monthly",
    YEARLY: "yearly",
  },
};
