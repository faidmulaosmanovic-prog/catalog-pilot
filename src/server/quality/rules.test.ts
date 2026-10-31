import { describe, expect, it } from "vitest";

import { evaluateProduct, qualityScore, type ProductFacts, type RuleView } from "@/server/quality/rules";

const rules: RuleView[] = [
  { code: "missing_title", severity: "error", isEnabled: true },
  { code: "invalid_price", severity: "error", isEnabled: true },
  { code: "missing_image", severity: "warning", isEnabled: true },
  { code: "missing_description", severity: "warning", isEnabled: true },
  { code: "missing_brand", severity: "warning", isEnabled: true },
  { code: "missing_attributes", severity: "info", isEnabled: true },
  { code: "duplicate_sku", severity: "critical", isEnabled: true },
];

const bare: ProductFacts = {
  id: "p1",
  sku: "OK-1",
  title: null,
  description: null,
  brand: null,
  price: null,
  barcode: null,
  imageUrls: [],
  attributeCount: 0,
  variantSkus: [],
};

describe("quality score", () => {
  it("subtracts severity weights and floors at zero", () => {
    expect(
      qualityScore([
        { severity: "critical" },
        { severity: "critical" },
        { severity: "critical" },
        { severity: "critical" },
        { severity: "error" },
      ]),
    ).toBe(0);
    expect(qualityScore([{ severity: "error" }, { severity: "warning" }])).toBe(87);
  });

  it("flags an empty product and a shared SKU", () => {
    const findings = evaluateProduct(bare, rules, {
      skuOwners: new Map([["OK-1", new Set(["p1", "p2"])]]),
      barcodeOwners: new Map(),
    });
    expect(findings.map((finding) => finding.ruleCode)).toEqual([
      "duplicate_sku",
      "missing_title",
      "missing_description",
      "missing_brand",
      "invalid_price",
      "missing_image",
      "missing_attributes",
    ]);
    expect(qualityScore(findings.filter((finding) => finding.ruleCode !== "duplicate_sku"))).toBe(70);
  });
});
