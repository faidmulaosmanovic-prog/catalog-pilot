# CatalogPilot — Marketplace Adapters

**Version:** 1.0  

---

## 1. Design goals

- Keep the **core product model channel-agnostic**  
- Encapsulate channel field requirements, transforms, and file layouts  
- Support **versioned mapping rules**  
- Distinguish **CSV/template export** from **official API integrations**  

**MVP status:** File export only. Do not claim Shopify/Amazon API sync exists.

---

## 2. First two MVP export formats (recommendation)

| Priority | Format | Why first |
|----------|--------|-----------|
| 1 | **Shopify Product CSV** | Overlaps heavily with ICP; documented columns; merchants already know the upload path; validates end-to-end export UX quickly |
| 2 | **Amazon listing/inventory CSV (constrained generic template)** | Second major US channel; even a reduced column set beats manual spreadsheet reshaping; full category flat-files are too fragmented for MVP |

**Deferred:** Walmart, eBay templates (V1.1/V2 by demand); all marketplace APIs (V2+).

---

## 3. `MarketplaceAdapter` interface

TypeScript-shaped contract (implement in `server/adapters/marketplaces/`):

```typescript
export type Severity = "critical" | "error" | "warning" | "info";

export interface AdapterIssue {
  sku?: string;
  field?: string;
  code: string;
  severity: Severity;
  message: string;
}

export interface MarketplaceTemplate {
  channelCode: string;
  version: string;
  headers: string[];
  requiredFields: string[];
  allowedValues?: Record<string, string[]>;
  mappingRules: MappingRule[]; // versioned JSON from DB
}

export interface MappingRule {
  targetColumn: string;
  source: 
    | { type: "field"; path: string }           // e.g. product.title
    | { type: "attribute"; key: string }
    | { type: "literal"; value: string }
    | { type: "transform"; name: string; args?: Record<string, unknown> };
}

export interface ProductSnapshot {
  id: string;
  sku: string;
  title: string | null;
  description: string | null;
  brand: string | null;
  categoryName: string | null;
  price: string | null; // decimal string
  currency: string;
  quantity: number | null;
  barcode: string | null;
  status: string;
  attributes: Record<string, unknown>;
  images: { url: string; position: number }[];
  variants: VariantSnapshot[];
}

export interface MarketplaceAdapter {
  readonly code: string;           // "shopify" | "amazon" | ...
  readonly integrationType: "csv_template" | "api";

  getDefaultTemplateVersion(): string;

  resolveTemplate(version: string): Promise<MarketplaceTemplate>;

  transform(
    product: ProductSnapshot,
    template: MarketplaceTemplate
  ): Record<string, string> | Record<string, string>[];
  // Shopify may emit multiple rows per variant

  validate(
    record: Record<string, string> | Record<string, string>[],
    template: MarketplaceTemplate
  ): AdapterIssue[];

  serialize(
    records: Record<string, string>[],
    template: MarketplaceTemplate
  ): AsyncIterable<Uint8Array>; // CSV bytes

  // API adapters (future) would add authenticate/push/pull — not in MVP
}
```

**Rule:** Core services call only this interface. No `if (channel === 'amazon')` inside `ProductService`.

---

## 4. Registry

```typescript
const registry: Record<string, MarketplaceAdapter> = {
  shopify: new ShopifyCsvAdapter(),
  amazon: new AmazonCsvAdapter(),
};
```

DB `channels` + `marketplace_templates` store metadata and JSON mapping; adapter code interprets it.

---

## 5. Shopify CSV adapter (MVP)

**integrationType:** `csv_template`  

**Typical columns (illustrative — verify against current Shopify docs at implement time):**

Handle, Title, Body (HTML), Vendor, Product Category, Type, Tags, Published, Option1 Name, Option1 Value, Variant SKU, Variant Price, Variant Inventory Qty, Variant Barcode, Image Src, …

**Transforms**

- Parent + variants → multiple CSV rows (Shopify pattern)  
- Description → Body (HTML) escape policy (allow basic tags or strip — document choice)  
- Brand → Vendor  
- First image URL → Image Src; additional images as extra rows or columns per template version  

**Validation examples**

- Missing Title on parent row → error  
- Missing Variant SKU → error  
- Invalid price → error  
- Missing Image Src → warning  

**Versioning:** `shopify@2026.1` in `marketplace_templates`.

> **Implementation note:** Before coding, download the current Shopify product CSV template and align headers. Mark doc drift in PR if Shopify changes columns.

---

## 6. Amazon CSV adapter (MVP constrained)

**integrationType:** `csv_template`  

Amazon’s real world uses category-specific flat files. MVP ships a **generic subset** clearly labeled in UI:

> “Amazon generic inventory template (CatalogPilot). Category-specific Amazon flat files come later.”

**Illustrative columns:** sku, product-id, product-id-type, item-name, brand-name, price, quantity, main-image-url, product-description, …

**Validation**

- sku required  
- item-name required  
- price required and > 0  
- product-id-type in allowed set when product-id present  
- main-image-url format warning  

**Not claimed:** SP-API submission, category FEED completeness, or buyability guarantees.

---

## 7. Field mapping & category-specific attributes

- Core fields map via template rules  
- Extra channel attrs read from `product.attributes`  
- Future: category packs as additional JSON mapping bundles without schema migrations  

---

## 8. Error reporting

Export job stores `error_report_json`:

```json
{
  "errors": [
    { "sku": "TEE-001", "field": "title", "code": "required", "severity": "error", "message": "Title is required for Shopify" }
  ],
  "warnings": []
}
```

UI: block download if any `error`/`critical` (configurable); allow download with warnings.

---

## 9. API integrations (future — V2+)

When adding Shopify Admin API:

1. New adapter class `ShopifyApiAdapter` with `integrationType: "api"`  
2. Separate UI: “Connected channels” with OAuth — **not** the same as CSV export button  
3. Docs and marketing must say “API sync” only when implemented  
4. Keep CSV adapter forever for offline workflows  

---

## 10. Testing requirements

- Golden-file tests: product fixtures → CSV snapshots  
- Variant expansion for Shopify  
- Empty catalog export  
- Invalid records produce stable issue codes  
- Registry rejects unknown channel codes  

---

## 11. Consistency

| Claim | Truth in MVP |
|-------|----------------|
| Shopify export | CSV template download |
| Amazon export | Constrained CSV template download |
| Walmart / eBay | Not shipped |
| Live sync | Not shipped |
