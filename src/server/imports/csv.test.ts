import { describe, expect, it } from "vitest";

import { readCatalogTable, suggestMappings } from "@/server/imports/csv";

describe("csv catalog files", () => {
  it("reads a UTF-8 BOM, semicolon delimiter, and quoted delimiter", () => {
    const bytes = Buffer.from('\uFEFFsku;title\nA-1;"Mug; blue"\n', "utf8");
    const table = readCatalogTable(bytes);
    expect(table.encoding).toBe("utf-8-sig");
    expect(table.delimiter).toBe(";");
    expect(table.headers).toEqual(["sku", "title"]);
    expect(table.rows[0]).toEqual(["A-1", "Mug; blue"]);
  });

  it("suggests sku and title mappings from aliases", () => {
    const suggestions = suggestMappings(["Seller SKU", "Product Title", "Notes"]);
    expect(suggestions).toEqual([
      { sourceColumn: "Seller SKU", targetField: "sku", confidence: 0.99 },
      { sourceColumn: "Product Title", targetField: "title", confidence: 0.99 },
    ]);
  });
});
