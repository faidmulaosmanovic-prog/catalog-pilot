import { describe, expect, it } from "vitest";

import { planBulkChange, type BulkProduct } from "@/server/bulk/operations";

const product: BulkProduct = {
  id: "p1",
  sku: "TEE-1",
  title: "  Blue   Tee ",
  description: null,
  brand: "Ada",
  price: "10.00",
  categoryId: null,
  status: "draft",
  attributes: { color: "blue" },
};

describe("bulk operations", () => {
  it("replaces text, appends, and leaves a miss unchanged", () => {
    const replaced = planBulkChange(product, {
      operation: "replace_text",
      config: { field: "title", find: "Tee", replace: "T-Shirt" },
    });
    expect(replaced).toMatchObject({ kind: "change", change: { after: { title: "  Blue   T-Shirt " } } });
    expect(
      planBulkChange(product, {
        operation: "replace_text",
        config: { field: "title", find: "Mug", replace: "Cup" },
      }).kind,
    ).toBe("unchanged");
    expect(
      planBulkChange(product, {
        operation: "prepend_text",
        config: { field: "description", text: "Sale: " },
      }),
    ).toMatchObject({ kind: "change", change: { after: { description: "Sale: " } } });
  });

  it("sets, raises, and refuses a negative price", () => {
    expect(
      planBulkChange(product, { operation: "update_price", config: { mode: "percent", value: 10 } }),
    ).toMatchObject({ kind: "change", change: { after: { price: "11.00" } } });
    expect(
      planBulkChange(product, { operation: "update_price", config: { mode: "delta", value: -12 } }),
    ).toEqual({ kind: "skipped", reason: "Price would be negative" });
    expect(
      planBulkChange(
        { ...product, price: null },
        { operation: "update_price", config: { mode: "set", value: 4 } },
      ),
    ).toMatchObject({ kind: "change", change: { after: { price: "4.00" } } });
  });

  it("trims, collapses whitespace, and title-cases", () => {
    expect(
      planBulkChange(product, {
        operation: "normalize",
        config: { field: "title", trim: true, collapseWhitespace: true, case: "title" },
      }),
    ).toMatchObject({ kind: "change", change: { after: { title: "Blue Tee" } } });
  });
});
