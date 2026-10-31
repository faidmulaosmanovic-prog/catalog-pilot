import { describe, expect, it } from "vitest";

import { AmazonCsvAdapter, ShopifyCsvAdapter, applyRules, getAdapter, type ProductSnapshot } from "@/server/exports/adapters";
import { toCsv } from "@/server/exports/csv";
import { AMAZON_TEMPLATE_2026_1, SHOPIFY_TEMPLATE_2026_1 } from "@/server/exports/templates";

const product: ProductSnapshot = {
  id: "p1",
  sku: "TEE-1",
  title: "Blue Tee",
  description: "Soft <cotton>",
  brand: "Ada",
  categoryName: null,
  price: "10.00",
  currency: "USD",
  quantity: 3,
  barcode: "123456789012",
  status: "active",
  attributes: {},
  images: [{ url: "https://example.com/tee.jpg", position: 0 }],
  variants: [
    { sku: "TEE-1-S", price: "10.00", quantity: 1, barcode: null, option1Name: "Size", option1Value: "S" },
    { sku: "TEE-1-M", price: "11.00", quantity: 2, barcode: null, option1Name: "Size", option1Value: "M" },
  ],
};

describe("marketplace CSV adapters", () => {
  it("writes the Shopify 2026.1 golden file and expands variants", () => {
    const adapter = new ShopifyCsvAdapter();
    const rows = adapter.expand(product).map((row) => applyRules(row, SHOPIFY_TEMPLATE_2026_1.mappingRules));
    expect(rows).toHaveLength(2);
    expect(toCsv(SHOPIFY_TEMPLATE_2026_1.headers, rows)).toBe(
      [
        "Handle,Title,Body (HTML),Vendor,Published,Option1 Name,Option1 Value,Variant SKU,Variant Price,Variant Inventory Qty,Variant Barcode,Image Src,Status",
        "blue-tee,Blue Tee,Soft &lt;cotton&gt;,Ada,TRUE,Size,S,TEE-1-S,10.00,1,,https://example.com/tee.jpg,active",
        "blue-tee,,,,TRUE,Size,M,TEE-1-M,11.00,2,,,active",
        "",
      ].join("\n"),
    );
    expect(adapter.validate(adapter.expand(product), SHOPIFY_TEMPLATE_2026_1, product).some((issue) => issue.severity === "error")).toBe(false);
  });

  it("writes the Amazon 2026.1 golden file and rejects a bad product id type", () => {
    const adapter = new AmazonCsvAdapter();
    const rows = adapter.expand(product).map((row) => applyRules(row, AMAZON_TEMPLATE_2026_1.mappingRules));
    expect(toCsv(AMAZON_TEMPLATE_2026_1.headers, rows)).toBe(
      [
        "sku,product-id,product-id-type,item-name,brand-name,item-price,quantity,main-image-url,product-description",
        "TEE-1,123456789012,UPC,Blue Tee,Ada,10.00,3,https://example.com/tee.jpg,Soft &lt;cotton&gt;",
        "",
      ].join("\n"),
    );
    const bad = adapter.expand({ ...product, barcode: "ABC", variants: [] });
    expect(adapter.validate(bad, AMAZON_TEMPLATE_2026_1, { ...product, barcode: "ABC" }).map((issue) => issue.code)).toContain(
      "invalid_product_id_type",
    );
  });

  it("rejects an unknown channel", () => {
    expect(() => getAdapter("walmart")).toThrow(/Unknown channel/);
  });
});
