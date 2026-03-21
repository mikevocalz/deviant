import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { ErrorBoundary } from "@/components/error-boundary";
import { useLayoutEffect, useEffect, useRef } from "react";
import { EditorScreen } from "@/src/stories-editor";
import { useEditorStore } from "@/src/stories-editor/stores/editor-store";
import type { EditorMode } from "@/src/stories-editor";
import { useStoryFlowStore } from "@/lib/stores/story-flow-store";

function StoryEditorRouteContent() {
  const { uri, type, initialMode } = useLocalSearchParams<{
    uri: string;
    type: string;
    initialMode?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();

  // [REGRESSION LOCK] Reset editor on mount — guarantees no stale state
  // from a previous session. Must be useLayoutEffect (not useEffect) so it
  // fires BEFORE EditorScreen's useEffect(setMedia), preventing the race
  // condition where child setMedia runs first, then parent resetEditor wipes it.
  const didMount = useRef(false);
  useLayoutEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      useEditorStore.getState().resetEditor();
    }
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const handleClose = () => {
    // Navigate FIRST, then defer reset so the text-only BackgroundPicker
    // doesn't flash during the back animation. The useLayoutEffect reset
    // on next mount guarantees clean state for the next editor session.
    useStoryFlowStore.getState().transitionTo("HUB");
    router.back();
    setTimeout(() => {
      useEditorStore.getState().resetEditor();
      if (__DEV__) {
        const s = useEditorStore.getState();
        if (
          s.mode !== "idle" ||
          s.elements.length > 0 ||
          s.drawingPaths.length > 0
        ) {
          console.error(
            "[STOP-THE-LINE] Editor state NOT clean after cancel:",
            {
              mode: s.mode,
              elements: s.elements.length,
              paths: s.drawingPaths.length,
            },
          );
        }
      }
    }, 350);
  };

  const handleSave = (editedUri: string) => {
    // Navigate first so create screen can consume editedUri,
    // then reset after a short delay (hub reads params on mount)
    router.navigate({
      pathname: "/(protected)/story/create",
      params: { editedUri, editedIndex: "0" },
    });
    // Deferred reset — hub needs to read editedUri from params first
    useStoryFlowStore.getState().transitionTo("HUB");
    setTimeout(() => useEditorStore.getState().resetEditor(), 300);
  };

  return (
    <EditorScreen
      mediaUri={uri ? decodeURIComponent(uri) : ""}
      mediaType={(type as "image" | "video") || "image"}
      onClose={handleClose}
      onSave={handleSave}
      initialMode={initialMode as EditorMode | undefined}
    />
  );
}

export default function StoryEditorRoute() {
  const router = useRouter();
  return (
    <ErrorBoundary screenName="StoryEditor" onGoBack={() => router.back()}>
      <StoryEditorRouteContent />
    </ErrorBoundary>
  );
}
