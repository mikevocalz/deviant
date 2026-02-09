"use client";

import { Dimensions } from "react-native";
import TrueSheetNavigator from "@/components/navigation/true-sheet-navigator";

const SCREEN_HEIGHT = Dimensions.get("window").height;

export default function CommentsLayout() {
  return (
    <TrueSheetNavigator
      screenOptions={
        {
          maxHeight: Math.round(SCREEN_HEIGHT * 0.7),
          cornerRadius: 16,
          grabber: true,
        } as any
      }
    />
  );
}
