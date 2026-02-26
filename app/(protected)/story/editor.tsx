import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { useLayoutEffect, useEffect, useRef } from "react";
import { EditorScreen } from "@/src/stories-editor";
import { useEditorStore } from "@/src/stories-editor/stores/editor-store";
import type { EditorMode } from "@/src/stories-editor";
import { useStoryFlowStore } from "@/lib/stores/story-flow-store";

export default function StoryEditorRoute() {
  const { uri, type, initialMode } = useLocalSearchParams<{
    uri: string;
    type: string;
    initialMode?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();

  // [REGRESSION LOCK] Reset editor on mount — guarantees no stale state
  // from a previous session. Synchronous, not deferred.
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      useEditorStore.getState().resetEditor();
    }
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const handleClose = () => {
    // [REGRESSION LOCK] Synchronous reset BEFORE navigation.
    // Guarantees INV-NAV-3/4/5: mode=idle, elements=[], drawingPaths=[]
    useEditorStore.getState().resetEditor();
    useStoryFlowStore.getState().transitionTo("HUB");
    router.back();

    if (__DEV__) {
      const s = useEditorStore.getState();
      if (
        s.mode !== "idle" ||
        s.elements.length > 0 ||
        s.drawingPaths.length > 0
      ) {
        console.error("[STOP-THE-LINE] Editor state NOT clean after cancel:", {
          mode: s.mode,
          elements: s.elements.length,
          paths: s.drawingPaths.length,
        });
      }
    }
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
