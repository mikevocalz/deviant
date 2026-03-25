import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeHeader } from "@/lib/hooks/use-safe-header";
import { ErrorBoundary } from "@/components/error-boundary";
import { useLayoutEffect, useEffect, useRef } from "react";
import { EditorScreen } from "@/src/stories-editor";
import { useEditorStore } from "@/src/stories-editor/stores/editor-store";
import type { EditorMode } from "@/src/stories-editor";
import { useStoryFlowStore } from "@/lib/stores/story-flow-store";
import { useStoryEditorResultStore } from "@/lib/stores/story-editor-result-store";

function StoryEditorRouteContent() {
  const { uri, type, initialMode, index } = useLocalSearchParams<{
    uri: string;
    type: string;
    initialMode?: string;
    index?: string;
  }>();
  const router = useRouter();

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

  // FIX: Use safe header update to prevent loops
  useSafeHeader({ headerShown: false });

  useEffect(() => {
    const targetState =
      initialMode === "text"
        ? "TEXT_ONLY"
        : type === "video"
          ? "EDIT_VIDEO"
          : "EDIT_IMAGE";
    const flow = useStoryFlowStore.getState();

    if (flow.state === targetState) {
      return;
    }

    if (flow.state !== "HUB") {
      flow.forceIdle();
      useStoryFlowStore.getState().transitionTo("HUB");
    }

    useStoryFlowStore.getState().transitionTo(targetState);
  }, [initialMode, type]);

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
    useStoryEditorResultStore.getState().setResult({
      uri: editedUri,
      index: Number.parseInt(index ?? "0", 10) || 0,
    });
    useStoryFlowStore.getState().transitionTo("HUB");
    router.back();
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
