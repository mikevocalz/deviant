// Server-side stub for expo-secure-store
const noop = async () => null;

module.exports = {
  getItemAsync: noop,
  setItemAsync: noop,
  deleteItemAsync: noop,
  isAvailableAsync: async () => false,
  AFTER_FIRST_UNLOCK: 0,
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  ALWAYS: 2,
  ALWAYS_THIS_DEVICE_ONLY: 3,
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 4,
  WHEN_UNLOCKED: 5,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
};
