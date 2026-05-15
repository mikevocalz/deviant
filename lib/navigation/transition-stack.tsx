import { withLayoutContext } from "expo-router";
import type {
  NativeStackNavigationEventMap,
  NativeStackNavigationOptions,
} from "expo-router/build/react-navigation/native-stack";
import { createNativeStackNavigator } from "expo-router/build/react-navigation/native-stack";
import type { ParamListBase, StackNavigationState } from "expo-router/react-navigation";

const NativeTransitionStack = createNativeStackNavigator();

export const TransitionStack = withLayoutContext<
  NativeStackNavigationOptions,
  typeof NativeTransitionStack.Navigator,
  StackNavigationState<ParamListBase>,
  NativeStackNavigationEventMap
>(NativeTransitionStack.Navigator);
