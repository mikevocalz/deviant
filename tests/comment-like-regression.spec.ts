import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Comment like regression guards", () => {
  const read = (relativePath: string) =>
    readFileSync(join(process.cwd(), relativePath), "utf8");

  it("hardens the shared comment like button tap target and stops parent tap propagation", () => {
    const source = read("components/comments/threaded-comment.tsx");
    expect(source).toContain("event.stopPropagation()");
    expect(source).toContain("hitSlop={12}");
  });

  it("reconciles post comment caches after a successful like mutation", () => {
    const source = read("lib/hooks/use-comment-like-state.ts");
    expect(source).toContain("queryKey: commentKeys.byPost(postId)");
    expect(source).toContain('queryKey: [...commentKeys.all, "thread", postId]');
    expect(source).toContain("invalidateQueries");
  });

  it("allows post detail comment actions to work while taps are being handled inside the scroll view", () => {
    const source = read("app/(protected)/post/[id].tsx");
    expect(source).toContain('<ScrollView keyboardShouldPersistTaps="handled">');
  });
});
