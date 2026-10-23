import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { BlogSection } from "./BlogSection";

const POST = {
  id: "post-1",
  title: "Monsoon fevers",
  excerpt: "What to watch for",
  cover_image_url: null,
  status: "published",
  author_name: "Dr. Rao",
  published_at: "2026-10-01T00:00:00Z",
};

vi.mock("@medbrains/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/api")>()),
  api: {
    listBlog: vi.fn(async () => [POST]),
    getBlogPost: vi.fn(async () => ({
      ...POST,
      // A stored-XSS payload: the server keeps body_html as the author sent it.
      body_html:
        "<h2>Signs</h2><p>Drink <strong>water</strong>.</p>" +
        "<script>window.__pwned = 1</script>" +
        '<img src="x" onerror="window.__pwned = 2">' +
        '<a href="javascript:window.__pwned = 3">click</a>',
    })),
  },
}));

vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => false,
}));

describe("BlogSection reader", () => {
  it("renders the article's formatting but strips script, handlers and javascript: links", async () => {
    render(<BlogSection />);
    await userEvent.click(await screen.findByText("Monsoon fevers"));

    expect(await screen.findByRole("heading", { name: "Signs" })).toBeInTheDocument();
    expect(screen.getByText("water").tagName).toBe("STRONG");

    const body = document.body;
    expect(body.querySelector("script")).toBeNull();
    expect(body.querySelector("[onerror]")).toBeNull();
    expect(screen.getByText("click").getAttribute("href") ?? "").not.toMatch(/javascript:/i);
    expect((window as { __pwned?: number }).__pwned).toBeUndefined();
  });
});
