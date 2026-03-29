import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Story reply regression guards", () => {
  const read = (relativePath: string) =>
    readFileSync(join(process.cwd(), relativePath), "utf8");

  it("does not call useQueryClient inside story reply or reaction handlers", () => {
    const source = read("components/stories/story-overlays.tsx");

    expect(source).toContain("const queryClient = useQueryClient();");
    expect(source).not.toContain('await import("@tanstack/react-query")');
    expect(source).not.toContain(".useQueryClient()");
  });

  it("treats numeric identifiers in imperative conversation resolution as user ids", () => {
    const source = read("lib/hooks/use-conversation-resolution.ts");
    const helperSection = source.slice(
      source.indexOf("export async function getOrCreateConversationCached"),
      source.indexOf("export function invalidateConversationCache"),
    );

    expect(source).toContain(
      "Imperative helper for resolving a user identifier into a 1:1 conversation",
    );
    expect(helperSection).toContain(
      "await messagesApiClient.getOrCreateConversation(identifier)",
    );
    expect(helperSection).not.toContain(
      'if (/^\\d+$/.test(identifier)) return identifier;',
    );
  });
});
