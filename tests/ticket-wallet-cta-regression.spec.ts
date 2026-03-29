import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Ticket wallet CTA regression", () => {
  const read = (relativePath: string) =>
    readFileSync(join(process.cwd(), relativePath), "utf8");

  it("renders the ticket screen wallet CTA with the shared add-to-wallet helper", () => {
    const source = read("app/(protected)/ticket/[id].tsx");

    expect(source).toContain('import { addToWallet } from "@/src/ticket/helpers"');
    expect(source).toContain("const canAddToWallet =");
    expect(source).toContain("handleAddToWallet");
    expect(source).toContain("styles.walletBanner");
    expect(source).toContain("styles.bottomActionsWrap");
    expect(source).toContain("bottomInset={0}");
    expect(source).toContain("walletState === \"loading\"");
  });

  it("keeps wallet handling platform-aware through the shared helper", () => {
    const source = read("src/ticket/helpers/add-to-wallet.ts");

    expect(source).toContain("export async function addToWallet");
    expect(source).toContain('if (Platform.OS === "ios")');
    expect(source).toContain('if (Platform.OS === "android")');
    expect(source).toContain("buildAppleWalletUrl");
    expect(source).toContain("WebBrowser.openBrowserAsync");
  });
});
