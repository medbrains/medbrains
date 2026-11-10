import { describe, expect, it } from "vitest";
import { footerCountText } from "./DataTable";

describe("footerCountText", () => {
  it("counts against the server's total when it is known", () => {
    expect(
      footerCountText({ total: 87, rowsOnPage: 20, page: 2, perPage: 20, totalPages: 5 }),
    ).toBe("Showing 21–40 of 87 items");
  });

  it("names the page when only this page's rows are known", () => {
    expect(
      footerCountText({ total: undefined, rowsOnPage: 20, page: 2, perPage: 20, totalPages: 5 }),
    ).toBe("Page 2 of 5");
  });

  it("counts a single unpaged list by its rows", () => {
    expect(
      footerCountText({ total: undefined, rowsOnPage: 7, page: 1, perPage: 20, totalPages: 1 }),
    ).toBe("Showing 1–7 of 7 items");
    expect(footerCountText({ total: 0, rowsOnPage: 0, page: 1, perPage: 20, totalPages: 1 })).toBe(
      "0 items",
    );
  });
});
