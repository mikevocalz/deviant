/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ["expo"],
  rules: {
    // ── LIST POLICY: LegendList ONLY ──────────────────────────────────
    // FlatList, SectionList, VirtualizedList, and FlashList are BANNED.
    // All list imports MUST come from @/components/list.
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@shopify/flash-list",
            message:
              "FlashList is BANNED. Use LegendList from '@/components/list' instead.",
          },
          {
            name: "react-native",
            importNames: ["FlatList", "SectionList", "VirtualizedList"],
            message:
              "FlatList/SectionList/VirtualizedList are BANNED. Use LegendList from '@/components/list' instead.",
          },
          {
            name: "@legendapp/list",
            message:
              "Import LegendList from '@/components/list' (the blessed path), not directly from @legendapp/list.",
          },
        ],
      },
    ],
  },
  ignorePatterns: [
    "node_modules/",
    "android/",
    "ios/",
    ".expo/",
    "dist/",
    "components/list/index.ts", // The blessed re-export module is allowed to import from @legendapp/list
  ],
};
