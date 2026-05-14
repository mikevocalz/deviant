import { withLayoutContext } from "expo-router";
import type {
  NativeStackNavigationEventMap,
  NativeStackNavigationOptions,
} from "@react-navigation/native-stack";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { ParamListBase, StackNavigationState } from "expo-router/react-navigation";

const NativeTransitionStack = createNativeStackNavigator();

export const TransitionStack = withLayoutContext<
  NativeStackNavigationOptions,
  typeof NativeTransitionStack.Navigator,
  StackNavigationState<ParamListBase>,
  NativeStackNavigationEventMap
>(NativeTransitionStack.Navigator);
