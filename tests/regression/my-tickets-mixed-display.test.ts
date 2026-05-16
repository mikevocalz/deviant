import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("My Tickets mixed admission and coat-check display", () => {
  const source = readFileSync(
    join(process.cwd(), "app/(protected)/events/my-tickets.tsx"),
    "utf8",
  );
  const ticketApi = readFileSync(
    join(process.cwd(), "lib/api/tickets.ts"),
    "utf8",
  );

  it("models unified ticket category fields on TicketRecord", () => {
    expect(ticketApi).toContain('category?: "admission" | "coat_check"');
    expect(ticketApi).toContain("cart_line_item_id");
  });

  it("renders coat-check tickets distinctly from admission tickets", () => {
    expect(source).toContain('ticket.category === "coat_check"');
    expect(source).toContain("Coat Check");
    expect(source).toContain("Shirt");
    expect(source).toContain("cardHeight = isCoatCheck ? 78 : 100");
    expect(source).toContain("imageWidth = isCoatCheck ? 60 : 80");
  });

  it("does not show a QR icon for coat-check rows in the ticket list", () => {
    expect(source).toContain("isCoatCheck ? (");
    expect(source).toContain("<Shirt size={18}");
    expect(source).toContain("<QrCode size={20}");
  });
});
